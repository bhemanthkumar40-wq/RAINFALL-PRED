// Shared API client for the rain-predict edge function.
import type { Features } from '@/ml/rainforest';

const EDGE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/rain-predict`;
const headers = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
  apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
});

export interface PredictionResponse {
  rain_probability: number;
  predicted_intensity_mm: number;
  advice: string;
  advice_level: 'low' | 'moderate' | 'high' | 'very high';
}

export interface HistoricalReading {
  reading_date: string;
  location: string;
  humidity: number;
  temperature_c: number;
  pressure_hpa: number;
  wind_speed_kmh: number;
  cloud_cover_pct: number;
  rain: boolean;
  rainfall_mm: number;
}

export interface RecentPrediction {
  created_at: string;
  humidity: number;
  temperature_c: number;
  rain_probability: number;
  predicted_intensity_mm: number;
  advice: string;
  location_label: string | null;
}

export interface HistoricalResponse {
  readings: HistoricalReading[];
  predictions: RecentPrediction[];
}

export interface AnalyzeResponse {
  n_training_rows: number;
  n_trees: number;
  accuracy: number;
  precision: number;
  recall: number;
  f1: number;
  mae_mm: number;
  confusion: { tp: number; fp: number; fn: number; tn: number };
  feature_importance: Record<string, number>;
}

export async function fetchPrediction(
  features: Features,
  locationLabel: string | null,
): Promise<PredictionResponse> {
  const res = await fetch(`${EDGE_URL}/predict`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ features, location_label: locationLabel }),
  });
  if (!res.ok) throw new Error(`Predict failed (${res.status})`);
  return (await res.json()) as PredictionResponse;
}

export async function fetchAnalysis(): Promise<AnalyzeResponse> {
  const res = await fetch(`${EDGE_URL}/analyze`, {
    method: 'POST',
    headers: headers(),
  });
  if (!res.ok) throw new Error(`Analyze failed (${res.status})`);
  return (await res.json()) as AnalyzeResponse;
}

export async function fetchHistorical(limit = 60): Promise<HistoricalResponse> {
  const res = await fetch(`${EDGE_URL}/historical?limit=${limit}`, {
    headers: headers(),
  });
  if (!res.ok) throw new Error(`Historical failed (${res.status})`);
  return (await res.json()) as HistoricalResponse;
}
