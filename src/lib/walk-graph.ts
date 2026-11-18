// Walking network for in-app directions. Built offline from OpenStreetMap (ODbL) into
// src/data/walk-graph.json and searched entirely in the browser — no routing API calls.
import { metres, type LatLng } from "./shuttle";

export type RawWalkGraph = { n: number[]; e: (number | number[])[][]; names: string[] };

export type WalkGraph = {
  lat: Float64Array;
  lng: Float64Array;
  ea: Int32Array;
  eb: Int32Array;
  elen: Float64Array;
  ename: Int32Array;
  geom: LatLng[][]; // a → b
  cum: Float64Array[]; // metres along geom, scaled to elen
  adjStart: Int32Array;
  adjEdge: Int32Array;
  names: string[];
  grid: Map<number, number[]>; // cell → edge*4096 + segment
};

const CELL = 0.001;
const cellKey = (la: number, lo: number) =>
  Math.floor(la / CELL) * 1_000_000 + Math.floor(lo / CELL);

export function buildWalkGraph(raw: RawWalkGraph): WalkGraph {
  const nN = raw.n.length / 2;
  const lat = new Float64Array(nN);
  const lng = new Float64Array(nN);
  for (let i = 0; i < nN; i++) {
    lat[i] = (raw.n[2 * i]! + 150000) / 1e5;
    lng[i] = (raw.n[2 * i + 1]! + 10360000) / 1e5;
  }
  const nE = raw.e.length;
  const ea = new Int32Array(nE);
  const eb = new Int32Array(nE);
  const elen = new Float64Array(nE);
  const ename = new Int32Array(nE);
  const geom: LatLng[][] = [];
  const cum: Float64Array[] = [];
  const deg = new Int32Array(nN);
  const grid = new Map<number, number[]>();
  raw.e.forEach((e, i) => {
    const a = e[0] as number;
    const b = e[1] as number;
    ea[i] = a;
    eb[i] = b;
    elen[i] = Math.max(0.1, e[2] as number);
    ename[i] = e[3] as number;
    deg[a]!++;
    deg[b]!++;
    const pts: LatLng[] = [[lat[a]!, lng[a]!]];
    const inner = e[4] as number[] | undefined;
    if (inner) {
      let qa = Math.round(lat[a]! * 1e5);
      let qo = Math.round(lng[a]! * 1e5);
      for (let k = 0; k < inner.length; k += 2) {
        qa += inner[k]!;
        qo += inner[k + 1]!;
        pts.push([qa / 1e5, qo / 1e5]);
      }
    }
    pts.push([lat[b]!, lng[b]!]);
    const c = new Float64Array(pts.length);
    for (let k = 1; k < pts.length; k++) c[k] = c[k - 1]! + metres(pts[k - 1]!, pts[k]!);
    const scale = elen[i]! / (c[c.length - 1] || 1);
    for (let k = 1; k < c.length; k++) c[k]! *= scale;
    geom.push(pts);
    cum.push(c);
    for (let k = 0; k < pts.length - 1; k++) {
      const p = pts[k]!;
      const q = pts[k + 1]!;
      const la0 = Math.floor(Math.min(p[0], q[0]) / CELL);
      const la1 = Math.floor(Math.max(p[0], q[0]) / CELL);
      const lo0 = Math.floor(Math.min(p[1], q[1]) / CELL);
      const lo1 = Math.floor(Math.max(p[1], q[1]) / CELL);
      for (let x = la0; x <= la1; x++)
        for (let y = lo0; y <= lo1; y++) {
          const key = x * 1_000_000 + y;
          const list = grid.get(key);
          if (list) list.push(i * 4096 + k);
          else grid.set(key, [i * 4096 + k]);
        }
    }
  });
  const adjStart = new Int32Array(nN + 1);
  for (let i = 0; i < nN; i++) adjStart[i + 1] = adjStart[i]! + deg[i]!;
  const fill = adjStart.slice(0, nN);
  const adjEdge = new Int32Array(adjStart[nN]!);
  for (let i = 0; i < nE; i++) {
    adjEdge[fill[ea[i]!]!++] = i;
    adjEdge[fill[eb[i]!]!++] = i;
  }
  return { lat, lng, ea, eb, elen, ename, geom, cum, adjStart, adjEdge, names: raw.names, grid };
}

let loading: Promise<WalkGraph> | null = null;
/** Loads the walking network on demand (kept out of the first page load). */
export function loadWalkGraph(): Promise<WalkGraph> {
  loading ??= import("@/data/walk-graph.json").then((m) =>
    buildWalkGraph(m.default as unknown as RawWalkGraph),
  );
  return loading;
}

/** A point snapped onto the nearest walkable edge. */
export type Snap = { edge: number; along: number; point: LatLng; offset: number };

function projectSeg(p: LatLng, a: LatLng, b: LatLng) {
  const kx = Math.cos((p[0] * Math.PI) / 180);
  const bx = (b[1] - a[1]) * kx;
  const by = b[0] - a[0];
  const px = (p[1] - a[1]) * kx;
  const py = p[0] - a[0];
  const L2 = bx * bx + by * by;
  const t = L2 > 0 ? Math.max(0, Math.min(1, (px * bx + py * by) / L2)) : 0;
  const q: LatLng = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  return { t, q, d: metres(p, q) };
}

export function snapTo(g: WalkGraph, p: LatLng): Snap {
  let best: Snap | null = null;
  const test = (code: number) => {
    const e = Math.floor(code / 4096);
    const k = code % 4096;
    const pts = g.geom[e]!;
    const r = projectSeg(p, pts[k]!, pts[k + 1]!);
    if (!best || r.d < best.offset) {
      const c = g.cum[e]!;
      best = { edge: e, along: c[k]! + (c[k + 1]! - c[k]!) * r.t, point: r.q, offset: r.d };
    }
  };
  const cx = Math.floor(p[0] / CELL);
  const cy = Math.floor(p[1] / CELL);
  for (let r = 0; r <= 12; r++) {
    for (let x = cx - r; x <= cx + r; x++)
      for (let y = cy - r; y <= cy + r; y++) {
        if (Math.abs(x - cx) !== r && Math.abs(y - cy) !== r) continue;
        g.grid.get(x * 1_000_000 + y)?.forEach(test);
      }
    const found = best as Snap | null;
    if (found && found.offset < r * CELL * 111_000) return found;
  }
  if (!best) for (const list of g.grid.values()) list.forEach(test);
  return best!;
}

class Heap {
  k: number[] = [];
  v: number[] = [];
  get size() {
    return this.k.length;
  }
  push(key: number, val: number) {
    const k = this.k;
    const v = this.v;
    k.push(key);
    v.push(val);
    let i = k.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (k[p]! <= key) break;
      k[i] = k[p]!;
      v[i] = v[p]!;
      i = p;
    }
    k[i] = key;
    v[i] = val;
  }
  pop(): [number, number] {
    const k = this.k;
    const v = this.v;
    const top: [number, number] = [k[0]!, v[0]!];
    const lk = k.pop()!;
    const lv = v.pop()!;
    if (k.length) {
      let i = 0;
      const n = k.length;
      for (;;) {
        let c = 2 * i + 1;
        if (c >= n) break;
        if (c + 1 < n && k[c + 1]! < k[c]!) c++;
        if (k[c]! >= lk) break;
        k[i] = k[c]!;
        v[i] = v[c]!;
        i = c;
      }
      k[i] = lk;
      v[i] = lv;
    }
    return top;
  }
}

/** Shortest walking distances from a snapped point to every junction (Dijkstra). */
export type Tree = { src: Snap; dist: Float64Array; prevEdge: Int32Array };

export function shortestTree(g: WalkGraph, src: Snap): Tree {
  const n = g.lat.length;
  const dist = new Float64Array(n).fill(Infinity);
  const prevEdge = new Int32Array(n).fill(-1);
  const h = new Heap();
  const a = g.ea[src.edge]!;
  const b = g.eb[src.edge]!;
  dist[a] = src.along;
  dist[b] = Math.min(dist[b]!, g.elen[src.edge]! - src.along);
  h.push(dist[a]!, a);
  h.push(dist[b]!, b);
  while (h.size) {
    const [d, u] = h.pop();
    if (d > dist[u]!) continue;
    for (let i = g.adjStart[u]!; i < g.adjStart[u + 1]!; i++) {
      const e = g.adjEdge[i]!;
      const v = g.ea[e] === u ? g.eb[e]! : g.ea[e]!;
      const nd = d + g.elen[e]!;
      if (nd < dist[v]!) {
        dist[v] = nd;
        prevEdge[v] = e;
        h.push(nd, v);
      }
    }
  }
  return { src, dist, prevEdge };
}

/** Network distance (metres) from the tree's source to a snapped target, excluding off-path offsets. */
export function distanceTo(g: WalkGraph, t: Tree, target: Snap): number {
  if (target.edge === t.src.edge) return Math.abs(target.along - t.src.along);
  const e = target.edge;
  return Math.min(
    t.dist[g.ea[e]!]! + target.along,
    t.dist[g.eb[e]!]! + (g.elen[e]! - target.along),
  );
}

export type Segment = { name: string; pts: LatLng[] };

function slice(g: WalkGraph, e: number, from: number, to: number): LatLng[] {
  const pts = g.geom[e]!;
  const c = g.cum[e]!;
  const at = (d: number): LatLng => {
    let k = 0;
    while (k < c.length - 2 && c[k + 1]! < d) k++;
    const t = (d - c[k]!) / (c[k + 1]! - c[k]! || 1);
    const a = pts[k]!;
    const b = pts[k + 1]!;
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  };
  const lo = Math.min(from, to);
  const hi = Math.max(from, to);
  const out: LatLng[] = [at(lo)];
  for (let k = 1; k < pts.length - 1; k++) if (c[k]! > lo && c[k]! < hi) out.push(pts[k]!);
  out.push(at(hi));
  return from <= to ? out : out.reverse();
}

/** Walkable path from the tree's source to `target`, as named segments in walking order. */
export function pathTo(g: WalkGraph, t: Tree, target: Snap): Segment[] {
  const name = (e: number) => g.names[g.ename[e]!] ?? "path";
  const src = t.src;
  if (target.edge === src.edge)
    return [{ name: name(src.edge), pts: slice(g, src.edge, src.along, target.along) }];
  const e = target.edge;
  const viaA = t.dist[g.ea[e]!]! + target.along;
  const viaB = t.dist[g.eb[e]!]! + (g.elen[e]! - target.along);
  let node = viaA <= viaB ? g.ea[e]! : g.eb[e]!;
  const tail: Segment = {
    name: name(e),
    pts: slice(g, e, viaA <= viaB ? 0 : g.elen[e]!, target.along),
  };
  const segs: Segment[] = [tail];
  for (let guard = 0; guard < 100000; guard++) {
    const pe = t.prevEdge[node]!;
    if (pe < 0) break;
    const other = g.ea[pe] === node ? g.eb[pe]! : g.ea[pe]!;
    const fromA = g.ea[pe] === other;
    segs.push({ name: name(pe), pts: fromA ? g.geom[pe]!.slice() : g.geom[pe]!.slice().reverse() });
    node = other;
  }
  const atA = node === g.ea[src.edge];
  segs.push({
    name: name(src.edge),
    pts: slice(g, src.edge, src.along, atA ? 0 : g.elen[src.edge]!),
  });
  return segs.reverse();
}
