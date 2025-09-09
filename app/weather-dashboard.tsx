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
  const [city, setCity] = useState('Calgary');
  const [units, setUnits] = useState<'metric' | 'imperial' | 'standard'>('metric');
  const [refreshToken, setRefreshToken] = useState(0); // change to force SWR revalidate with refresh=1

  const REFRESH_TOKEN = '58X3KMMmvnY2ZjW';
  const query = `/api/weather?city=${encodeURIComponent(city)}&units=${units}` + (refreshToken ? `&refresh=${REFRESH_TOKEN}&_=${refreshToken}` : '');
  const { data, error, isLoading, mutate } = useSWR<WeatherResponse>(query, fetcher, { revalidateOnFocus: false, revalidateIfStale: false, revalidateOnReconnect: false });

  const [now, setNow] = useState(() => new Date());
  const formatTime = (d: Date) => d.toLocaleTimeString('en-CA', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  const windArrowStyle = { transform: `rotate(${data?.wind?.deg ?? 0}deg)` };

  const unitTempSymbol = units === 'imperial' ? '°F' : '°C';
  const windSpeedUnit = units === 'imperial' ? 'mph' : 'm/s';

  const handleForceRefresh = () => {
    setRefreshToken(Date.now());
    mutate();
  };

  const sampleCities = ['Calgary','Vancouver','Toronto','Edmonton','Winnipeg','Montreal'];

  return (
    <main>
      <h1>{city} Weather</h1>
      <p className="muted" suppressHydrationWarning>Snapshot (KV cached). Local time: {formatTime(now)}.</p>
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
        <label style={{ display: 'flex', flexDirection: 'column', fontSize: '0.8rem' }}>City
          <input value={city} onChange={e => setCity(e.target.value)} placeholder="City" style={{ padding: '4px 8px', minWidth: '140px' }} />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', fontSize: '0.8rem' }}>Quick
          <select value={city} onChange={e => setCity(e.target.value)} style={{ padding: '4px 8px' }}>
            {sampleCities.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', fontSize: '0.8rem' }}>Units
          <select value={units} onChange={e => setUnits(e.target.value as any)} style={{ padding: '4px 8px' }}>
            <option value="metric">Metric (°C,m/s)</option>
            <option value="imperial">Imperial (°F,mph)</option>
            <option value="standard">Standard (K,m/s)</option>
          </select>
        </label>
  {/* Force Refresh button hidden per request */}
      </div>
      {isLoading && <p>Loading data…</p>}
      {error && <p className="error">Failed to load.</p>}
      {data?.error && <p className="error">API Error: {data.error}</p>}
      {data && !data.error && (
        <>
          <div className="card-grid">
            <div className="card">
              <div className="label">Current</div>
              <div className="value">{Math.round(data.currentTemp)}{unitTempSymbol}</div>
              <div className="muted">{data.description}</div>
            </div>
            <div className="card">
              <div className="label">High / Low</div>
              <div className="value">{Math.round(data.maxTemp)}{unitTempSymbol} / {Math.round(data.minTemp)}{unitTempSymbol}</div>
              <div className="muted">Next 24h (current main)</div>
            </div>
            <div className="card">
              <div className="label">Wind</div>
              <div className="value">{data.wind.speed?.toFixed(1)} {windSpeedUnit}</div>
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
            <MonthlyTempChart todaysMax={data.maxTemp} todaysMin={data.minTemp} city={city} units={units} />
          </div>
        </>
      )}
      <div className="footer">Data from OpenWeatherMap. Built with Next.js & Chart.js. Deploy on Vercel.</div>
    </main>
  );
}
