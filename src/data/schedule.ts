// Timetable transcribed from "Jadual Shuttle Kampus Sesi 2026/2027".
// `out` = departures from the route's first terminal, `back` = departures from the far terminal.

export type RouteKey = "A" | "B" | "C" | "D" | "EN" | "ED" | "EW" | "EX" | "F" | "G" | "H";
export type DayType = "weekday" | "weekend";

export type Service = {
  id: string;
  bus: string;
  route: RouteKey;
  days: DayType;
  name: string;
  via: string;
  out: string[];
  back: string[];
  note?: string;
  inactive?: boolean;
};

export const ROUTE_META: Record<RouteKey, { color: string; from: string; to: string }> = {
  A: { color: "#C8102E", from: "KP (U7)", to: "Centre Point" },
  B: { color: "#E8920A", from: "KP", to: "Cluster (T02)" },
  C: { color: "#0E9F8E", from: "K9/K10", to: "Centre Point" },
  D: { color: "#2563EB", from: "Centre Point", to: "FKT (N29)" },
  EN: { color: "#DB2777", from: "KDOJ", to: "Cluster (T02)" },
  ED: { color: "#9F1239", from: "KDOJ", to: "Cluster (T02)" },
  EW: { color: "#DB2777", from: "KDOJ", to: "K9/K10" },
  EX: { color: "#64748B", from: "KDOJ", to: "Centre Point (FABU)" },
  F: { color: "#16A34A", from: "KTR (K01)", to: "FKE (P19a)" },
  G: { color: "#4F46E5", from: "KTR (K01)", to: "FKT (N29)" },
  H: { color: "#A16207", from: "Centre Point", to: "V01 (Taman U)" },
};

const t = (s: string) => s.trim().split(/\s+/);

export const SERVICES: Service[] = [
  {
    id: "A1",
    bus: "A1",
    route: "A",
    days: "weekday",
    name: "KP to CP (Jalan Amal)",
    via: "KP · CP · Jln Amal · KP",
    out: t(
      "7:30 8:00 8:30 9:00 9:30 10:00 12:00 12:40 13:20 14:00 14:40 16:50 17:30 18:10 19:45 20:15",
    ),
    back: t(
      "7:45 8:15 8:45 9:15 9:45 10:15 12:20 13:00 13:40 14:20 15:00 16:30 17:10 17:50 20:00 22:00 23:00",
    ),
  },
  {
    id: "B1",
    bus: "B1",
    route: "B",
    days: "weekday",
    name: "KP – K9/10 to Cluster",
    via: "KP · K9/10 · T02 · T08 · K9/10 · KP",
    out: t("7:00 7:30 8:00 8:30 9:00 9:30 11:35 12:15 12:55 13:35 14:15 16:20 17:00 17:40"),
    back: t(
      "7:15 7:45 8:15 8:45 9:15 9:45 11:15 11:55 12:35 13:15 13:55 14:35 16:00 16:40 17:20 18:00",
    ),
  },
  {
    id: "B2",
    bus: "B2",
    route: "B",
    days: "weekday",
    name: "KP – K9/10 to Cluster",
    via: "KP · K9/10 · T02 · T08 · K9/10 · KP",
    out: t("7:10 7:40 8:10 8:40 9:10 9:40 11:45 12:25 13:05 13:45 14:25 16:30 17:10 17:50"),
    back: t(
      "7:25 7:55 8:25 8:55 9:25 9:55 11:25 12:05 12:45 13:25 14:05 14:45 16:10 16:50 17:30 18:10",
    ),
  },
  {
    id: "B3",
    bus: "B3",
    route: "B",
    days: "weekday",
    name: "KP – K9/10 to Cluster",
    via: "KP · K9/10 · T02 · T08 · K9/10 · KP",
    out: t("7:20 7:50 8:20 8:50 9:20 9:50 12:00 12:40 13:20 14:00 14:40 16:45 17:25 18:05"),
    back: t(
      "7:35 8:05 8:35 9:05 9:35 10:05 11:40 12:20 13:00 13:40 14:20 15:00 16:25 17:05 17:45 18:25",
    ),
  },
  {
    id: "C1",
    bus: "C1",
    route: "C",
    days: "weekday",
    name: "Kolej 9/10 to Lingkaran Ilmu",
    via: "K9/10 · KTC · CP · Jln Amal · KTC · K9/10",
    out: t("7:00 7:30 8:00 8:30 9:00 9:30 11:35 12:15 12:55 13:35 14:15 16:20 17:00 17:40 18:20"),
    back: t(
      "7:15 7:45 8:15 8:45 9:15 9:45 11:15 11:55 12:35 13:15 13:55 14:35 16:00 16:40 17:20 18:00 18:40",
    ),
  },
  {
    id: "C2",
    bus: "C2",
    route: "C",
    days: "weekday",
    name: "Kolej 9/10 to Lingkaran Ilmu",
    via: "K9/10 · KTC · CP · Jln Amal · KTC · K9/10",
    out: t(
      "7:10 7:40 8:10 8:40 9:10 9:40 11:45 12:25 13:05 13:45 14:25 16:30 17:10 17:50 19:45 20:15",
    ),
    back: t(
      "7:25 7:55 8:25 8:55 9:25 9:55 11:25 12:05 12:45 13:25 14:05 14:45 16:10 16:50 17:30 20:00 22:00 23:00",
    ),
  },
  {
    id: "C3",
    bus: "C3",
    route: "C",
    days: "weekday",
    name: "Kolej 9/10 to Lingkaran Ilmu",
    via: "K9/10 · KTC · CP · Jln Amal · KTC · K9/10",
    out: t("7:20 7:50 8:20 8:50 9:20 9:50 12:00 12:40 13:20 14:00 14:40 16:45 17:25 18:05 18:40"),
    back: t(
      "7:35 8:05 8:35 9:05 9:35 10:05 11:40 12:20 13:00 13:40 14:20 15:00 16:25 17:05 17:45 18:25 19:00",
    ),
  },
  {
    id: "D1",
    bus: "D1",
    route: "D",
    days: "weekday",
    name: "CP to FKT (N29)",
    via: "CP · N24 · FKT (N29) · P19 · CP",
    out: t("7:15 7:45 8:15 8:45 9:15 9:45 11:45 12:15 12:45 13:45 14:15 16:15 16:45 17:15 17:45"),
    back: t(
      "7:30 8:00 8:30 9:00 9:30 10:00 11:30 12:00 12:30 13:00 14:00 14:30 16:00 16:30 17:00 17:30 18:00",
    ),
  },
  {
    id: "E1",
    bus: "E1",
    route: "EN",
    days: "weekday",
    name: "KDOJ / KLG / KDSE to Cluster",
    via: "via CP (outbound) · Jln Amal · KRP G11",
    out: t("7:00 8:00 9:00 11:00 12:00 13:00 14:00 16:30 17:30"),
    back: t("7:30 8:30 9:30 11:30 12:30 13:30 14:30 16:00 17:00 18:00"),
  },
  {
    id: "E2",
    bus: "E2",
    route: "ED",
    days: "weekday",
    name: "KDOJ / KLG / KDSE to Cluster",
    via: "via CP (outbound) · Jln Amal · KRP G11",
    out: t("7:10 8:10 9:10 11:15 12:15 13:15 14:15 16:45 17:45"),
    back: t("7:40 8:40 9:40 11:45 12:45 13:45 14:45 16:15 17:15 18:15"),
  },
  {
    id: "E3",
    bus: "E3",
    route: "EN",
    days: "weekday",
    name: "KDOJ / KLG / KDSE to Cluster",
    via: "via CP (outbound) · Jln Amal · KRP G11",
    out: t("7:20 8:20 9:20 11:30 12:30 13:30 14:30 17:00 18:00"),
    back: t("7:50 8:50 9:50 12:00 13:00 14:00 15:00 16:30 17:30 18:30"),
  },
  {
    id: "E4",
    bus: "E4",
    route: "ED",
    days: "weekday",
    name: "KDOJ / KLG / KDSE to Cluster",
    via: "via CP (outbound) · Jln Amal · KRP G11",
    out: t("7:30 8:30 9:30 11:45 12:45 13:45 14:45 17:15 18:15"),
    back: t("8:00 9:00 10:00 12:15 13:15 14:15 15:15 16:45 17:45 18:45"),
  },
  {
    id: "E5",
    bus: "E5",
    route: "EN",
    days: "weekday",
    name: "KDOJ to Cluster",
    via: "via CP (outbound) · Jln Amal · KRP G11",
    out: t("7:40 8:40 10:00 11:00 15:15 16:15 17:30"),
    back: t("8:10 9:10 10:30 11:30 15:45 17:00 18:00"),
  },
  {
    id: "E6",
    bus: "E6",
    route: "ED",
    days: "weekday",
    name: "KDOJ to Cluster",
    via: "via CP (outbound) · Jln Amal · KRP G11",
    out: t("7:50 8:50 10:30 15:00 16:00 17:30"),
    back: t("8:20 9:20 10:00 11:00 15:30 17:00 18:00"),
  },
  {
    id: "E6-night",
    bus: "E6",
    route: "EX",
    days: "weekday",
    name: "KDOJ to CP (FABU) · Night",
    via: "KDOJ · KDSE · CP",
    out: t("19:45 20:15"),
    back: t("20:00 22:00 23:00"),
  },
  {
    id: "F1",
    bus: "F1",
    route: "F",
    days: "weekday",
    name: "KTR to Lingkaran Ilmu",
    via: "KTR · KTHO · KTDI · Jln Amal · CP · KTR",
    out: t("7:05 7:35 8:05 8:35 9:05 9:35 11:35 12:15 12:55 13:35 14:15 16:25 17:05 17:45 18:25"),
    back: t(
      "7:20 7:50 8:20 8:50 9:20 9:50 11:15 11:55 12:35 13:15 13:55 14:35 16:05 16:45 17:25 18:05 18:45",
    ),
  },
  {
    id: "F2",
    bus: "F2",
    route: "F",
    days: "weekday",
    name: "KTR to Lingkaran Ilmu",
    via: "KTR · KTHO · KTDI · Jln Amal · CP · KTR",
    out: t(
      "7:15 7:45 8:15 8:45 9:15 9:45 11:45 12:25 13:05 13:45 14:25 16:35 17:15 17:55 19:45 20:15",
    ),
    back: t(
      "7:30 8:00 8:30 9:00 9:30 10:00 11:25 12:05 12:45 13:25 14:05 14:45 16:15 16:55 17:35 20:00 22:00 23:00",
    ),
  },
  {
    id: "G1",
    bus: "G1",
    route: "G",
    days: "weekday",
    name: "KTR / KTHO / KTDI to FKT",
    via: "via N24 · FKT (N29) · P19 · CP",
    out: t("7:00 7:30 8:00 8:30 9:00 9:30 11:40 12:20 13:00 13:40 14:20 16:20 17:00 17:40 18:20"),
    back: t(
      "7:15 7:45 8:15 8:45 9:15 9:45 11:20 12:00 12:40 13:20 14:00 14:40 16:00 16:40 17:20 18:00 18:40",
    ),
  },
  {
    id: "G2",
    bus: "G2",
    route: "G",
    days: "weekday",
    name: "KTR / KTHO / KTDI to FKT",
    via: "via N24 · FKT (N29) · P19 · CP",
    out: t("7:15 7:45 8:15 8:45 9:15 9:45 11:50 12:30 13:10 13:50 14:30 16:30 17:10 17:50 18:30"),
    back: t(
      "7:30 8:00 8:30 9:00 9:30 10:00 11:30 12:10 12:50 13:30 14:10 14:50 16:10 16:50 17:30 18:10 18:50",
    ),
  },
  {
    id: "H",
    bus: "H",
    route: "H",
    days: "weekday",
    name: "CP to V01 (Taman U)",
    via: "CP · Jln Amal · V01 · CP",
    out: t("7:15 7:45 8:15 8:45 9:15 9:45 11:20 12:00 12:40 13:20 14:00 16:00 16:40 17:20 18:00"),
    back: t("7:30 8:00 8:30 9:00 9:30 10:00 11:40 12:20 13:00 13:40 14:20 16:20 17:00 17:40 18:20"),
    inactive: true,
  },
  {
    id: "E1-weekend",
    bus: "E1",
    route: "EW",
    days: "weekend",
    name: "KDOJ / KLG / KDSE to K9/10",
    via: "via CP (outbound) · Jln Amal · KRP G11",
    out: t("7:30 9:00 11:00 13:00 15:00 17:00"),
    back: t("8:00 9:30 11:30 13:30 15:30 17:30"),
  },
  {
    id: "E2-weekend",
    bus: "E2",
    route: "EW",
    days: "weekend",
    name: "KDOJ / KLG / KDSE to K9/10",
    via: "via CP (outbound) · Jln Amal · KRP G11",
    out: t("8:00 10:00 12:00 14:00 16:00 18:00"),
    back: t("8:30 10:30 12:30 14:30 16:30 18:30"),
  },
];
