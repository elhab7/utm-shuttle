// Journey planner: walk → shuttle (up to one change) → walk, computed in the browser
// from the walking network and the timetable simulation. No paid APIs.
import { STOPS } from "@/data/stops";
import {
  halfSlice,
  metres,
  SERVICES,
  serviceRunsOn,
  tripsFor,
  type LatLng,
  type Trip,
} from "./shuttle";
import {
  distanceTo,
  pathTo,
  shortestTree,
  snapTo,
  type Segment,
  type Snap,
  type Tree,
  type WalkGraph,
} from "./walk-graph";

/** Walking pace on real paths, metres per minute (about 4.5 km/h). */
export const WALK_SPEED = 75;
/** Be at the stop this many minutes before the bus. */
export const BOARD_BUFFER_MIN = 1;
/** Minimum time to change buses at a stop. */
export const TRANSFER_MIN = 2;
/** A change of bus must save at least this much to be suggested. */
export const TRANSFER_PENALTY_MIN = 5;
/** Further than this from any path and we treat the point as off campus. */
export const MAX_OFFSET_M = 1500;
/** Each walking minute counts this much extra when ranking options (people prefer riding). */
export const WALK_RELUCTANCE = 0.5;

export type Place = { label: string; lat: number; lng: number; stopId?: string };

export type WalkStep = { text: string; metres: number };
export type WalkLeg = {
  kind: "walk";
  to: string;
  metres: number;
  minutes: number;
  start: number;
  end: number;
  path: LatLng[];
  steps: WalkStep[];
};
export type BusLeg = {
  kind: "bus";
  trip: Trip;
  boardStop: string;
  alightStop: string;
  boardAt: number;
  alightAt: number;
  stopsCount: number;
  path: LatLng[];
};
export type Leg = WalkLeg | BusLeg;
export type Journey = {
  id: string;
  legs: Leg[];
  leaveAt: number;
  arriveAt: number;
  walkMetres: number;
  buses: number;
};
export type PlanResult = {
  options: Journey[];
  tooFar?: "from" | "to";
  farMetres?: number;
  noBusesLeft: boolean;
};

type Parent =
  | { kind: "origin" }
  | { kind: "bus"; trip: Trip; boardIdx: number; alightIdx: number; from: Label }
  | { kind: "walk"; fromStop: string; metres: number; from: Label };
type Label = { stop: string; time: number; walkM: number; parent: Parent };

const stopSnapCache = new WeakMap<WalkGraph, Map<string, Snap>>();
function stopSnaps(g: WalkGraph) {
  let m = stopSnapCache.get(g);
  if (!m) {
    m = new Map(STOPS.map((s) => [s.id, snapTo(g, [s.lat, s.lng])]));
    stopSnapCache.set(g, m);
  }
  return m;
}
const STOP_POS = new Map(STOPS.map((s) => [s.id, [s.lat, s.lng] as LatLng]));
const stopName = (id: string) => STOPS.find((s) => s.id === id)?.name ?? id;

function etasOf(trip: Trip) {
  return trip.half.stops.map((s) => trip.depart + (s.d / trip.half.length) * trip.duration);
}

/** Plan trips from `from` to `to` leaving at `now` (minutes) on `day`. */
export function planJourney(
  g: WalkGraph,
  from: Place,
  to: Place,
  day: number,
  now: number,
): PlanResult {
  const fromSnap = snapTo(g, [from.lat, from.lng]);
  const toSnap = snapTo(g, [to.lat, to.lng]);
  if (fromSnap.offset > MAX_OFFSET_M)
    return { options: [], tooFar: "from", farMetres: fromSnap.offset, noBusesLeft: false };
  if (toSnap.offset > MAX_OFFSET_M)
    return { options: [], tooFar: "to", farMetres: toSnap.offset, noBusesLeft: false };

  const t1 = shortestTree(g, fromSnap);
  const t2 = shortestTree(g, toSnap);
  const snaps = stopSnaps(g);
  const walkFrom = new Map<string, number>();
  const walkTo = new Map<string, number>();
  for (const [id, s] of snaps) {
    walkFrom.set(id, fromSnap.offset + distanceTo(g, t1, s) + s.offset);
    walkTo.set(id, toSnap.offset + distanceTo(g, t2, s) + s.offset);
  }
  const directM = fromSnap.offset + distanceTo(g, t1, toSnap) + toSnap.offset;

  // Round-based search over today's trips (RAPTOR-style), up to two buses.
  const trips = SERVICES.filter((s) => serviceRunsOn(s, day))
    .flatMap((s) => tripsFor(s, day))
    .filter((t) => t.depart + t.duration >= now);
  // Each stop keeps a small set of labels that trade arrival time against walking.
  type Bag = Label[];
  const insert = (bags: Map<string, Bag>, l: Label) => {
    const bag = bags.get(l.stop) ?? [];
    if (bag.some((o) => o.time <= l.time + 0.01 && o.walkM <= l.walkM + 1)) return;
    bags.set(l.stop, [
      ...bag.filter((o) => !(l.time <= o.time + 0.01 && l.walkM <= o.walkM + 1)),
      l,
    ]);
  };
  let prev = new Map<string, Bag>();
  for (const [id, m] of walkFrom)
    prev.set(id, [{ stop: id, time: now + m / WALK_SPEED, walkM: m, parent: { kind: "origin" } }]);
  const rounds: Map<string, Bag>[] = [];
  for (let k = 1; k <= 2; k++) {
    const cur = new Map<string, Bag>();
    const buffer = k === 1 ? BOARD_BUFFER_MIN : TRANSFER_MIN;
    for (const trip of trips) {
      const stops = trip.half.stops;
      const etas = etasOf(trip);
      let board: { idx: number; from: Label } | null = null;
      for (let i = 0; i < stops.length; i++) {
        const id = stops[i]!.id;
        if (board && i > board.idx && id !== stops[board.idx]!.id)
          insert(cur, {
            stop: id,
            time: etas[i]!,
            walkM: board.from.walkM,
            parent: { kind: "bus", trip, boardIdx: board.idx, alightIdx: i, from: board.from },
          });
        if (i === stops.length - 1) continue;
        // Once aboard, arrival times are fixed, so keep the boarding with the least walking,
        // and among similar walks the one that lets you set off latest.
        for (const p of prev.get(id) ?? []) {
          if (p.time + buffer > etas[i]!) continue;
          const slack = etas[i]! - p.time;
          const curSlack = board ? etas[board.idx]! - board.from.time : -Infinity;
          if (
            !board ||
            p.walkM < board.from.walkM - 50 ||
            (p.walkM < board.from.walkM + 50 && slack > curSlack + 0.01)
          )
            board = { idx: i, from: p };
        }
      }
    }
    // Short walks between nearby stops for changing buses.
    if (k === 1) {
      for (const bag of [...cur.values()])
        for (const lbl of bag) {
          const a = STOP_POS.get(lbl.stop)!;
          for (const s of STOPS) {
            if (s.id === lbl.stop) continue;
            const m = metres(a, [s.lat, s.lng]) * 1.3;
            if (m > 400) continue;
            insert(cur, {
              stop: s.id,
              time: lbl.time + m / WALK_SPEED,
              walkM: lbl.walkM + m,
              parent: { kind: "walk", fromStop: lbl.stop, metres: m, from: lbl },
            });
          }
        }
    }
    rounds.push(cur);
    prev = cur;
  }

  const cost = (arrive: number, walkM: number, buses: number) =>
    arrive + (WALK_RELUCTANCE * walkM) / WALK_SPEED + Math.max(0, buses - 1) * TRANSFER_PENALTY_MIN;
  const walkLeg = makeWalk(g, t1, toSnap, to.label, now, from, to, false);
  const walkOption: { j: Journey; c: number } = {
    j: {
      id: "walk",
      legs: [walkLeg],
      leaveAt: now,
      arriveAt: walkLeg.end,
      walkMetres: directM,
      buses: 0,
    },
    c: cost(walkLeg.end, directM, 0),
  };

  const treeCache = new Map<string, Tree>();
  const scored: { j: Journey; c: number }[] = [walkOption];
  const seenIds = new Set<string>(["walk"]);

  // 1) All viable 1-bus trips remaining for the rest of `day`
  for (const trip of trips) {
    const stops = trip.half.stops;
    const etas = etasOf(trip);
    let bestPair: { bIdx: number; aIdx: number; walkM: number; arrive: number; c: number } | null =
      null;

    for (let bIdx = 0; bIdx < stops.length - 1; bIdx++) {
      const bStop = stops[bIdx]!.id;
      const wf = walkFrom.get(bStop);
      if (wf === undefined) continue;
      if (now + wf / WALK_SPEED + BOARD_BUFFER_MIN > etas[bIdx]!) continue;

      for (let aIdx = bIdx + 1; aIdx < stops.length; aIdx++) {
        const aStop = stops[aIdx]!.id;
        if (aStop === bStop) continue;
        const wt = walkTo.get(aStop);
        if (wt === undefined) continue;

        const walkM = wf + wt;
        const busRideM = Math.abs(stops[aIdx]!.d - stops[bIdx]!.d);
        if (busRideM < 150 || walkM >= directM - 50) continue;

        const arrive = etas[aIdx]! + wt / WALK_SPEED;
        const c = cost(arrive, walkM, 1);
        if (!bestPair || c < bestPair.c) {
          bestPair = { bIdx, aIdx, walkM, arrive, c };
        }
      }
    }

    if (!bestPair) continue;
    const bStop = stops[bestPair.bIdx]!.id;
    const aStop = stops[bestPair.aIdx]!.id;
    const originLabel: Label = {
      stop: bStop,
      time: now + walkFrom.get(bStop)! / WALK_SPEED,
      walkM: walkFrom.get(bStop)!,
      parent: { kind: "origin" },
    };
    const finalLabel: Label = {
      stop: aStop,
      time: etas[bestPair.aIdx]!,
      walkM: walkFrom.get(bStop)!,
      parent: {
        kind: "bus",
        trip,
        boardIdx: bestPair.bIdx,
        alightIdx: bestPair.aIdx,
        from: originLabel,
      },
    };
    const j = buildBusJourney(g, finalLabel, from, to, t1, t2, now, treeCache);
    if (!seenIds.has(j.id)) {
      seenIds.add(j.id);
      scored.push({ j, c: bestPair.c });
    }
  }

  // 2) Useful 2-bus transfer routes from RAPTOR round 2 (kept when faster or filling gaps)
  const best1BusCost = scored
    .filter((x) => x.j.buses === 1)
    .reduce((min, x) => Math.min(min, x.c), Infinity);
  const transferLabels: { label: Label; c: number }[] = [];
  for (const lbl of [...(rounds[1]?.values() ?? [])].flat()) {
    if (lbl.parent.kind !== "bus") continue;
    const wt = walkTo.get(lbl.stop) ?? Infinity;
    const wm = lbl.walkM + wt;
    if (wm >= directM - 50) continue;
    const c = cost(lbl.time + wt / WALK_SPEED, wm, 2);
    if (c < walkOption.c - 1 && (best1BusCost === Infinity || c < best1BusCost + 8)) {
      transferLabels.push({ label: lbl, c });
    }
  }
  transferLabels.sort((a, b) => a.c - b.c);
  for (const item of transferLabels.slice(0, 6)) {
    const j = buildBusJourney(g, item.label, from, to, t1, t2, now, treeCache);
    if (!seenIds.has(j.id)) {
      seenIds.add(j.id);
      scored.push({ j, c: item.c });
    }
  }

  scored.sort((a, b) => a.c - b.c);
  const options = scored.map((x) => x.j);
  return { options, noBusesLeft: trips.length === 0 };
}

function buildBusJourney(
  g: WalkGraph,
  last: Label,
  from: Place,
  to: Place,
  t1: Tree,
  t2: Tree,
  now: number,
  treeCache?: Map<string, Tree>,
): Journey {
  const chain: Label[] = [];
  for (let l: Label | null = last; l; l = l.parent.kind === "origin" ? null : l.parent.from)
    chain.unshift(l);
  const legs: Leg[] = [];
  const snaps = stopSnaps(g);
  for (const lbl of chain) {
    const p = lbl.parent;
    if (p.kind === "bus") {
      const stops = p.trip.half.stops;
      const etas = etasOf(p.trip);
      const boardStop = stops[p.boardIdx]!.id;
      if (p.from.parent.kind === "origin") {
        const leg = makeWalk(
          g,
          t1,
          snaps.get(boardStop)!,
          stopName(boardStop),
          0,
          from,
          STOP_POS.get(boardStop)!,
          false,
        );
        const start = Math.max(now, etas[p.boardIdx]! - BOARD_BUFFER_MIN - leg.minutes);
        legs.push({ ...leg, start, end: start + leg.minutes });
      }
      legs.push({
        kind: "bus",
        trip: p.trip,
        boardStop,
        alightStop: lbl.stop,
        boardAt: etas[p.boardIdx]!,
        alightAt: etas[p.alightIdx]!,
        stopsCount: p.alightIdx - p.boardIdx,
        path: halfSlice(p.trip.half, stops[p.boardIdx]!.d, stops[p.alightIdx]!.d),
      });
    } else if (p.kind === "walk") {
      let tree = treeCache?.get(p.fromStop);
      if (!tree) {
        tree = shortestTree(g, snaps.get(p.fromStop)!);
        treeCache?.set(p.fromStop, tree);
      }
      legs.push(
        makeWalk(
          g,
          tree,
          snaps.get(lbl.stop)!,
          stopName(lbl.stop),
          p.from.time,
          STOP_POS.get(p.fromStop)!,
          STOP_POS.get(lbl.stop)!,
          false,
        ),
      );
    }
  }
  const lastBus = legs[legs.length - 1] as BusLeg;
  const finalWalk = makeWalk(
    g,
    t2,
    snaps.get(last.stop)!,
    to.label,
    lastBus.alightAt,
    to,
    STOP_POS.get(last.stop)!,
    true,
  );
  legs.push(finalWalk);
  const walkMetres = legs.reduce((s, l) => s + (l.kind === "walk" ? l.metres : 0), 0);
  const buses = legs.filter((l) => l.kind === "bus") as BusLeg[];
  return {
    id: buses
      .map((b) => `${b.trip.service.id}-${b.trip.depart}-${b.boardStop}-${b.alightStop}`)
      .join("+"),
    legs,
    leaveAt: legs[0]!.kind === "walk" ? legs[0]!.start : now,
    arriveAt: finalWalk.end,
    walkMetres,
    buses: buses.length,
  };
}

function asLatLng(p: Place | LatLng): LatLng {
  return Array.isArray(p) ? p : [p.lat, p.lng];
}

/** A walking leg along the tree to `target`. `reverse` = the tree was grown from the leg's end. */
function makeWalk(
  g: WalkGraph,
  tree: Tree,
  target: Snap,
  toLabel: string,
  start: number,
  treePoint: Place | LatLng,
  targetPoint: Place | LatLng,
  reverse: boolean,
): WalkLeg {
  let segs = pathTo(g, tree, target);
  const a = asLatLng(treePoint);
  const b = asLatLng(targetPoint);
  segs = [{ name: "", pts: [a, tree.src.point] }, ...segs, { name: "", pts: [target.point, b] }];
  if (reverse) segs = segs.reverse().map((s) => ({ name: s.name, pts: s.pts.slice().reverse() }));
  const path: LatLng[] = [];
  for (const s of segs)
    for (const p of s.pts)
      if (!path.length || metres(path[path.length - 1]!, p) > 0.3) path.push(p);
  const m = tree.src.offset + distanceTo(g, tree, target) + target.offset;
  const minutes = m / WALK_SPEED;
  return {
    kind: "walk",
    to: toLabel,
    metres: m,
    minutes,
    start,
    end: start + minutes,
    path,
    steps: walkSteps(segs, toLabel),
  };
}

const GENERIC = new Set(["footpath", "path", "steps", "service road", "road", "walkway", "track"]);
const label = (n: string) => (GENERIC.has(n) ? `the ${n}` : n);

function bearing(a: LatLng, b: LatLng) {
  const k = Math.PI / 180;
  const y = Math.sin((b[1] - a[1]) * k) * Math.cos(b[0] * k);
  const x =
    Math.cos(a[0] * k) * Math.sin(b[0] * k) -
    Math.sin(a[0] * k) * Math.cos(b[0] * k) * Math.cos((b[1] - a[1]) * k);
  return (Math.atan2(y, x) / k + 360) % 360;
}
const len = (pts: LatLng[]) => pts.reduce((s, p, i) => (i ? s + metres(pts[i - 1]!, p) : 0), 0);
const COMPASS = [
  "north",
  "north-east",
  "east",
  "south-east",
  "south",
  "south-west",
  "west",
  "north-west",
];

/** Turn-by-turn text from named segments: merge same-named stretches, describe each turn. */
export function walkSteps(segs: Segment[], toLabel: string): WalkStep[] {
  const groups: { name: string; pts: LatLng[] }[] = [];
  for (const s of segs) {
    if (s.pts.length < 2) continue;
    const g = groups[groups.length - 1];
    if (g && (g.name === s.name || !s.name || len(s.pts) < 12)) g.pts.push(...s.pts.slice(1));
    else
      groups.push({ name: s.name || segs.find((x) => x.name)?.name || "path", pts: s.pts.slice() });
  }
  const steps: WalkStep[] = [];
  let lastBearing: number | null = null;
  for (const g of groups) {
    const m = len(g.pts);
    if (m < 1) continue;
    const startB = bearing(g.pts[0]!, g.pts[Math.min(g.pts.length - 1, 1)]!);
    let text: string;
    if (lastBearing === null)
      text = `Head ${COMPASS[Math.round(startB / 45) % 8]} on ${label(g.name)}`;
    else {
      const d = ((startB - lastBearing + 540) % 360) - 180;
      const side = d < 0 ? "left" : "right";
      const a = Math.abs(d);
      text =
        a < 25
          ? `Continue onto ${label(g.name)}`
          : a < 60
            ? `Keep ${side} onto ${label(g.name)}`
            : a < 150
              ? `Turn ${side} onto ${label(g.name)}`
              : `Turn around onto ${label(g.name)}`;
    }
    steps.push({ text, metres: m });
    const n = g.pts.length;
    lastBearing = bearing(g.pts[Math.max(0, n - 2)]!, g.pts[n - 1]!);
  }
  steps.push({ text: `Arrive at ${toLabel}`, metres: 0 });
  return steps;
}
