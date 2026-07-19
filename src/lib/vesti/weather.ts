// Open-Meteo: free, no API key required.
import type { Season } from "./store";

export interface WeatherDay {
  date: string; // YYYY-MM-DD
  high: number; // °F
  low: number;  // °F
  precip: number;
  pack: Season;
  summary: string;
}

export interface WeatherSummary {
  place: string;
  country?: string;
  avgHigh: number; // °F
  avgLow: number;  // °F
  precipDays: number;
  totalPrecip: number; // mm
  pack: Season; // recommended season pack
  description: string;
  days: WeatherDay[];
}

const cToF = (c: number) => Math.round(c * 9 / 5 + 32);

interface GeoResult {
  name: string;
  latitude: number;
  longitude: number;
  country?: string;
}

async function geocode(query: string): Promise<GeoResult | null> {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=1&language=en&format=json`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  const r = data?.results?.[0];
  if (!r) return null;
  return { name: r.name, latitude: r.latitude, longitude: r.longitude, country: r.country };
}

function clampForecastDates(start: string, end: string) {
  // Open-Meteo forecast supports up to ~16 days ahead. For longer trips, use climate normals fallback.
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const max = new Date(today);
  max.setDate(max.getDate() + 15);
  const s = new Date(start);
  const e = new Date(end);
  const sd = s < today ? today : s;
  const ed = e > max ? max : e;
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { start: fmt(sd), end: fmt(ed > sd ? ed : sd) };
}

export async function getTripWeather(
  destination: string,
  startDate: string,
  endDate: string,
): Promise<WeatherSummary | null> {
  const geo = await geocode(destination);
  if (!geo) return null;
  const { start, end } = clampForecastDates(startDate, endDate);
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${geo.latitude}&longitude=${geo.longitude}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=auto&start_date=${start}&end_date=${end}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  const highs: number[] = data?.daily?.temperature_2m_max ?? [];
  const lows: number[] = data?.daily?.temperature_2m_min ?? [];
  const precip: number[] = data?.daily?.precipitation_sum ?? [];
  if (highs.length === 0) return null;
  const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const avgHighC = avg(highs);
  const avgLowC = avg(lows);
  const avgHigh = cToF(avgHighC);
  const avgLow = cToF(avgLowC);
  const totalPrecip = Math.round(precip.reduce((a, b) => a + b, 0));
  const precipDays = precip.filter((p) => p >= 1).length;

  let pack: Season = "Year-round";
  if (avgHighC >= 22) pack = "Warm";
  else if (avgHighC <= 12) pack = "Cold";

  const wet = precipDays >= Math.max(1, Math.floor(precip.length / 3));
  const description =
    pack === "Warm"
      ? `Warm days around ${avgHigh}°F. Pack breathable layers${wet ? " and something for rain" : ""}.`
      : pack === "Cold"
      ? `Cool to cold, around ${avgHigh}°/${avgLow}°F. Pack warm layers${wet ? " and waterproofing" : ""}.`
      : `Mild, around ${avgHigh}°/${avgLow}°F. Versatile pieces work best${wet ? "; expect some rain" : ""}.`;

  const dates: string[] = data?.daily?.time ?? [];
  const days: WeatherDay[] = highs.map((hC, i) => {
    const loC = lows[i] ?? hC;
    const pr = precip[i] ?? 0;
    const h = cToF(hC);
    const lo = cToF(loC);
    let dayPack: Season = "Year-round";
    if (hC >= 22) dayPack = "Warm";
    else if (hC <= 12) dayPack = "Cold";
    const summary =
      pr >= 2
        ? `${h}° • rain likely`
        : dayPack === "Warm"
        ? `${h}° • sunny & warm`
        : dayPack === "Cold"
        ? `${h}° • cool, bring a layer`
        : `${h}° • mild`;
    return { date: dates[i] ?? "", high: h, low: lo, precip: pr, pack: dayPack, summary };
  });

  return {
    place: geo.name,
    country: geo.country,
    avgHigh,
    avgLow,
    precipDays,
    totalPrecip,
    pack,
    description,
    days,
  };
}
