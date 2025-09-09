'use client';

import React, { useEffect, useState } from 'react';
import useSWR from 'swr';
import WeatherChart from './components/WeatherChart';
import MonthlyTempChart from './components/MonthlyTempChart';

interface WeatherResponse {
  location: string;
  description: string;
  currentTemp: number;
  minTemp: number;
  maxTemp: number;
  wind: { speed: number; deg: number; direction: string };
  rainLastPeriod: number;
  forecast: any[];
  icon?: string | null;
  humidity?: number;
  pressure?: number;
  ts: string;
  error?: string;
}

const fetcher = (url: string) => fetch(url).then(r => r.json());

export default function WeatherDashboard() {
  // Fetch once per load; no auto refresh (API cached daily)
  const { data, error, isLoading } = useSWR<WeatherResponse>('/api/weather', fetcher, { revalidateOnFocus: false, revalidateIfStale: false, revalidateOnReconnect: false });

  const [now, setNow] = useState(() => new Date());
  const formatTime = (d: Date) => d.toLocaleTimeString('en-CA', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  const windArrowStyle = { transform: `rotate(${data?.wind?.deg ?? 0}deg)` };

  return (
    <main>
      <h1>Calgary Weather</h1>
  <p className="muted" suppressHydrationWarning>Daily snapshot (cached). Local time: {formatTime(now)}.</p>
      {isLoading && <p>Loading data…</p>}
      {error && <p className="error">Failed to load.</p>}
      {data?.error && <p className="error">API Error: {data.error}</p>}
      {data && !data.error && (
        <>
          <div className="card-grid">
            <div className="card">
              <div className="label">Current</div>
              <div className="value">{Math.round(data.currentTemp)}°C</div>
              <div className="muted">{data.description}</div>
            </div>
            <div className="card">
              <div className="label">High / Low</div>
              <div className="value">{Math.round(data.maxTemp)}° / {Math.round(data.minTemp)}°</div>
              <div className="muted">Next 24h (current main)</div>
            </div>
            <div className="card">
              <div className="label">Wind</div>
              <div className="value">{data.wind.speed?.toFixed(1)} m/s</div>
              <div className="muted flex"><span className="wind-arrow" style={windArrowStyle}>🡱</span>{data.wind.direction} ({data.wind.deg}°)</div>
            </div>
            <div className="card">
              <div className="label">Rain (recent)</div>
              <div className="value">{data.rainLastPeriod?.toFixed(1)} mm</div>
              <div className="muted">Past 1-3h</div>
            </div>
            <div className="card">
              <div className="label">Humidity</div>
              <div className="value">{data.humidity}%</div>
              <div className="muted">Relative</div>
            </div>
          </div>
          <div className="panel">
            <h2>Next 24 Hours</h2>
            <WeatherChart currentTemp={data.currentTemp} forecast={data.forecast} />
          </div>
          <div className="panel" style={{ marginTop: '2rem' }}>
            <h2>Monthly Temperatures</h2>
            <MonthlyTempChart todaysMax={data.maxTemp} todaysMin={data.minTemp} />
          </div>
        </>
      )}
      <div className="footer">Data from OpenWeatherMap. Built with Next.js & Chart.js. Deploy on Vercel.</div>
    </main>
  );
}
