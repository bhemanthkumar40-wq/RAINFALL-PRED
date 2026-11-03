import { useEffect, useMemo, useState } from 'react';
import { CloudRain, Sun, Moon, MapPin, Loader2, LogOut } from 'lucide-react';
import type { Session } from '@supabase/supabase-js';
import { AuthScreen } from '@/components/AuthScreen';
import { supabase } from '@/lib/supabase';

import { useTheme } from '@/hooks/useTheme';
import type { Features } from '@/ml/rainforest';
import {
  fetchPrediction,
  fetchAnalysis,
  fetchHistorical,
  type PredictionResponse,
  type AnalyzeResponse,
  type HistoricalReading,
  type RecentPrediction,
} from '@/lib/api';

import { WeatherCards } from '@/components/WeatherCards';
import { PredictionForm } from '@/components/PredictionForm';
import { TrendChart, RainProbabilityDoughnut } from '@/components/Charts';
import { ModelPanel } from '@/components/ModelPanel';
import { HistoryPanel } from '@/components/HistoryPanel';

const DEFAULT_FEATURES: Features = {
  humidity: 78,
  temperature_c: 18,
  pressure_hpa: 1006,
  wind_speed_kmh: 14,
  cloud_cover_pct: 80,
};

function Dashboard() {
  const [theme, toggleTheme] = useTheme();
  const [features, setFeatures] = useState<Features>(DEFAULT_FEATURES);
  const [prediction, setPrediction] = useState<PredictionResponse | null>(null);
  const [predicting, setPredicting] = useState(false);

  const [analysis, setAnalysis] = useState<AnalyzeResponse | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  const [readings, setReadings] = useState<HistoricalReading[]>([]);
  const [predictions, setPredictions] = useState<RecentPrediction[]>([]);
  const [loadingHist, setLoadingHist] = useState(true);

  const [locationLabel, setLocationLabel] = useState<string | null>(null);
  const [geoStatus, setGeoStatus] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle');

  // ----------------------------------------------------------------- geolocation
  useEffect(() => {
    if (!('geolocation' in navigator)) {
      setGeoStatus('error');
      return;
    }
    setGeoStatus('loading');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeoStatus('ok');
        setLocationLabel(
          `${pos.coords.latitude.toFixed(2)}°, ${pos.coords.longitude.toFixed(2)}°`,
        );
      },
      () => setGeoStatus('error'),
      { timeout: 8000 },
    );
  }, []);

  // ----------------------------------------------------------------- historical load
  const loadHistorical = async () => {
    setLoadingHist(true);
    try {
      const data = await fetchHistorical(60);
      setReadings(data.readings);
      setPredictions(data.predictions);
    } catch (e) {
      // leave empty; UI shows placeholders
      console.warn('historical load failed', e);
    } finally {
      setLoadingHist(false);
    }
  };

  useEffect(() => { loadHistorical(); }, []);

  // ----------------------------------------------------------------- actions
  const runPrediction = async () => {
    setPredicting(true);
    try {
      const p = await fetchPrediction(features, locationLabel);
      setPrediction(p);
      // refresh recent-prediction list
      void loadHistorical();
    } catch (e) {
      console.error(e);
      alert('Forecast failed. The weather service may be starting up — try again in a moment.');
    } finally {
      setPredicting(false);
    }
  };

  const runAnalysis = async () => {
    setAnalyzing(true);
    setAnalysisError(null);
    try {
      const a = await fetchAnalysis();
      setAnalysis(a);
    } catch (e) {
      setAnalysisError(e instanceof Error ? e.message : 'Analysis failed');
    } finally {
      setAnalyzing(false);
    }
  };

  // ----------------------------------------------------------------- chart data
  const trendData = useMemo(() => {
    const labels = readings.map((r) => new Date(r.reading_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }));
    const humidity = readings.map((r) => Number(r.humidity));
    const rainfall = readings.map((r) => Number(r.rainfall_mm));
    return { labels, humidity, rainfall };
  }, [readings]);

  const rainDayCount = useMemo(() => readings.filter((r) => r.rain).length, [readings]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-rain-50/40 to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-rain-900/40 text-slate-800 dark:text-slate-100">
      {/* Header */}
      <header className="sticky top-0 z-20 backdrop-blur-xl bg-white/60 dark:bg-slate-950/60 border-b border-slate-200/60 dark:border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative w-10 h-10 rounded-xl bg-gradient-to-br from-rain-500 to-rain-700 grid place-items-center shadow-glow">
              <CloudRain className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-display font-bold text-base sm:text-lg leading-none">
                Rainfall Analysis & Rain Prediction
              </h1>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Plain-language rain odds for planting, irrigation & harvest
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { void supabase.auth.signOut(); }}
              className="h-9 rounded-xl border border-slate-200 dark:border-white/10 px-3 flex items-center gap-2 text-xs hover:bg-slate-100 dark:hover:bg-white/5"
              aria-label="Sign out"
            >
              <LogOut className="w-4 h-4" /><span>Sign out</span>
            </button>
            <button
              onClick={() => toggleTheme()}
              className="w-9 h-9 rounded-xl border border-slate-200 dark:border-white/10 grid place-items-center hover:bg-slate-100 dark:hover:bg-white/5"
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Hero / trend */}
        <section className="lg:col-span-12">
          <div className="glass-card relative overflow-hidden p-6 sm:p-8 bg-gradient-to-br from-rain-600/90 to-rain-800 text-white">
            <div className="rain-bg" aria-hidden />
            <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              <div className="max-w-2xl">
                <div className="metric-chip bg-white/15 text-white">
                  <MapPin className="w-3 h-3" />
                  {locationLabel ?? 'Set your field location'}
                </div>
                <h2 className="mt-3 font-display text-2xl sm:text-3xl font-bold leading-tight">
                  Will it rain on your fields today?
                </h2>
                <p className="mt-2 text-sm sm:text-base text-rain-100/90 leading-relaxed">
                  Our model reads humidity, temperature, pressure, wind, and cloud cover,
                  then turns them into a clear yes/no for irrigation and harvest planning.
                </p>
                <div className="mt-4 flex flex-wrap gap-2 text-xs">
                  <span className="metric-chip bg-white/15 text-white">{readings.length} days of data</span>
                  <span className="metric-chip bg-white/15 text-white">{rainDayCount} rain days</span>
                  <span className="metric-chip bg-white/15 text-white">60-tree random forest</span>
                </div>
              </div>

              <div className="w-full lg:w-64 flex-shrink-0">
                <div className="relative h-44 w-44 mx-auto">
                  {prediction ? (
                    <div className="relative h-full w-full">
                      <RainProbabilityDoughnut probability={prediction.rain_probability} />
                      <div className="absolute inset-0 grid place-items-center pointer-events-none">
                        <div className="text-center">
                          <div className="text-3xl font-display font-bold">
                            {Math.round(prediction.rain_probability * 100)}%
                          </div>
                          <div className="text-xs text-rain-100">rain odds</div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="h-full w-full grid place-items-center text-rain-100/80 text-sm">
                      {loadingHist ? <Loader2 className="w-6 h-6 animate-spin" /> : 'Run a forecast →'}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Inputs */}
        <section className="lg:col-span-5 xl:col-span-4 animate-fade-up">
          <PredictionForm
            features={features}
            setFeatures={setFeatures}
            onPredict={runPrediction}
            prediction={prediction}
            loading={predicting}
            locationLabel={locationLabel}
            setLocationLabel={setLocationLabel}
            geoStatus={geoStatus}
          />
        </section>

        {/* Weather cards + trend */}
        <section className="lg:col-span-7 xl:col-span-8 flex flex-col gap-5 animate-fade-up">
          <WeatherCards features={features} prediction={prediction} />
          <div className="glass-card p-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-display text-lg font-semibold">60-day climate trend</h2>
              <span className="text-xs text-slate-500 dark:text-slate-400">humidity & rainfall</span>
            </div>
            <div className="h-72">
              <TrendChart
                labels={trendData.labels}
                humidity={trendData.humidity}
                rainfall={trendData.rainfall}
              />
            </div>
          </div>
        </section>

        {/* Model panel */}
        <section className="lg:col-span-6 animate-fade-up">
          <ModelPanel
            analysis={analysis}
            loading={analyzing}
            error={analysisError}
            onRun={runAnalysis}
          />
        </section>

        {/* History */}
        <section className="lg:col-span-6 animate-fade-up">
          <HistoryPanel predictions={predictions} />
        </section>
      </main>

      <footer className="max-w-7xl mx-auto px-4 sm:px-6 py-6 text-center text-xs text-slate-500 dark:text-slate-400">
        Rain analysis for farmers & growers · forecasts are model estimates, not official weather warnings.
      </footer>
    </div>
  );
}


// Keep the dashboard private until Supabase confirms an authenticated session.
export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      if (error) console.error('Could not read auth session:', error.message);
      setSession(data.session);
      setCheckingSession(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setCheckingSession(false);
    });
    return () => { active = false; subscription.unsubscribe(); };
  }, []);

  if (checkingSession) {
    return <div className="min-h-screen bg-slate-950 text-white grid place-items-center"><div className="flex items-center gap-3 text-sm text-slate-300"><Loader2 className="w-5 h-5 animate-spin" />Checking your session…</div></div>;
  }
  if (!session) return <AuthScreen onAuthenticated={() => { /* auth state listener updates the screen */ }} />;
  return <Dashboard />;
}
