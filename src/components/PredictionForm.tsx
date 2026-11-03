import { useState } from 'react';
import { MapPin, RefreshCw, Loader2, Play } from 'lucide-react';
import type { Features } from '@/ml/rainforest';
import type { PredictionResponse } from '@/lib/api';

interface Props {
  features: Features;
  setFeatures: (f: Features) => void;
  onPredict: () => void;
  prediction: PredictionResponse | null;
  loading: boolean;
  locationLabel: string | null;
  setLocationLabel: (s: string | null) => void;
  geoStatus: 'idle' | 'loading' | 'ok' | 'error';
}

const SLIDERS: { key: keyof Features; min: number; max: number; step: number; unit: string; label: string }[] = [
  { key: 'humidity', min: 0, max: 100, step: 1, unit: '%', label: 'Humidity' },
  { key: 'temperature_c', min: -5, max: 45, step: 0.5, unit: '°C', label: 'Temperature' },
  { key: 'pressure_hpa', min: 980, max: 1040, step: 0.5, unit: 'hPa', label: 'Pressure' },
  { key: 'wind_speed_kmh', min: 0, max: 60, step: 0.5, unit: 'km/h', label: 'Wind speed' },
  { key: 'cloud_cover_pct', min: 0, max: 100, step: 1, unit: '%', label: 'Cloud cover' },
];

export function PredictionForm({
  features,
  setFeatures,
  onPredict,
  prediction,
  loading,
  locationLabel,
  setLocationLabel,
  geoStatus,
}: Props) {
  const [touched, setTouched] = useState(false);

  return (
    <div className="glass-card p-6 flex flex-col gap-5">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="font-display text-lg font-semibold text-slate-800 dark:text-slate-100">
            Today's field readings
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Slide each value to what you measure, then forecast rain odds.
          </p>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
          {geoStatus === 'loading' && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          {geoStatus === 'ok' && <MapPin className="w-3.5 h-3.5 text-rain-500" />}
          {geoStatus === 'error' && <MapPin className="w-3.5 h-3.5 text-amber-500" />}
          <span>
            {geoStatus === 'idle' && 'No location set'}
            {geoStatus === 'loading' && 'Locating…'}
            {geoStatus === 'ok' && 'Location on'}
            {geoStatus === 'error' && 'Location blocked'}
          </span>
        </div>
      </div>

      <input
        type="text"
        placeholder="Field label (e.g. North orchard)"
        value={locationLabel ?? ''}
        onChange={(e) => setLocationLabel(e.target.value || null)}
        className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white/60 dark:bg-white/5 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-rain-500/60"
      />

      <div className="space-y-4">
        {SLIDERS.map((s) => (
          <div key={s.key}>
            <div className="flex items-center justify-between text-sm mb-1.5">
              <span className="text-slate-600 dark:text-slate-300">{s.label}</span>
              <span className="font-mono text-rain-600 dark:text-rain-300 font-medium">
                {features[s.key]}{s.unit}
              </span>
            </div>
            <input
              type="range"
              min={s.min}
              max={s.max}
              step={s.step}
              value={features[s.key]}
              onChange={(e) => {
                setTouched(true);
                setFeatures({ ...features, [s.key]: Number(e.target.value) });
              }}
              className="w-full"
            />
          </div>
        ))}
      </div>

      <button
        onClick={() => { setTouched(true); onPredict(); }}
        disabled={loading}
        className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-rain-600 hover:bg-rain-700 disabled:opacity-60 text-white font-medium px-4 py-3 shadow-glow transition-colors"
      >
        {loading ? (
          <><Loader2 className="w-4 h-4 animate-spin" /> Forecasting…</>
        ) : (
          <><Play className="w-4 h-4" /> Forecast rain odds</>
        )}
      </button>

      {prediction && touched && (
        <div className="rounded-xl bg-rain-50 dark:bg-rain-500/10 border border-rain-200 dark:border-rain-500/20 p-4 animate-fade-up">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wide text-rain-600 dark:text-rain-300">
              {prediction.advice_level} chance
            </span>
            <RefreshCw className="w-3.5 h-3.5 text-rain-500" />
          </div>
          <div className="mt-1 text-3xl font-display font-bold text-rain-700 dark:text-rain-200">
            {Math.round(prediction.rain_probability * 100)}%
          </div>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            {prediction.advice}
          </p>
          <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            Expected rainfall ~{prediction.predicted_intensity_mm.toFixed(1)} mm.
          </div>
        </div>
      )}
    </div>
  );
}
