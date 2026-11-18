import { ROUTE_META } from "@/data/schedule";
import { STOP_BY_ID } from "@/data/stops";
import {
  type BusState,
  busServicesOn,
  fmt,
  headsign,
  SERVICES,
  serviceRunsOn,
} from "@/lib/shuttle";

export const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
export const DAYS_LONG = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

export function relative(eta: number, now: number) {
  const diff = eta - now;
  if (diff < 0.75) return "Now";
  if (diff < 60) return `${Math.round(diff)} min`;
  const h = Math.floor(diff / 60);
  const m = Math.round(diff % 60);
  return m ? `${h}h ${m}m` : `${h}h`;
}

export function busColor(bus: string, day: number) {
  const s =
    SERVICES.find((x) => x.bus === bus && serviceRunsOn(x, day)) ??
    SERVICES.find((x) => x.bus === bus);
  return s ? ROUTE_META[s.route].color : "#888888";
}

export function busIsInactive(bus: string) {
  const list = SERVICES.filter((s) => s.bus === bus);
  return list.length > 0 && list.every((s) => s.inactive === true);
}

export function busRunsOn(bus: string, day: number) {
  return SERVICES.some((s) => s.bus === bus && serviceRunsOn(s, day));
}

/** The service to describe a bus with on `day`: that day's service, else its usual one. */
export function busServiceFor(bus: string, day: number) {
  return busServicesOn(bus, day)[0] ?? SERVICES.find((s) => s.bus === bus);
}

export function runDaysLabel(bus: string) {
  if (busIsInactive(bus)) return "Temporarily inactive";
  const types = new Set(SERVICES.filter((s) => s.bus === bus).map((s) => s.days));
  if (types.size > 1) return "Daily";
  return types.has("weekend") ? "Sat & Sun only" : "Mon – Fri only";
}

export function stopName(id: string) {
  return STOP_BY_ID[id]?.name ?? id;
}

export function statusText(state: BusState, runsToday: boolean, now: number, inactive = false) {
  if (inactive) return { label: "Temporarily inactive", tone: "off" as const };
  if (!runsToday) return { label: "No service this day", tone: "off" as const };
  if (state.kind === "running") {
    const end = state.trip.depart + state.trip.duration;
    return { label: `To ${headsign(state.trip)} · arr ${fmt(end)}`, tone: "running" as const };
  }
  if (state.kind === "waiting") {
    const first = state.trip.half.stops[0];
    return {
      label: `Departs ${fmt(state.trip.depart)} (${relative(state.trip.depart, now)}) · ${first ? stopName(first.id) : ""}`,
      tone: "waiting" as const,
    };
  }
  if (state.nextDeparture)
    return { label: `Next trip ${fmt(state.nextDeparture.depart)}`, tone: "off" as const };
  return { label: "No more trips today", tone: "off" as const };
}
