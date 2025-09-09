import { NextResponse } from 'next/server';

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

export async function GET() {
  const apiKey = process.env.OPENWEATHER_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'Missing OPENWEATHER_API_KEY' }, { status: 500 });
  }

  const city = 'Calgary';
  const units = 'metric';

  const currentUrl = `https://api.openweathermap.org/data/2.5/weather?q=${city}&units=${units}&appid=${apiKey}`;
  const forecastUrl = `https://api.openweathermap.org/data/2.5/forecast?q=${city}&units=${units}&cnt=8&appid=${apiKey}`;

  try {
    const [currentRes, forecastRes] = await Promise.all([
      fetch(currentUrl),
      fetch(forecastUrl)
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

  return NextResponse.json(payload, { status: 200, headers: { 'Cache-Control': 's-maxage=86400, stale-while-revalidate=3600' } });
  } catch (err: any) {
    return NextResponse.json({ error: 'Unexpected error', message: err?.message }, { status: 500 });
  }
}
