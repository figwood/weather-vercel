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

// Revalidate once per day (86400 seconds) for daily data usage
export const revalidate = 86400;

/**
 * Weather API
 * Query params:
 *  - city   : string (default Calgary)
 *  - units  : metric | imperial | standard (default metric)
 *  - refresh: '1' to bypass KV cache and force new fetch
 */
export async function GET(request: Request) {
  const apiKey = process.env.OPENWEATHER_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'Missing OPENWEATHER_API_KEY' }, { status: 500 });
  }

  const url = new URL(request.url);
  let city = url.searchParams.get('city') || 'Calgary';
  // Basic sanitization: keep letters, spaces, hyphen
  city = city.trim().replace(/[^a-zA-Z\s-]/g, '').slice(0, 50) || 'Calgary';
  let units = url.searchParams.get('units') || 'metric';
  const allowedUnits = new Set(['metric', 'imperial', 'standard']);
  if (!allowedUnits.has(units)) units = 'metric';
  const REFRESH_TOKEN = '58X3KMMmvnY2ZjW';
  const forceRefresh = url.searchParams.get('refresh') === REFRESH_TOKEN;

  const currentUrl = `https://api.openweathermap.org/data/2.5/weather?q=${city}&units=${units}&appid=${apiKey}`;
  const forecastUrl = `https://api.openweathermap.org/data/2.5/forecast?q=${city}&units=${units}&cnt=8&appid=${apiKey}`;

  try {
    // Always prefer KV cache. If not forced refresh, do not refetch—just return cached or a soft message.
    const cacheKey = `weather:${city.toLowerCase()}:${units}:v1`; // versioned for future schema changes
    try {
      const cachedRaw = await kv.get<any>(cacheKey);
      if (cachedRaw && !forceRefresh) {
        let cached: any = cachedRaw;
        if (typeof cachedRaw === 'string') {
          try { cached = JSON.parse(cachedRaw); } catch { /* ignore */ }
        }
        if (cached && typeof cached === 'object') {
          return NextResponse.json(cached, { status: 200, headers: { 'Cache-Control': 's-maxage=1800, stale-while-revalidate=600' } });
        }
      }
      if (!cachedRaw && !forceRefresh && city.toLowerCase() === 'calgary') {
        return NextResponse.json({ error: 'no_cached_data', message: 'No cached weather for Calgary yet. Cron will populate at 8am Calgary time or call with refresh token.' }, { status: 200 });
      }
    } catch (e) {
      console.warn('[weather] KV read failed', e);
      if (!forceRefresh && city.toLowerCase() === 'calgary') {
        return NextResponse.json({ error: 'kv_unavailable', message: 'KV not available and refresh not requested.' }, { status: 200 });
      }
    }

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
      wind: {
        speed: current.wind?.speed,
        deg: windDeg,
        direction: degToCompass(windDeg)
      },
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

    // Store in KV (expire after 1 day)
    try {
      await kv.set(cacheKey, JSON.stringify({ ...payload, units }), { ex: 86400 });
    } catch (e) {
      console.warn('[weather] KV write failed', e);
    }

    return NextResponse.json({ ...payload, units }, { status: 200, headers: { 'Cache-Control': 's-maxage=86400, stale-while-revalidate=3600' } });
  } catch (err: any) {
    return NextResponse.json({ error: 'Unexpected error', message: err?.message }, { status: 500 });
  }
}
