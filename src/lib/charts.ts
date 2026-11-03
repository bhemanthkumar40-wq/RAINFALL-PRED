import {
  Chart,
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Tooltip,
  Filler,
  BarController,
  BarElement,
  DoughnutController,
  ArcElement,
  Legend,
} from 'chart.js';

let registered = false;

export function registerCharts(): void {
  if (registered) return;
  Chart.register(
    LineController,
    LineElement,
    PointElement,
    LinearScale,
    CategoryScale,
    Tooltip,
    Filler,
    BarController,
    BarElement,
    DoughnutController,
    ArcElement,
    Legend,
  );
  registered = true;
}

export const chartColors = {
  rain: '#3479f6',
  rainSoft: 'rgba(52, 121, 246, 0.18)',
  rainLine: '#205be0',
  humidity: '#5fd4d4',
  temp: '#f59e0b',
  cloud: '#94a3b8',
  grid: 'rgba(148, 163, 184, 0.18)',
  text: 'rgba(148, 163, 184, 0.9)',
};
