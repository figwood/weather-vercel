'use client';

import React from 'react';
import useSWR from 'swr';
import WeatherChart from '../components/WeatherChart';
import MonthlyTempChart from '../components/MonthlyTempChart';

const fetcher = (url: string) => fetch(url).then(r => r.json());

export default function DetailedClient() {
  const { data, error, isLoading } = useSWR<any>('/api/weather', fetcher, { revalidateOnFocus: false });

  return (
    <main>
      <h1>Calgary Weather Details</h1>
      <p className="muted">Daily cached snapshot + forecast breakdown.</p>
      {isLoading && <p>Loading…</p>}
      {error && <p className="error">Failed to load.</p>}
      {data && !data.error && (
        <>
          <div className="panel">
            <h2>24h Forecast</h2>
            <WeatherChart currentTemp={data.currentTemp} forecast={data.forecast} />
          </div>
          <div className="panel" style={{ marginTop: '2rem' }}>
            <h2>Monthly Temperatures</h2>
            <MonthlyTempChart todaysMax={data.maxTemp} todaysMin={data.minTemp} city={data.location || 'Calgary'} units={(data.units || 'metric')} />
          </div>
          <div className="panel" style={{ marginTop: '2rem' }}>
            <h2>Meta</h2>
            <pre style={{ fontSize: '.75rem', background:'#0f172a', padding:'.75rem 1rem', borderRadius:8, border:'1px solid #334155', overflow:'auto' }}>{JSON.stringify({ humidity: data.humidity, pressure: data.pressure, wind: data.wind }, null, 2)}</pre>
          </div>
        </>
      )}
      <div className="footer"><a href="/">Home</a></div>
    </main>
  );
}
