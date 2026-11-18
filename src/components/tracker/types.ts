import type { PlaceEntry } from "./use-places";

export type Selection =
  | { type: "bus"; id: string }
  | { type: "stop"; id: string }
  | { type: "place"; place: PlaceEntry }
  | null;

export type Clock = { day: number; minutes: number; live: boolean };
