'use client';

import React from 'react';
import { Chart } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  BarElement,
  Filler
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, BarElement, Filler);

export interface ForecastPoint {
  time: string;
  temp: number;
  rain3h: number;
  windSpeed: number;
  windDir: string;
  icon?: string | null;
  description?: string;
  feelsLike?: number;
}

interface Props {
  currentTemp: number;
  forecast: ForecastPoint[];
}

export const WeatherChart: React.FC<Props> = ({ currentTemp, forecast }) => {
  const labels = ['Now', ...forecast.map(p => new Date(p.time).getHours() + ':00')];
  const temps: number[] = [currentTemp, ...forecast.map(p => p.temp)];
  const rain: number[] = [0, ...forecast.map(p => p.rain3h)];
  const wind: number[] = [NaN, ...forecast.map(p => p.windSpeed)];

  type MixedTypes = 'line' | 'bar';

  const data: import('chart.js').ChartData<MixedTypes, number[], string> = {
    labels,
    datasets: [
      {
        type: 'line',
        label: 'Temperature (°C)',
        data: temps,
        tension: 0.35,
        borderColor: '#60a5fa',
        backgroundColor: 'rgba(96,165,250,0.15)',
        fill: true,
        yAxisID: 'y'
      },
      {
        type: 'bar',
        label: 'Rain (mm /3h)',
        data: rain,
        borderRadius: 6,
        backgroundColor: 'rgba(34,197,94,0.55)',
        yAxisID: 'y1'
      },
      {
        type: 'line',
        label: 'Wind (m/s)',
        data: wind,
        spanGaps: true,
        borderColor: '#fbbf24',
        backgroundColor: '#fbbf24',
        borderDash: [4,3],
        pointRadius: 3,
        yAxisID: 'y2'
      }
    ]
  };

  const options: import('chart.js').ChartOptions<MixedTypes> = {
    responsive: true,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { labels: { color: '#e2e8f0' } },
      tooltip: { callbacks: { label: (ctx) => `${ctx.dataset.label}: ${ctx.formattedValue}` } }
    },
    scales: {
      x: { ticks: { color: '#94a3b8' }, grid: { color: '#1e293b' } },
      y: { type: 'linear', position: 'left', ticks: { color: '#93c5fd' }, grid: { color: '#1e293b' } },
      y1: { type: 'linear', position: 'right', ticks: { color: '#4ade80' }, grid: { drawOnChartArea: false } },
      y2: { type: 'linear', position: 'right', ticks: { color: '#fbbf24' }, grid: { drawOnChartArea: false }, offset: true }
    }
  };

  return <Chart type='line' data={data} options={options} />;
};

export default WeatherChart;
