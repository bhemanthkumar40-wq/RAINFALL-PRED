import { History } from 'lucide-react';
import type { RecentPrediction } from '@/lib/api';

interface Props {
  predictions: RecentPrediction[];
}

export function HistoryPanel({ predictions }: Props) {
  return (
    <div className="glass-card p-6 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <History className="w-4 h-4 text-rain-500" />
        <h2 className="font-display text-lg font-semibold text-slate-800 dark:text-slate-100">
          Recent forecasts
        </h2>
      </div>

      {predictions.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Forecasts you run will appear here.
        </p>
      ) : (
        <div className="overflow-x-auto -mx-2">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                <th className="px-2 py-2 font-medium">When</th>
                <th className="px-2 py-2 font-medium">Field</th>
                <th className="px-2 py-2 font-medium">Humidity</th>
                <th className="px-2 py-2 font-medium">Rain odds</th>
                <th className="px-2 py-2 font-medium hidden sm:table-cell">Expected</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
              {predictions.map((p, i) => (
                <tr key={i} className="hover:bg-slate-50 dark:hover:bg-white/5">
                  <td className="px-2 py-2 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                    {new Date(p.created_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="px-2 py-2 text-slate-600 dark:text-slate-300">{p.location_label ?? '—'}</td>
                  <td className="px-2 py-2 text-slate-600 dark:text-slate-300">{p.humidity}%</td>
                  <td className="px-2 py-2">
                    <span className={`metric-chip ${p.rain_probability > 0.5 ? 'bg-rain-100 text-rain-700 dark:bg-rain-500/20 dark:text-rain-200' : 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300'}`}>
                      {Math.round(p.rain_probability * 100)}%
                    </span>
                  </td>
                  <td className="px-2 py-2 text-slate-600 dark:text-slate-300 hidden sm:table-cell">
                    {p.predicted_intensity_mm.toFixed(1)} mm
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
