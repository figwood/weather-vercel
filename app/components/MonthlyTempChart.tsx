'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Chart } from 'react-chartjs-2';
import { Chart as ChartJS, registerables } from 'chart.js';

// Register everything to avoid missing controller errors in production (line, bar...).
ChartJS.register(...registerables);

interface Props {
  todaysMax: number;
  todaysMin: number;
  city: string;
  units: 'metric' | 'imperial' | 'standard';
}

interface DayRecord { day: number; max: number; min: number; ts?: string }

export default function MonthlyTempChart({ todaysMax, todaysMin, city, units }: Props) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const currentDay = now.getDate();

  const [year, setYear] = useState<number>(currentYear);
  const [month, setMonth] = useState<number>(currentMonth); // 0-based
  const [records, setRecords] = useState<DayRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load records for selected year/month (from server KV)
  useEffect(() => {
    let aborted = false;
    async function load() {
      setLoading(true); setError(null);
      try {
        const y = year; const m = month + 1; // API expects 1-12
  const res = await fetch(`/api/history?city=${encodeURIComponent(city)}&units=${units}&year=${y}&month=${m}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (aborted) return;
        const days = json.days || {};
        const rows: DayRecord[] = Object.entries(days).map(([d, v]: any) => ({ day: Number(d), max: v.max, min: v.min, ts: v.ts }));
        setRecords(rows.sort((a,b)=>a.day-b.day));
      } catch (e:any) {
        if (!aborted) setError(e.message || 'Failed');
      } finally {
        if (!aborted) setLoading(false);
      }
    }
    load();
    return () => { aborted = true; };
  }, [year, month]);

  // Auto save today's record if current month/year and not existing or changed
  useEffect(() => {
    if (year !== currentYear || month !== currentMonth) return;
    const existing = records.find(r => r.day === currentDay);
    if (existing && existing.max === todaysMax && existing.min === todaysMin) return;
  (async () => {
      try {
    await fetch(`/api/history?city=${encodeURIComponent(city)}&units=${units}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ day: currentDay, max: todaysMax, min: todaysMin })
        });
      } catch {}
    })();
  }, [year, month, records, todaysMax, todaysMin, currentYear, currentMonth, currentDay, city, units]);

  const daysInMonth = useMemo(() => new Date(year, month + 1, 0).getDate(), [year, month]);
  const labels = Array.from({ length: daysInMonth }, (_, i) => (i + 1).toString());

  const maxSeries = labels.map(l => {
    const rec = records.find(r => r.day === Number(l));
    return rec ? rec.max : null;
  });
  const minSeries = labels.map(l => {
    const rec = records.find(r => r.day === Number(l));
    return rec ? rec.min : null;
  });

  const data = {
    labels,
    datasets: [
      {
        label: units === 'imperial' ? 'Max (°F)' : units === 'standard' ? 'Max (K)' : 'Max (°C)',
        data: maxSeries,
        borderColor: '#ef4444',
        backgroundColor: 'rgba(239,68,68,0.2)',
        spanGaps: true,
        tension: 0.25
      },
      {
        label: units === 'imperial' ? 'Min (°F)' : units === 'standard' ? 'Min (K)' : 'Min (°C)',
        data: minSeries,
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59,130,246,0.2)',
        spanGaps: true,
        tension: 0.25
      }
    ]
  };

  const options: any = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { labels: { color: '#e2e8f0' } },
      tooltip: { intersect: false, mode: 'index' }
    },
    scales: {
      x: { ticks: { color: '#94a3b8' }, grid: { color: '#1e293b' } },
      y: { ticks: { color: '#94a3b8' }, grid: { color: '#1e293b' } }
    }
  };

  const hasData = maxSeries.some(v => v !== null) || minSeries.some(v => v !== null);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '.75rem' }}>
      <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <label style={{ fontSize: '.75rem', opacity: .7 }}>Year
          <select value={year} onChange={e => setYear(Number(e.target.value))} style={{ marginLeft: '.35rem', background:'#1e293b', color:'#f1f5f9', border:'1px solid #334155', borderRadius:6, padding:'.3rem .45rem' }}>
            {Array.from({ length: 5 }, (_, i) => currentYear - i).map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </label>
        <label style={{ fontSize: '.75rem', opacity: .7 }}>Month
          <select value={month} onChange={e => setMonth(Number(e.target.value))} style={{ marginLeft: '.35rem', background:'#1e293b', color:'#f1f5f9', border:'1px solid #334155', borderRadius:6, padding:'.3rem .45rem' }}>
            {Array.from({ length: 12 }, (_, i) => i).map(m => <option key={m} value={m}>{m+1}</option>)}
          </select>
        </label>
        <span className="muted" style={{ fontSize: '.65rem' }}>
          {loading ? 'Loading history…' : error ? 'History load failed' : 'Persisted (KV) · auto saves today'}
        </span>
      </div>
      <div style={{ position: 'relative', width: '100%', minHeight: 320 }}>
        {hasData && <Chart type="line" data={data} options={options} />}
        {!loading && !error && !hasData && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, opacity: .6 }}>
            No data yet for this month.
          </div>
        )}
        {error && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: '#f87171' }}>
            Error loading history.
          </div>
        )}
      </div>
    </div>
  );
}
