import { NextResponse } from 'next/server';
import { kv } from '@vercel/kv';

// Persisted historical daily max/min temps per city+unit.
// Data model:
//  Key: weather:hist:<cityLower>:<year>-<month>  (month 01-12)
//  Value: JSON string of { days: { [day:number]: { max:number, min:number, ts:string } }, meta:{ city, year, month, units } }
//  Index set for listing months(optional future): weather:hist:index:<cityLower>

export async function GET(req: Request) {
  const url = new URL(req.url);
  let city = url.searchParams.get('city') || 'Calgary';
  city = city.trim().replace(/[^a-zA-Z\s-]/g, '').slice(0,50) || 'Calgary';
  let units = url.searchParams.get('units') || 'metric';
  const allowedUnits = new Set(['metric','imperial','standard']);
  if(!allowedUnits.has(units)) units = 'metric';
  const year = Number(url.searchParams.get('year')) || new Date().getFullYear();
  const month = Number(url.searchParams.get('month')); // 1-12
  if(!month || month < 1 || month > 12) {
    return NextResponse.json({ error: 'Invalid month (1-12 required)' }, { status: 400 });
  }
  const format = url.searchParams.get('format');
  const key = `weather:hist:${city.toLowerCase()}:${units}:${year}-${String(month).padStart(2,'0')}`;
  try {
    const raw = await kv.get<string>(key);
    if(!raw) {
      if(format === 'csv') {
        return new Response('day,max,min\n', { status: 200, headers: { 'Content-Type': 'text/csv; charset=utf-8' } });
      }
      return NextResponse.json({ city, units, year, month, days: {} }, { status: 200 });
    }
    const parsed = JSON.parse(raw);
    if(format === 'csv') {
      const days = parsed.days || {};
      const lines = ['day,max,min'];
      Object.keys(days).sort((a,b)=>Number(a)-Number(b)).forEach(d => {
        const rec = days[d];
        lines.push(`${d},${rec.max},${rec.min}`);
      });
      const csv = lines.join('\n');
      return new Response(csv, { status: 200, headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Cache-Control': 'no-store' } });
    }
    return NextResponse.json(parsed, { status: 200 });
  } catch (e:any) {
    return NextResponse.json({ error: 'Failed to load history', message: e?.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const url = new URL(req.url);
  let city = url.searchParams.get('city') || 'Calgary';
  city = city.trim().replace(/[^a-zA-Z\s-]/g, '').slice(0,50) || 'Calgary';
  let units = url.searchParams.get('units') || 'metric';
  const allowedUnits = new Set(['metric','imperial','standard']);
  if(!allowedUnits.has(units)) units = 'metric';
  const body = await req.json().catch(()=>null);
  if(!body || typeof body.day !== 'number' || typeof body.max !== 'number' || typeof body.min !== 'number') {
    return NextResponse.json({ error: 'Body must include day,max,min number' }, { status: 400 });
  }
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const key = `weather:hist:${city.toLowerCase()}:${units}:${year}-${String(month).padStart(2,'0')}`;
  try {
    const raw = await kv.get<string>(key);
    let doc: any = raw ? JSON.parse(raw) : { meta: { city, units, year, month }, days: {} };
    doc.days[body.day] = { max: body.max, min: body.min, ts: new Date().toISOString() };
    await kv.set(key, JSON.stringify(doc));
    return NextResponse.json({ ok: true, saved: doc.days[body.day] }, { status: 200 });
  } catch (e:any) {
    return NextResponse.json({ error: 'Failed to save history', message: e?.message }, { status: 500 });
  }
}
