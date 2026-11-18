import { describe, expect, it } from "vitest";
import raw from "@/data/walk-graph.json";
import { STOP_BY_ID } from "@/data/stops";
import { BOARD_BUFFER_MIN, planJourney, WALK_SPEED, type BusLeg, type Place } from "@/lib/journey";
import { metres, toMin } from "@/lib/shuttle";
import {
  buildWalkGraph,
  distanceTo,
  shortestTree,
  snapTo,
  type RawWalkGraph,
} from "@/lib/walk-graph";

const g = buildWalkGraph(raw as unknown as RawWalkGraph);
const MON = 1;
const SUN = 0;
const stop = (id: string): Place => ({
  label: STOP_BY_ID[id]!.name,
  lat: STOP_BY_ID[id]!.lat,
  lng: STOP_BY_ID[id]!.lng,
  stopId: id,
});

describe("walking network", () => {
  it("walks Centre Point to D05 along paths: longer than a straight line, but not absurdly", () => {
    const a = snapTo(g, [stop("cp").lat, stop("cp").lng]);
    const b = snapTo(g, [stop("d05").lat, stop("d05").lng]);
    const d = distanceTo(g, shortestTree(g, a), b);
    const straight = metres([stop("cp").lat, stop("cp").lng], [stop("d05").lat, stop("d05").lng]);
    expect(d).toBeGreaterThanOrEqual(straight * 0.95);
    expect(d).toBeLessThan(straight * 2);
  });
});

describe("journey planner", () => {
  it("rides a bus from KDOJ to Cluster on Monday morning, with total time = arrival − now", () => {
    const now = toMin("7:50");
    const r = planJourney(g, stop("kdoj"), stop("cluster"), MON, now);
    const best = r.options[0]!;
    expect(best.buses).toBeGreaterThan(0);
    expect(best.arriveAt).toBeGreaterThan(now);
    const last = best.legs[best.legs.length - 1]!;
    expect(last.kind).toBe("walk");
    if (last.kind === "walk") expect(best.arriveAt).toBeCloseTo(last.end, 5);
  });

  it("never boards a bus before you could walk to the stop", () => {
    const now = toMin("8:05");
    const r = planJourney(g, stop("ktdi"), stop("cluster"), MON, now);
    for (const j of r.options) {
      const first = j.legs[0]!;
      const bus = j.legs.find((l) => l.kind === "bus") as BusLeg | undefined;
      if (!bus || first.kind !== "walk") continue;
      expect(now + first.metres / WALK_SPEED + BOARD_BUFFER_MIN).toBeLessThanOrEqual(
        bus.boardAt + 1e-6,
      );
      expect(first.end).toBeLessThanOrEqual(bus.boardAt);
    }
  });

  it("only offers walking when no buses run (Sunday night)", () => {
    const r = planJourney(g, stop("ktdi"), stop("cp"), SUN, toMin("23:30"));
    expect(r.options.map((o) => o.id)).toEqual(["walk"]);
    expect(r.options[0]!.walkMetres).toBeGreaterThan(300);
  });

  it("suggests walking for a very short hop", () => {
    const r = planJourney(g, stop("d01"), stop("d05"), MON, toMin("8:00"));
    expect(r.options[0]!.id).toBe("walk");
  });

  it("refuses to plan from far outside campus", () => {
    const r = planJourney(
      g,
      { label: "KL", lat: 3.139, lng: 101.687 },
      stop("cp"),
      MON,
      toMin("8:00"),
    );
    expect(r.tooFar).toBe("from");
  });

  it("lists all remaining routing options for the selected day without mixing days", () => {
    const mon = planJourney(g, stop("kdoj"), stop("cluster"), MON, toMin("7:50"));
    const busOptionsMon = mon.options.filter((o) => o.buses > 0);
    expect(busOptionsMon.length).toBeGreaterThan(10);
    expect(mon.options.some((o) => o.id === "walk")).toBe(true);
    for (const o of busOptionsMon) {
      for (const leg of o.legs) {
        if (leg.kind === "bus") expect(leg.trip.service.days).toBe("weekday");
      }
    }

    const sat = planJourney(g, stop("kdoj"), stop("k9"), 6, toMin("7:50"));
    const busOptionsSat = sat.options.filter((o) => o.buses > 0);
    expect(busOptionsSat.length).toBeGreaterThan(1);
    for (const o of busOptionsSat) {
      for (const leg of o.legs) {
        if (leg.kind === "bus") expect(leg.trip.service.days).toBe("weekend");
      }
    }
  });
});
