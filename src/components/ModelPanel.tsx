import { Loader2, Activity, Target, Gauge as GaugeIcon } from 'lucide-react';
import type { AnalyzeResponse } from '@/lib/api';
import { FeatureImportanceChart } from './Charts';

interface Props {
  analysis: AnalyzeResponse | null;
  loading: boolean;
  error: string | null;
  onRun: () => void;
}

export function ModelPanel({ analysis, loading, error, onRun }: Props) {
  return (
    <div className="glass-card p-6 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-rain-500" />
          <h2 className="font-display text-lg font-semibold text-slate-800 dark:text-slate-100">
            Model performance
          </h2>
        </div>
        <button
          onClick={onRun}
          disabled={loading}
          className="text-xs rounded-lg border border-slate-200 dark:border-white/10 px-3 py-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 disabled:opacity-60"
        >
          {loading ? 'Running…' : analysis ? 'Re-run' : 'Run analysis'}
        </button>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
          <Loader2 className="w-4 h-4 animate-spin" /> Training a 60-tree forest on the historical data…
        </div>
      )}

      {error && !loading && (
        <div className="text-sm text-red-500">{error}</div>
      )}

      {!loading && !analysis && !error && (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Runs a held-out evaluation to show accuracy, precision, recall, and which
          climate factors drive the model's calls.
        </p>
      )}

      {analysis && !loading && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Metric icon={Target} label="Accuracy" value={`${(analysis.accuracy * 100).toFixed(1)}%`} />
            <Metric icon={Activity} label="Precision" value={`${(analysis.precision * 100).toFixed(0)}%`} />
            <Metric icon={Activity} label="Recall" value={`${(analysis.recall * 100).toFixed(0)}%`} />
            <Metric icon={GaugeIcon} label="F1 score" value={analysis.f1.toFixed(2)} />
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-white/10 p-3">
            <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1">
              Feature importance (what drives rain)
            </div>
            <div className="h-44">
              <FeatureImportanceChart importance={analysis.feature_importance} />
            </div>
          </div>

          <div className="text-xs text-slate-500 dark:text-slate-400 flex flex-wrap gap-x-4 gap-y-1">
            <span>{analysis.n_training_rows} training rows</span>
            <span>· {analysis.n_trees} trees</span>
            <span>· rainfall error ±{analysis.mae_mm.toFixed(1)} mm</span>
          </div>
        </>
      )}
    </div>
  );
}

function Metric({ icon: Icon, label, value }: { icon: typeof Target; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-white/40 dark:bg-white/5 p-3">
      <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
        <Icon className="w-3.5 h-3.5" /> {label}
      </div>
      <div className="mt-1 text-xl font-display font-semibold text-slate-800 dark:text-slate-100">{value}</div>
    </div>
  );
}
