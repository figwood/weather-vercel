import { NextResponse } from 'next/server';
import { kv } from '@vercel/kv';

function degToCompass(num: number) {
  const val = Math.floor((num / 22.5) + 0.5);
  const arr = [
    'N','NNE','NE','ENE','E','ESE','SE','SSE',
    'S','SSW','SW','WSW','W','WNW','NW','NNW'
  ];
  return arr[(val % 16)];
}

// Helper to get YYYY-MM-DD and hour in Calgary local time
function getCalgaryLocalParts(d = new Date()) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Edmonton',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', hour12: false
  });
  const parts = fmt.formatToParts(d);
  const get = (t: string) => parts.find(p => p.type === t)?.value || '';
  const y = get('year');
  const m = get('month');
  const day = get('day');
  const hour = get('hour');
  return { y, m, day, hour };
}

export async function GET(req: Request) {
  const apiKey = process.env.OPENWEATHER_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'Missing OPENWEATHER_API_KEY' }, { status: 500 });
  }
  // Optional simple auth to avoid public triggering
  const url = new URL(req.url);
  const token = url.searchParams.get('token') || req.headers.get('x-cron-token') || '';
  const force = url.searchParams.get('force') === '1';
  const expected = process.env.CRON_SECRET || '';
  if (expected && token !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const city = 'Calgary';
  const units = 'metric';
  const { y, m, day, hour } = getCalgaryLocalParts();
  const todayKey = `${y}-${m}-${day}`;

  // Gate: only run around 8am local time to avoid duplicate fetches if scheduled multiple times
  const hourNum = Number(hour);
  if (!force && Number.isFinite(hourNum) && hourNum !== 8) {
    return NextResponse.json({ ok: true, skipped: true, reason: `Not 8am Calgary local (now ${hour})` }, { status: 200 });
  }

  // Ensure once-per-day idempotency
  const lastRunKey = `weather:cron:${city.toLowerCase()}:lastRun`;
  const lastRun = (await kv.get<string>(lastRunKey)) || '';
  if (lastRun === todayKey) {
    return NextResponse.json({ ok: true, skipped: true, reason: 'Already ran today' }, { status: 200 });
  }

  // Fetch current + 24h forecast and store to KV
  const currentUrl = `https://api.openweathermap.org/data/2.5/weather?q=${city}&units=${units}&appid=${apiKey}`;
  const forecastUrl = `https://api.openweathermap.org/data/2.5/forecast?q=${city}&units=${units}&cnt=8&appid=${apiKey}`;
  try {
    const [currentRes, forecastRes] = await Promise.all([
      fetch(currentUrl, { next: { revalidate: 0 } }),
      fetch(forecastUrl, { next: { revalidate: 0 } })
    ]);
    if (!currentRes.ok) {
      const text = await currentRes.text();
      return NextResponse.json({ error: 'Failed current weather', details: text }, { status: 502 });
    }
    if (!forecastRes.ok) {
      const text = await forecastRes.text();
      return NextResponse.json({ error: 'Failed forecast', details: text }, { status: 502 });
    }
    const current = await currentRes.json();
    const forecast = await forecastRes.json();

    const currentRain = (current.rain && (current.rain['1h'] || current.rain['3h'])) || 0;
    const windDeg = current.wind?.deg ?? 0;
    const payload = {
      location: city,
      ts: new Date().toISOString(),
      description: current.weather?.[0]?.description || 'n/a',
      icon: current.weather?.[0]?.icon || null,
      currentTemp: current.main?.temp,
      minTemp: current.main?.temp_min,
      maxTemp: current.main?.temp_max,
      humidity: current.main?.humidity,
      pressure: current.main?.pressure,
      wind: { speed: current.wind?.speed, deg: windDeg, direction: degToCompass(windDeg) },
      rainLastPeriod: currentRain,
      forecast: (forecast.list || []).map((item: any) => {
        const deg = item.wind?.deg ?? 0;
        return {
          time: item.dt_txt,
          temp: item.main?.temp,
          feelsLike: item.main?.feels_like,
          tempMin: item.main?.temp_min,
          tempMax: item.main?.temp_max,
          windSpeed: item.wind?.speed,
          windDeg: deg,
          windDir: degToCompass(deg),
          rain3h: (item.rain && item.rain['3h']) || 0,
          description: item.weather?.[0]?.description,
          icon: item.weather?.[0]?.icon
        };
      })
    };

    const cacheKey = `weather:${city.toLowerCase()}:${units}:v1`;
    await kv.set(cacheKey, JSON.stringify({ ...payload, units }), { ex: 86400 });

    // Update monthly history (daily max/min)
    const year = Number(y);
    const month = Number(m);
    const key = `weather:hist:${city.toLowerCase()}:${units}:${year}-${m}`;
    const raw = await kv.get<any>(key);
    let doc: any = raw ? (typeof raw === 'string' ? (() => { try { return JSON.parse(raw); } catch { return { meta: { city, units, year, month }, days: {} }; } })() : raw) : { meta: { city, units, year, month }, days: {} };
    if (!doc.meta) doc.meta = { city, units, year, month };
    if (!doc.days || typeof doc.days !== 'object') doc.days = {};
    const dayNum = Number(day);
    doc.days[dayNum] = { max: payload.maxTemp, min: payload.minTemp, ts: new Date().toISOString() };
    await kv.set(key, JSON.stringify(doc));

    // Mark last run
    await kv.set(lastRunKey, todayKey, { ex: 60 * 60 * 24 * 7 }); // keep lastRun for a week

    return NextResponse.json({ ok: true, saved: { cacheKey, historyKey: key } }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: 'Unexpected error', message: e?.message }, { status: 500 });
  }
}
