import { describe, expect, it } from "vitest";
import { SERVICES } from "@/data/schedule";
import {
  advanceClock,
  arrivalsAt,
  BUSES,
  busServicesOn,
  busState,
  serviceRunsOn,
  toMin,
  tripsFor,
} from "@/lib/shuttle";

const svc = (id: string) => SERVICES.find((s) => s.id === id)!;
const MON = 1,
  FRI = 5,
  SAT = 6,
  SUN = 0;

describe("shuttle schedule rules", () => {
  it("drops departures from 12:40 to before 14:00 on Friday", () => {
    const fri = tripsFor(svc("A1"), FRI).map((t) => t.depart);
    expect(fri).not.toContain(toMin("12:40"));
    expect(fri).not.toContain(toMin("13:40"));
    expect(fri).toContain(toMin("12:20"));
    expect(fri).toContain(toMin("14:00"));
  });

  it("keeps the 12:40–14:00 departures on other weekdays", () => {
    expect(tripsFor(svc("A1"), MON).map((t) => t.depart)).toContain(toMin("12:40"));
  });

  it("runs weekday services only Monday to Friday", () => {
    expect(tripsFor(svc("B1"), SAT)).toHaveLength(0);
    expect(tripsFor(svc("B1"), SUN)).toHaveLength(0);
    expect(tripsFor(svc("B1"), MON).length).toBeGreaterThan(0);
  });

  it("runs the weekend E1/E2 timetable only on Saturday and Sunday", () => {
    expect(tripsFor(svc("E1-weekend"), SAT).length).toBe(12);
    expect(tripsFor(svc("E1-weekend"), MON)).toHaveLength(0);
  });

  it("finishes each trip before the bus's next departure from the far terminal", () => {
    for (const t of tripsFor(svc("A1"), MON)) {
      expect(t.depart + t.duration).toBeLessThanOrEqual(t.depart + 30);
    }
    const first = tripsFor(svc("A1"), MON)[0]!; // KP 07:30 → CP, next CP departure 07:45
    expect(first.depart + first.duration).toBeLessThanOrEqual(toMin("7:45"));
  });
});

describe("bus tracking", () => {
  it("shows A1 running from KP shortly after its 07:30 departure", () => {
    const s = busState("A1", MON, toMin("7:33"));
    expect(s.kind).toBe("running");
    if (s.kind === "running") expect(s.trip.dir).toBe("out");
  });

  it("marks a bus off duty late at night", () => {
    expect(busState("B1", MON, toMin("23:30")).kind).toBe("off");
  });

  it("gives increasing ETAs for the stops ahead", () => {
    const s = busState("E1", MON, toMin("7:05"));
    expect(s.kind).toBe("running");
    if (s.kind === "running") {
      const etas = s.nextStops.map((n) => n.eta);
      expect(etas).toEqual([...etas].sort((a, b) => a - b));
    }
  });

  it("lists the next departures at Centre Point", () => {
    const arr = arrivalsAt("cp", MON, toMin("7:40"));
    expect(arr.length).toBeGreaterThan(0);
    expect(arr[0]!.eta).toBeGreaterThanOrEqual(toMin("7:40") - 0.25);
  });
});

describe("days never mix", () => {
  it("only ever runs trips from that day's timetable, for every bus and day", () => {
    for (let day = 0; day < 7; day++) {
      for (const { bus } of BUSES) {
        for (let m = 0; m < 24 * 60; m += 5) {
          const st = busState(bus, day, m);
          const trip = st.kind === "off" ? st.nextDeparture : st.trip;
          if (trip) expect(serviceRunsOn(trip.service, day)).toBe(true);
        }
      }
    }
  });

  it("uses E1's weekend route on Saturday and its weekday route on Monday", () => {
    expect(busServicesOn("E1", SAT).map((s) => s.id)).toEqual(["E1-weekend"]);
    expect(busServicesOn("E1", MON).map((s) => s.id)).toEqual(["E1"]);
    const sat = busState("E1", SAT, toMin("7:35"));
    expect(sat.kind).toBe("running");
    if (sat.kind === "running") expect(sat.trip.service.id).toBe("E1-weekend");
  });

  it("has no weekday-only bus on the road at the weekend", () => {
    for (const day of [SAT, SUN]) {
      for (let m = 0; m < 24 * 60; m += 5) {
        expect(busState("A1", day, m).kind).toBe("off");
        expect(busState("E3", day, m).kind).toBe("off");
      }
    }
  });

  it("lists only E1/E2 weekend buses at stops on Sunday", () => {
    const buses = new Set(
      arrivalsAt("cp", SUN, toMin("7:00"), undefined, 24 * 60).map((a) => a.trip.service.id),
    );
    expect([...buses].sort()).toEqual(["E1-weekend", "E2-weekend"]);
  });

  it("rolls a simulated clock into the next day after midnight", () => {
    expect(advanceClock(FRI, toMin("23:50"), 15)).toEqual({ day: SAT, minutes: 5 });
    expect(advanceClock(SAT, toMin("23:59"), 2)).toEqual({ day: SUN, minutes: 1 });
    expect(advanceClock(MON, toMin("8:00"), 30)).toEqual({ day: MON, minutes: toMin("8:30") });
  });

  it("keeps V0 bus H inactive on every day", () => {
    for (let day = 0; day < 7; day++) {
      expect(serviceRunsOn(svc("H"), day)).toBe(false);
      expect(tripsFor(svc("H"), day)).toHaveLength(0);
      expect(busServicesOn("H", day)).toHaveLength(0);
      expect(busState("H", day, toMin("8:00")).kind).toBe("off");
    }
  });

  it("never overlaps trips for the same bus or spills past midnight on any day", () => {
    for (let day = 0; day < 7; day++) {
      for (const { bus } of BUSES) {
        const allTrips = busServicesOn(bus, day)
          .flatMap((s) => tripsFor(s, day))
          .sort((a, b) => a.depart - b.depart);
        for (let i = 0; i < allTrips.length; i++) {
          const cur = allTrips[i]!;
          expect(cur.depart + cur.duration).toBeLessThan(24 * 60);
          if (i + 1 < allTrips.length) {
            expect(cur.depart + cur.duration).toBeLessThanOrEqual(allTrips[i + 1]!.depart);
          }
        }
      }
    }
  });
});

describe("route stop rules", () => {
  it("skips CP and stops at KRP G11 when heading from Lingkaran Ilmu to Jalan Meranti", async () => {
    const { ROUTES } = await import("@/lib/shuttle");
    for (const k of ["EN", "ED", "EW"] as const) {
      const ids = ROUTES[k].back.stops.map((s) => s.id);
      expect(ids).not.toContain("cp");
      expect(ids).toContain("krp_g11");
    }
  });
});
