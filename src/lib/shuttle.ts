import routesJson from "@/data/routes.json";
import { ROUTE_META, SERVICES, type RouteKey, type Service } from "@/data/schedule";
import { STOP_BY_ID } from "@/data/stops";

export { SERVICES };

export type LatLng = [number, number];
type RawHalf = {
  path: number[][];
  stops: { id: string; d: number }[];
  lengthM: number;
  durationS: number;
};
export type Dir = "out" | "back";

export type Half = {
  path: LatLng[];
  cum: number[]; // cumulative metres along path
  length: number;
  stops: { id: string; d: number }[]; // d in metres along this path
  durationS: number;
};

/** Buses run slower than a car: stops, speed bumps and boarding. */
export const BUS_SLOWDOWN = 1.6;
/** Extra minutes added per intermediate stop for boarding. */
export const DWELL_MIN = 0.3;
/** How long before departure a waiting bus appears at its terminal (minutes). */
export const WAIT_WINDOW_MIN = 20;
/** Friday prayer break: no departures from 12:40 up to (not including) 14:00. */
export const FRIDAY_BREAK: [number, number] = [12 * 60 + 40, 14 * 60];

const R = 6371000;
/** Straight-line distance in metres (good enough at campus scale). */
export function metres(a: LatLng, b: LatLng) {
  const k = Math.PI / 180;
  const x = (b[1] - a[1]) * k * Math.cos(((a[0] + b[0]) / 2) * k);
  const y = (b[0] - a[0]) * k;
  return Math.sqrt(x * x + y * y) * R;
}

function buildHalf(raw: RawHalf): Half {
  let path = raw.path.map((p) => [p[0], p[1]] as LatLng);
  const cpStop = STOP_BY_ID["cp"];
  const skippedCp = raw.stops.find(
    (s, idx, arr) => s.id === "cp" && idx > 0 && arr[idx + 1]?.id === "krp_g11",
  );
  // Buses going from Lingkaran Ilmu to Jalan Meranti pass CP without stopping there and stop at KRP G11 instead.
  let savedM = 0;
  let cpCutD = Infinity;
  if (skippedCp && cpStop) {
    const cpPos: LatLng = [cpStop.lat, cpStop.lng];
    const cpIdx = path.findIndex((pt, i) => i > 0 && i < path.length - 1 && metres(pt, cpPos) < 25);
    if (cpIdx > 0) {
      const prev = path[cpIdx - 1]!;
      const cur = path[cpIdx]!;
      const next = path[cpIdx + 1]!;
      savedM = metres(prev, cur) + metres(cur, next) - metres(prev, next);
      cpCutD = skippedCp.d;
      path = [...path.slice(0, cpIdx), ...path.slice(cpIdx + 1)];
    }
  }
  const cum = [0];
  for (let i = 1; i < path.length; i++) cum.push(cum[i - 1]! + metres(path[i - 1]!, path[i]!));
  const length = cum[cum.length - 1] ?? 1;
  const rawAdjustedLength = Math.max(1, (raw.lengthM || length) - savedM);
  const scale = length / rawAdjustedLength;
  const rawStops = raw.stops.filter((s, idx, arr) => {
    if (s.id === "cp" && idx > 0 && arr[idx + 1]?.id === "krp_g11") return false;
    return true;
  });
  return {
    path,
    cum,
    length,
    stops: rawStops.map((s) => ({
      id: s.id,
      d: Math.min(length, Math.max(0, (s.d > cpCutD ? s.d - savedM : s.d) * scale)),
    })),
    durationS: raw.durationS,
  };
}

const rawRoutes = routesJson as unknown as Record<RouteKey, { out: RawHalf; back: RawHalf }>;
export const ROUTES: Record<RouteKey, { out: Half; back: Half }> = Object.fromEntries(
  Object.entries(rawRoutes).map(([k, v]) => [
    k,
    { out: buildHalf(v.out), back: buildHalf(v.back) },
  ]),
) as Record<RouteKey, { out: Half; back: Half }>;

export function toMin(s: string) {
  const [h = 0, m = 0] = s.split(":").map(Number);
  return h * 60 + m;
}
export function fmt(min: number) {
  const m = Math.floor(min) % (24 * 60);
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

/** 0 = Sunday ... 6 = Saturday */
export const isWeekend = (day: number) => day === 0 || day === 6;
export const serviceRunsOn = (s: Service, day: number) =>
  !s.inactive && (s.days === "weekend") === isWeekend(day);

export function isFridayBreak(day: number, depart: number) {
  return day === 5 && depart >= FRIDAY_BREAK[0] && depart < FRIDAY_BREAK[1];
}

export type Trip = {
  service: Service;
  dir: Dir;
  depart: number;
  duration: number; // minutes
  half: Half;
};

export function estimateMinutes(half: Half) {
  const intermediate = Math.max(0, half.stops.length - 2);
  return (half.durationS / 60) * BUS_SLOWDOWN + intermediate * DWELL_MIN;
}

const tripCache = new Map<string, Trip[]>();
/** All trips a service runs on a given day, sorted by departure, never overlapping another trip of the same bus or crossing midnight. */
export function tripsFor(service: Service, day: number): Trip[] {
  const key = `${service.id}:${day}`;
  const hit = tripCache.get(key);
  if (hit) return hit;
  let trips: Trip[] = [];
  if (serviceRunsOn(service, day)) {
    const route = ROUTES[service.route];
    const allBusDepartures = SERVICES.filter((s) => s.bus === service.bus && serviceRunsOn(s, day))
      .flatMap((s) => [...s.out, ...s.back].map(toMin))
      .filter((m) => !isFridayBreak(day, m))
      .sort((a, b) => a - b);
    const out = service.out.map(toMin).filter((m) => !isFridayBreak(day, m));
    const back = service.back.map(toMin).filter((m) => !isFridayBreak(day, m));
    const make = (dir: Dir, times: number[]) =>
      times.map((depart) => {
        const half = route[dir];
        const est = estimateMinutes(half);
        const next = allBusDepartures.find((m) => m > depart);
        const maxUntilNext = next !== undefined ? Math.max(3, next - depart - 1) : est;
        const maxUntilMidnight = Math.max(3, 24 * 60 - depart - 1);
        const duration = Math.min(est, maxUntilNext, maxUntilMidnight);
        return { service, dir, depart, duration, half };
      });
    trips = [...make("out", out), ...make("back", back)].sort((a, b) => a.depart - b.depart);
  }
  tripCache.set(key, trips);
  return trips;
}

export function pointAt(half: Half, d: number): { pos: LatLng; heading: number } {
  const path = half.path;
  const cum = half.cum;
  const first = path[0]!;
  if (d <= 0) return { pos: first, heading: bearing(first, path[1] ?? first) };
  let lo = 0;
  let hi = cum.length - 1;
  const last = path[hi]!;
  if (d >= cum[hi]!) return { pos: last, heading: bearing(path[hi - 1] ?? last, last) };
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (cum[mid]! <= d) lo = mid;
    else hi = mid;
  }
  const c0 = cum[lo]!;
  const t = (d - c0) / (cum[hi]! - c0 || 1);
  const a = path[lo]!;
  const b = path[hi]!;
  return { pos: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], heading: bearing(a, b) };
}

function bearing(a: LatLng, b: LatLng) {
  const k = Math.PI / 180;
  const y = Math.sin((b[1] - a[1]) * k) * Math.cos(b[0] * k);
  const x =
    Math.cos(a[0] * k) * Math.sin(b[0] * k) -
    Math.sin(a[0] * k) * Math.cos(b[0] * k) * Math.cos((b[1] - a[1]) * k);
  return (Math.atan2(y, x) / k + 360) % 360;
}

/** Typical walking pace with a detour factor for real paths (metres per minute). */
export const WALK_M_PER_MIN = 80 / 1.3;
export function walkMinutes(distanceM: number) {
  return Math.max(1, Math.round(distanceM / WALK_M_PER_MIN));
}

export type NextStop = { stopId: string; name: string; eta: number };

export type BusState =
  | {
      kind: "running";
      trip: Trip;
      pos: LatLng;
      heading: number;
      progress: number;
      nextStops: NextStop[];
    }
  | { kind: "waiting"; trip: Trip; pos: LatLng; heading: number; nextStops: NextStop[] }
  | { kind: "off"; nextDeparture: Trip | undefined };

export function stopEtas(trip: Trip, fromD = -1): NextStop[] {
  return trip.half.stops
    .filter((s) => s.d > fromD)
    .map((s) => ({
      stopId: s.id,
      name: STOP_BY_ID[s.id]?.name ?? s.id,
      eta: trip.depart + (s.d / trip.half.length) * trip.duration,
    }));
}

/** Where a bus is (or isn't) at `now` minutes on `day`. */
export function busState(bus: string, day: number, now: number): BusState {
  const trips = SERVICES.filter((s) => s.bus === bus)
    .flatMap((s) => tripsFor(s, day))
    .sort((a, b) => a.depart - b.depart);
  const running = trips.find((t) => now >= t.depart && now < t.depart + t.duration);
  if (running) {
    const progress = (now - running.depart) / running.duration;
    const d = progress * running.half.length;
    const { pos, heading } = pointAt(running.half, d);
    return {
      kind: "running",
      trip: running,
      pos,
      heading,
      progress,
      nextStops: stopEtas(running, d),
    };
  }
  const next = trips.find((t) => t.depart >= now);
  if (next && next.depart - now <= WAIT_WINDOW_MIN) {
    const { pos, heading } = pointAt(next.half, 0);
    return { kind: "waiting", trip: next, pos, heading, nextStops: stopEtas(next) };
  }
  return { kind: "off", nextDeparture: next };
}

export type Arrival = { trip: Trip; eta: number; isOrigin: boolean; headsign: string };

export function headsign(trip: Trip) {
  const meta = ROUTE_META[trip.service.route];
  return trip.dir === "out" ? meta.to : meta.from;
}

/** Upcoming arrivals at a stop (soonest first) within `horizon` minutes. */
export function arrivalsAt(
  stopId: string,
  day: number,
  now: number,
  buses?: Set<string>,
  horizon = 180,
): Arrival[] {
  const res: Arrival[] = [];
  for (const s of SERVICES) {
    if (buses && !buses.has(s.bus)) continue;
    for (const trip of tripsFor(s, day)) {
      if (trip.depart > now + horizon || trip.depart + trip.duration < now) continue;
      const lastIdx = trip.half.stops.length - 1;
      const hit = trip.half.stops
        .map((st, i) => ({ st, i, eta: trip.depart + (st.d / trip.half.length) * trip.duration }))
        .find((x) => x.st.id === stopId && x.eta >= now - 0.25 && x.i !== lastIdx);
      if (hit && hit.eta <= now + horizon)
        res.push({ trip, eta: hit.eta, isOrigin: hit.i === 0, headsign: headsign(trip) });
    }
  }
  return res.sort((a, b) => a.eta - b.eta);
}

export const BUSES: { bus: string; services: Service[] }[] = Array.from(
  SERVICES.reduce(
    (m, s) => m.set(s.bus, [...(m.get(s.bus) ?? []), s]),
    new Map<string, Service[]>(),
  ),
).map(([bus, services]) => ({ bus, services }));

export function servicesForDay(day: number) {
  return SERVICES.filter((s) => serviceRunsOn(s, day));
}

/** The services a bus operates on one specific day (never another day's timetable). */
export function busServicesOn(bus: string, day: number) {
  return SERVICES.filter((s) => s.bus === bus && serviceRunsOn(s, day));
}

/** Move a simulated clock forward, rolling into the next day (and its timetable) past midnight. */
export function advanceClock(day: number, minutes: number, elapsed: number) {
  const total = minutes + Math.max(0, elapsed);
  const days = Math.floor(total / (24 * 60));
  return { day: (((day + days) % 7) + 7) % 7, minutes: total - days * 24 * 60 };
}

/** Current day-of-week and minutes-since-midnight in Malaysia. */
export function malaysiaNow(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kuala_Lumpur",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "0";
  const day = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday"));
  return {
    day,
    minutes: Number(get("hour")) * 60 + Number(get("minute")) + Number(get("second")) / 60,
  };
}

/** The part of a route half between two distances along it (for drawing a ride). */
export function halfSlice(half: Half, d0: number, d1: number): LatLng[] {
  const out: LatLng[] = [pointAt(half, d0).pos];
  for (let i = 0; i < half.path.length; i++)
    if (half.cum[i]! > d0 && half.cum[i]! < d1) out.push(half.path[i]!);
  out.push(pointAt(half, d1).pos);
  return out;
}
