'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Chart } from 'react-chartjs-2';
import { Chart as ChartJS, registerables } from 'chart.js';

// Register everything to avoid missing controller errors in production (line, bar...).
ChartJS.register(...registerables);

interface Props {
  todaysMax: number;
  todaysMin: number;
}

interface DayRecord { day: number; max: number; min: number; }

const storageKey = (year: number, month: number) => `monthlyTemps-${year}-${String(month+1).padStart(2,'0')}`;

export default function MonthlyTempChart({ todaysMax, todaysMin }: Props) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const currentDay = now.getDate();

  const [year, setYear] = useState<number>(currentYear);
  const [month, setMonth] = useState<number>(currentMonth); // 0-based
  const [records, setRecords] = useState<DayRecord[]>([]);

  // Load records for selected year/month
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const key = storageKey(year, month);
    let data: DayRecord[] = [];
    try {
      const raw = localStorage.getItem(key);
      if (raw) data = JSON.parse(raw);
    } catch {}
    // Write today's temps only if selecting current month/year
    if (year === currentYear && month === currentMonth) {
      if (!data.find(r => r.day === currentDay)) {
        data.push({ day: currentDay, max: todaysMax, min: todaysMin });
        try { localStorage.setItem(key, JSON.stringify(data)); } catch {}
      }
    }
    setRecords(data);
  }, [year, month, todaysMax, todaysMin, currentYear, currentMonth, currentDay]);

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
        label: 'Max (°C)',
        data: maxSeries,
        borderColor: '#ef4444',
        backgroundColor: 'rgba(239,68,68,0.2)',
        spanGaps: true,
        tension: 0.25
      },
      {
        label: 'Min (°C)',
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
    plugins: {
      legend: { labels: { color: '#e2e8f0' } },
      tooltip: { intersect: false, mode: 'index' }
    },
    scales: {
      x: { ticks: { color: '#94a3b8' }, grid: { color: '#1e293b' } },
      y: { ticks: { color: '#94a3b8' }, grid: { color: '#1e293b' } }
    }
  };

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
        <span className="muted" style={{ fontSize: '.65rem' }}>Local cache only · auto saves today</span>
      </div>
      <Chart type="line" data={data} options={options} />
    </div>
  );
}
