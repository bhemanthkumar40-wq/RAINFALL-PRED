import { CloudRain, Droplets, Gauge, Wind, Cloud, Thermometer } from 'lucide-react';
import type { Features } from '@/ml/rainforest';
import type { PredictionResponse } from '@/lib/api';

interface Props {
  features: Features;
  prediction: PredictionResponse | null;
}

const cards = (f: Features) => [
  { icon: Droplets, label: 'Humidity', value: `${f.humidity}%`, hint: 'high raises rain odds', tone: 'aqua' as const },
  { icon: Thermometer, label: 'Temperature', value: `${f.temperature_c}°C`, hint: 'cooler air holds less rain', tone: 'amber' as const },
  { icon: Gauge, label: 'Pressure', value: `${f.pressure_hpa} hPa`, hint: 'low pressure pulls rain in', tone: 'violet' as const },
  { icon: Wind, label: 'Wind speed', value: `${f.wind_speed_kmh} km/h`, hint: 'fetches weather systems', tone: 'teal' as const },
  { icon: Cloud, label: 'Cloud cover', value: `${f.cloud_cover_pct}%`, hint: 'overcast sky = rain ready', tone: 'slate' as const },
];

export function WeatherCards({ features, prediction }: Props) {
  const items = cards(features);
  const toneClasses: Record<string, string> = {
    aqua: 'from-cyan-400/20 to-cyan-500/5 text-cyan-500 dark:text-cyan-300',
    amber: 'from-amber-400/20 to-amber-500/5 text-amber-500 dark:text-amber-300',
    violet: 'from-violet-400/20 to-violet-500/5 text-violet-500 dark:text-violet-300',
    teal: 'from-teal-400/20 to-teal-500/5 text-teal-500 dark:text-teal-300',
    slate: 'from-slate-400/20 to-slate-500/5 text-slate-500 dark:text-slate-300',
  };

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {items.map((c) => (
        <div
          key={c.label}
          className="glass-card p-4 flex flex-col gap-2 animate-fade-up hover:-translate-y-1 transition-transform duration-200"
        >
          <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${toneClasses[c.tone]} grid place-items-center`}>
            <c.icon className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{c.label}</div>
            <div className="text-xl font-display font-semibold text-slate-800 dark:text-slate-100">{c.value}</div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{c.hint}</div>
          </div>
        </div>
      ))}

      {/* Rain odds card spans last column on large screens */}
      <div className="glass-card col-span-2 sm:col-span-3 lg:col-span-5 p-4 flex items-center gap-4 bg-gradient-to-r from-rain-500/15 to-transparent">
        <div className="w-12 h-12 rounded-xl bg-rain-500/20 grid place-items-center text-rain-500 dark:text-rain-300">
          <CloudRain className="w-6 h-6" />
        </div>
        <div className="flex-1">
          <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Rain odds</div>
          {prediction ? (
            <>
              <div className="text-2xl font-display font-bold text-slate-800 dark:text-slate-100">
                {Math.round(prediction.rain_probability * 100)}%
                <span className="text-base font-medium text-slate-500 dark:text-slate-400 ml-2">
                  · ~{prediction.predicted_intensity_mm.toFixed(1)} mm expected
                </span>
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">{prediction.advice}</div>
            </>
          ) : (
            <div className="text-sm text-slate-500 dark:text-slate-400">Adjust the inputs and run a forecast.</div>
          )}
        </div>
      </div>
    </div>
  );
}
