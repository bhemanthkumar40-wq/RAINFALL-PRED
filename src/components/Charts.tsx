import { useEffect, useRef } from 'react';
import {
  Chart,
  type ChartConfiguration,
} from 'chart.js';
import { chartColors, registerCharts } from '@/lib/charts';

interface Props {
  humidity: number[];
  rainfall: number[];
  labels: string[];
}

// Humidity vs rainfall trend line chart.
export function TrendChart({ humidity, rainfall, labels }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);

  useEffect(() => {
    registerCharts();
    const el = canvasRef.current;
    if (!el) return;

    const config: ChartConfiguration = {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Humidity (%)',
            data: humidity,
            borderColor: chartColors.humidity,
            backgroundColor: 'rgba(95, 212, 212, 0.12)',
            yAxisID: 'y',
            tension: 0.35,
            fill: true,
            pointRadius: 0,
            borderWidth: 2,
          },
          {
            label: 'Rainfall (mm)',
            data: rainfall,
            borderColor: chartColors.rain,
            backgroundColor: chartColors.rainSoft,
            yAxisID: 'y1',
            tension: 0.35,
            fill: true,
            pointRadius: 0,
            borderWidth: 2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { labels: { color: chartColors.text, usePointStyle: true, padding: 16 } },
        },
        scales: {
          x: { grid: { color: chartColors.grid }, ticks: { color: chartColors.text, maxRotation: 0, autoSkipPadding: 16 } },
          y: { position: 'left', grid: { color: chartColors.grid }, ticks: { color: chartColors.humidity, callback: (v) => `${v}%` }, min: 0, max: 100 },
          y1: { position: 'right', grid: { drawOnChartArea: false }, ticks: { color: chartColors.rain, callback: (v) => `${v}mm` }, min: 0 },
        },
      },
    };

    chartRef.current = new Chart(el, config);
    return () => { chartRef.current?.destroy(); };
  }, [humidity, rainfall, labels]);

  return <canvas ref={canvasRef} />;
}

interface FeatureImportanceProps {
  importance: Record<string, number>;
}

export function FeatureImportanceChart({ importance }: FeatureImportanceProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);

  useEffect(() => {
    registerCharts();
    const el = canvasRef.current;
    if (!el) return;
    const entries = Object.entries(importance)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5);
    const labels = entries.map(([k]) => prettyFeature(k));
    const data = entries.map(([, v]) => Number((v * 100).toFixed(1)));

    chartRef.current = new Chart(el, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: [chartColors.rain, chartColors.humidity, chartColors.temp, chartColors.cloud, chartColors.rainLine],
          borderRadius: 8,
          barThickness: 18,
        }],
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => `${c.parsed.x}% influence` } } },
        scales: {
          x: { grid: { color: chartColors.grid }, ticks: { color: chartColors.text, callback: (v) => `${v}%` } },
          y: { grid: { display: false }, ticks: { color: chartColors.text } },
        },
      },
    });
    return () => { chartRef.current?.destroy(); };
  }, [importance]);

  return <canvas ref={canvasRef} />;
}

export function RainProbabilityDoughnut({ probability }: { probability: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);

  useEffect(() => {
    registerCharts();
    const el = canvasRef.current;
    if (!el) return;
    chartRef.current = new Chart(el, {
      type: 'doughnut',
      data: {
        labels: ['Rain likely', 'Dry'],
        datasets: [{
          data: [probability * 100, (1 - probability) * 100],
          backgroundColor: [chartColors.rain, 'rgba(148, 163, 184, 0.25)'],
          borderWidth: 0,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '72%',
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => `${c.parsed.toFixed(0)}%` } } },
      },
    });
    return () => { chartRef.current?.destroy(); };
  }, [probability]);

  return <canvas ref={canvasRef} />;
}

function prettyFeature(k: string): string {
  switch (k) {
    case 'humidity': return 'Humidity';
    case 'temperature_c': return 'Temperature';
    case 'pressure_hpa': return 'Pressure';
    case 'wind_speed_kmh': return 'Wind speed';
    case 'cloud_cover_pct': return 'Cloud cover';
    default: return k;
  }
}
