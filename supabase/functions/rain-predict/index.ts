// Rainfall Analysis & Prediction — backend edge function.
// Routes (all prefixed with /functions/v1/rain-predict):
//   POST /predict    — { features } -> { probability, intensity_mm, advice }
//   POST /analyze    — load training rows, train forest, evaluate, return metrics
//   GET  /historical — latest N climate readings
//
// The model (a small random-forest-style ensemble) is implemented in
// rainforest.ts and trained on every cold start from the climate_readings
// table, so no serialized .pkl/.joblib is needed at runtime.

import { createClient } from "npm:@supabase/supabase-js@2.57.4";

import {
  trainRainForest,
  predictRain,
  farmerAdvice,
  type Features,
  type LabeledRow,
  type RainForest,
} from "./rainforest.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
);

let forestCache: { forest: RainForest; trainedAt: number } | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000; // retrain at most every 5 minutes

async function loadTrainingRows(limit = 300): Promise<LabeledRow[]> {
  const { data, error } = await supabase
    .from("climate_readings")
    .select("humidity,temperature_c,pressure_hpa,wind_speed_kmh,cloud_cover_pct,rain,rainfall_mm")
    .order("reading_date", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`failed to load training rows: ${error.message}`);
  return (data ?? []).map((r) => ({
    humidity: Number(r.humidity),
    temperature_c: Number(r.temperature_c),
    pressure_hpa: Number(r.pressure_hpa),
    wind_speed_kmh: Number(r.wind_speed_kmh),
    cloud_cover_pct: Number(r.cloud_cover_pct),
    rain: Boolean(r.rain),
    rainfall_mm: Number(r.rainfall_mm),
  }));
}

async function getForest(): Promise<RainForest> {
  if (forestCache && Date.now() - forestCache.trainedAt < CACHE_TTL_MS) {
    return forestCache.forest;
  }
  const rows = await loadTrainingRows();
  const forest = trainRainForest(rows);
  forestCache = { forest, trainedAt: Date.now() };
  return forest;
}

function validateFeatures(x: unknown): Features {
  const f = x as Record<string, unknown>;
  const num = (v: unknown): number => {
    const n = Number(v);
    if (!Number.isFinite(n)) throw new Error("invalid feature value");
    return n;
  };
  return {
    humidity: num(f.humidity),
    temperature_c: num(f.temperature_c),
    pressure_hpa: num(f.pressure_hpa),
    wind_speed_kmh: num(f.wind_speed_kmh),
    cloud_cover_pct: num(f.cloud_cover_pct),
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const url = new URL(req.url);
  const route = url.pathname.replace(/.*\/rain-predict/, "") || "/";

  try {
    // ----------------------------------------------------------------- /predict
    if (route === "/predict" && req.method === "POST") {
      const body = await req.json();
      const features = validateFeatures(body.features ?? body);
      const forest = await getForest();
      const p = predictRain(forest, features);
      const advice = farmerAdvice(p);

      const { error } = await supabase.from("rainfall_predictions").insert({
        humidity: features.humidity,
        temperature_c: features.temperature_c,
        pressure_hpa: features.pressure_hpa,
        wind_speed_kmh: features.wind_speed_kmh,
        cloud_cover_pct: features.cloud_cover_pct,
        rain_probability: p.rain_probability,
        predicted_intensity_mm: p.predicted_intensity_mm,
        advice,
        location_label: body.location_label ?? null,
      });
      if (error) console.warn("insert prediction failed:", error.message);

      return new Response(
        JSON.stringify({
          rain_probability: p.rain_probability,
          predicted_intensity_mm: p.predicted_intensity_mm,
          advice,
          advice_level: adviceLevel(p.rain_probability),
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ----------------------------------------------------------------- /analyze
    if (route === "/analyze" && req.method === "POST") {
      const rows = await loadTrainingRows();
      const forest = trainRainForest(rows);

      // Held-out evaluation: last 20% of rows by date.
      const split = Math.floor(rows.length * 0.8);
      const train = rows.slice(0, split);
      const test = rows.slice(split);
      const evalForest = trainRainForest(train);
      let tp = 0, fp = 0, fn = 0, tn = 0;
      let mmErr = 0;
      for (const r of test) {
        const p = predictRain(evalForest, r);
        const predicted = p.rain_probability > 0.5;
        if (r.rain && predicted) tp++;
        else if (!r.rain && predicted) fp++;
        else if (r.rain && !predicted) fn++;
        else tn++;
        mmErr += Math.abs(p.predicted_intensity_mm - r.rainfall_mm);
      }
      const accuracy = (tp + tn) / test.length;
      const precision = tp + fp ? tp / (tp + fp) : 0;
      const recall = tp + fn ? tp / (tp + fn) : 0;
      const f1 = precision + recall ? (2 * precision * recall) / (precision + recall) : 0;
      const mae = mmErr / test.length;

      // Feature importance via permutation: mean accuracy drop when shuffled.
      const baseAcc = accuracy;
      const importances: Record<string, number> = {};
      for (const key of ["humidity", "temperature_c", "pressure_hpa", "wind_speed_kmh", "cloud_cover_pct"]) {
        const shuffled = test.map((r) => ({ ...r }));
        const idxs = shuffled.map((_, i) => i).sort(() => Math.random() - 0.5);
        const vals = shuffled.map((r) => (r as any)[key]);
        idxs.forEach((origIdx, newIdx) => { (shuffled[newIdx] as any)[key] = vals[origIdx]; });
        let correct = 0;
        for (const r of shuffled) {
          const p = predictRain(evalForest, r);
          if ((p.rain_probability > 0.5) === r.rain) correct++;
        }
        importances[key] = baseAcc - correct / test.length;
      }

      return new Response(
        JSON.stringify({
          n_training_rows: rows.length,
          n_trees: forest.trees.length,
          accuracy,
          precision,
          recall,
          f1,
          mae_mm: mae,
          confusion: { tp, fp, fn, tn },
          feature_importance: importances,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ----------------------------------------------------------------- /historical
    if (route === "/historical" && req.method === "GET") {
      const limit = Math.min(Number(url.searchParams.get("limit") ?? 60), 365);
      const { data, error } = await supabase
        .from("climate_readings")
        .select("reading_date,location,humidity,temperature_c,pressure_hpa,wind_speed_kmh,cloud_cover_pct,rain,rainfall_mm")
        .order("reading_date", { ascending: true })
        .limit(limit);
      if (error) throw new Error(error.message);

      const { data: recentPreds } = await supabase
        .from("rainfall_predictions")
        .select("created_at,humidity,temperature_c,rain_probability,predicted_intensity_mm,advice,location_label")
        .order("created_at", { ascending: false })
        .limit(20);

      return new Response(
        JSON.stringify({ readings: data ?? [], predictions: recentPreds ?? [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ error: `route not found: ${req.method} ${route}` }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

function adviceLevel(p: number): "low" | "moderate" | "high" | "very high" {
  if (p >= 0.75) return "very high";
  if (p >= 0.5) return "high";
  if (p >= 0.25) return "moderate";
  return "low";
}
