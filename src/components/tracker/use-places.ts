import { useEffect, useState } from "react";
import { STOPS } from "@/data/stops";
import { findOfficialUtmForPlace, isCampusCoordinate, UTM_CURATED_POIS } from "@/data/utm-official";
import type { Place } from "@/lib/journey";
import { metres } from "@/lib/shuttle";

export type PlaceCat =
  | "faculty"
  | "food"
  | "study"
  | "residence"
  | "shop"
  | "worship"
  | "sport"
  | "bank"
  | "health"
  | "place"
  | "stop";

export type PlaceEntry = Place & {
  cat: PlaceCat;
  officialUrl?: string | undefined;
  subtitle?: string | undefined;
};

export type PoiFilterGroup = "worship" | "faculty" | "residence" | "food" | "sport" | "services";

export type PoiCategoryMeta = {
  id: PoiFilterGroup;
  label: string;
  shortLabel: string;
  keywords: RegExp;
  exactCategory: RegExp;
};

export const POI_CATEGORIES: PoiCategoryMeta[] = [
  {
    id: "worship",
    label: "Mosques & Prayer Areas",
    shortLabel: "Mosques & Prayer",
    keywords:
      /\b(mosques?|masjid|prayers?|prayer areas?|prayer rooms?|surau|mush?olla|solat|worship)\b/i,
    exactCategory:
      /^(mosques?|masjid|prayers?|prayer areas?|prayer rooms?|surau|mush?olla|solat|worship|mosques? & prayer)$/i,
  },
  {
    id: "faculty",
    label: "Faculties & Libraries",
    shortLabel: "Faculties",
    keywords: /\b(facult(?:y|ies)|fakulti|librar(?:y|ies)|perpustakaan|schools?)\b/i,
    exactCategory:
      /^(facult(?:y|ies)|fakulti|librar(?:y|ies)|perpustakaan|faculties & libraries)$/i,
  },
  {
    id: "residence",
    label: "Residential Colleges",
    shortLabel: "Colleges",
    keywords: /\b(colleges?|kolej|hostels?|dorms?|residences?|residential)\b/i,
    exactCategory: /^(colleges?|kolej|hostels?|dorms?|residences?|residential colleges?)$/i,
  },
  {
    id: "food",
    label: "Food & Cafes",
    shortLabel: "Food",
    keywords: /\b(foods?|cafes?|cafeterias?|canteens?|kafe|restaurants?|dining|makan|ark[ae]d)\b/i,
    exactCategory: /^(foods?|cafes?|cafeterias?|canteens?|kafe|restaurants?|dining|food & cafes)$/i,
  },
  {
    id: "sport",
    label: "Sports & Stadium",
    shortLabel: "Sports",
    keywords: /\b(sports?|stadium|gyms?|courts?|pools?|swimming|futsal|badminton|track)\b/i,
    exactCategory: /^(sports?|stadium|gyms?|courts?|sports & stadium)$/i,
  },
  {
    id: "services",
    label: "Health, Banks & Shops",
    shortLabel: "Health & Bank",
    keywords: /\b(health|clinics?|klinik|medical|pku|banks?|atms?|shops?|marts?)\b/i,
    exactCategory: /^(health|clinics?|klinik|medical|banks?|atms?|shops?|health & bank)$/i,
  },
];

export function detectPoiCategory(q: string): {
  group: PoiFilterGroup;
  meta: PoiCategoryMeta;
  isExactCategory: boolean;
} | null {
  const s = q.trim();
  if (!s) return null;
  for (const meta of POI_CATEGORIES) {
    if (meta.exactCategory.test(s)) {
      return { group: meta.id, meta, isExactCategory: true };
    }
  }
  for (const meta of POI_CATEGORIES) {
    if (meta.keywords.test(s)) {
      return { group: meta.id, meta, isExactCategory: false };
    }
  }
  return null;
}

export function isBusStopQuery(q: string): boolean {
  const s = q.trim();
  return /\b(bus(?:es)?|bus stops?|stops?|shuttle|perhentian)\b/i.test(s);
}

let loading: Promise<PlaceEntry[]> | null = null;

function classifyOsmPlace(label: string, rawCat: PlaceCat): PlaceCat {
  if (
    /facult|fakulti|school of computing|\bn28|\bfke\b|p19a|\bfkm\b|\bfka\b|\bfkt\b|\bfabu\b|alam bina|biosciences|\bahibs\b|international business school|tamadun islam|fssh|mjiit/i.test(
      label,
    )
  ) {
    return "faculty";
  }
  return rawCat;
}

export function loadPlaces() {
  loading ??= import("@/data/places.json").then((m) => {
    const raw = (m.default as unknown as { p: [string, number, number, PlaceCat][] }).p;
    const out: PlaceEntry[] = UTM_CURATED_POIS.filter((seed) =>
      isCampusCoordinate(seed.lat, seed.lng, seed.label),
    ).map((seed) => ({
      label: seed.label,
      lat: seed.lat,
      lng: seed.lng,
      cat: seed.cat,
      officialUrl: seed.officialUrl,
      subtitle: seed.subtitle,
    }));

    const seenByKey = new Map<string, PlaceEntry[]>();
    for (const item of out) {
      const k = item.label.toLowerCase();
      seenByKey.set(k, [item]);
    }

    for (const [label, lat, lng, rawCat] of raw) {
      // Strictly exclude any POI outside the UTM campus footprint.
      if (!isCampusCoordinate(lat, lng, label)) continue;

      const cat = classifyOsmPlace(label, rawCat);
      const norm = label.toLowerCase().replace(/\s+/g, " ").trim();

      // Skip OSM duplicates that sit right on top of a curated official POI or duplicate same-name block within 180 m
      const nearCurated = out.some(
        (c) =>
          metres([lat, lng], [c.lat, c.lng]) < 120 &&
          (c.label.toLowerCase().includes(norm) ||
            norm.includes("chemical engineering") ||
            norm.includes("mechanical engineering") ||
            norm.includes("school of computing") ||
            norm.includes("alam bina") ||
            norm.includes("sultanah zanariah") ||
            norm.includes("raja zarith") ||
            norm.includes("masjid sultan ismail") ||
            norm.includes("sultan iskandar") ||
            norm.includes("ahibs")),
      );
      if (nearCurated) continue;

      const sameNameList = seenByKey.get(norm) ?? [];
      if (sameNameList.some((existing) => metres([lat, lng], [existing.lat, existing.lng]) < 180)) {
        continue;
      }

      const entry: PlaceEntry = {
        label,
        lat,
        lng,
        cat,
        officialUrl: findOfficialUtmForPlace(label, lat, lng),
      };
      out.push(entry);
      seenByKey.set(norm, [...sameNameList, entry]);
    }

    return out;
  });
  return loading;
}

/** On-campus places from OpenStreetMap + curated UTM landmarks. */
export function usePlaces(enabled: boolean) {
  const [places, setPlaces] = useState<PlaceEntry[] | null>(null);
  useEffect(() => {
    if (!enabled || places) return;
    let alive = true;
    loadPlaces()
      .then((p) => alive && setPlaces(p))
      .catch(() => alive && setPlaces([]));
    return () => {
      alive = false;
    };
  }, [enabled, places]);
  return places;
}

export function filterCampusPois(
  list: PlaceEntry[] | null,
  group: PoiFilterGroup | null,
): PlaceEntry[] {
  if (!list || !group) return [];
  const campusOnly = list.filter((p) => isCampusCoordinate(p.lat, p.lng, p.label));
  switch (group) {
    case "worship":
      return campusOnly
        .filter(
          (p) =>
            (p.cat === "worship" || /\b(masjid|surau|mush?olla)\b/i.test(p.label)) &&
            !/\b(gereja|church|temple|chapel|buddha|tianhougong|ma3)\b/i.test(p.label),
        )
        .sort((a, b) => {
          const aMain = /masjid sultan ismail/i.test(a.label) ? 0 : /masjid/i.test(a.label) ? 1 : 2;
          const bMain = /masjid sultan ismail/i.test(b.label) ? 0 : /masjid/i.test(b.label) ? 1 : 2;
          return aMain - bMain || a.label.localeCompare(b.label);
        });
    case "faculty":
      return campusOnly.filter((p) => p.cat === "faculty" || p.cat === "study");
    case "residence":
      return campusOnly.filter((p) => p.cat === "residence");
    case "food":
      return campusOnly.filter((p) => p.cat === "food");
    case "sport":
      return campusOnly.filter((p) => p.cat === "sport");
    case "services":
      return campusOnly.filter((p) => p.cat === "health" || p.cat === "bank" || p.cat === "shop");
  }
}

/** Matches direct text queries and expands category queries (e.g. "mosques", "prayer areas") over on-campus POIs only. */
export function searchPlaces(list: PlaceEntry[] | null, q: string, limit = 8): PlaceEntry[] {
  const s = q.trim().toLowerCase();
  if (!s || !list) return [];
  const words = s.split(/\s+/);
  const campusList = list.filter((p) => isCampusCoordinate(p.lat, p.lng, p.label));

  const directMatches = campusList
    .filter((p) => {
      const l = `${p.label} ${p.subtitle ?? ""}`.toLowerCase();
      return words.every((w) => l.includes(w));
    })
    .map((p) => {
      const l = p.label.toLowerCase();
      const officialBoost = p.subtitle ? 0 : 80;
      return {
        p,
        score:
          (l.startsWith(s) ? 0 : l.includes(` ${s}`) ? 1 : 2) * 1000 + officialBoost + l.length,
      };
    })
    .sort((a, b) => a.score - b.score)
    .map((x) => x.p);

  const detected = detectPoiCategory(s);
  if (!detected) {
    return directMatches.slice(0, limit);
  }

  const catMatches = filterCampusPois(campusList, detected.group);
  const seen = new Set(directMatches.map((p) => `${p.label}|${p.lat}|${p.lng}`));
  const combined = [...directMatches];
  for (const item of catMatches) {
    const key = `${item.label}|${item.lat}|${item.lng}`;
    if (!seen.has(key)) {
      seen.add(key);
      combined.push(item);
    }
  }
  return combined.slice(0, Math.max(limit, 80));
}

export function searchStops(q: string, limit = 6): PlaceEntry[] {
  const s = q.trim().toLowerCase();
  if (!s) return [];
  const all = STOPS.filter((x) => isCampusCoordinate(x.lat, x.lng, x.name)).map((x) => ({
    label: x.name,
    lat: x.lat,
    lng: x.lng,
    stopId: x.id,
    cat: "stop" as const,
    officialUrl: "https://www.utm.my",
  }));
  if (isBusStopQuery(s)) {
    const direct = all.filter((x) => x.label.toLowerCase().includes(s) || x.stopId.includes(s));
    return direct.length > 0 ? direct : all;
  }
  return all
    .filter((x) => x.label.toLowerCase().includes(s) || x.stopId.includes(s))
    .slice(0, limit);
}

/** Debounced live OSM Nominatim campus place search (strictly filtered inside UTM campus). */
export function useCampusOsmSearch(q: string, enabled: boolean): PlaceEntry[] {
  const [osmPlaces, setOsmPlaces] = useState<PlaceEntry[]>([]);
  useEffect(() => {
    const term = q.trim();
    if (!enabled || term.length < 2) {
      setOsmPlaces([]);
      return;
    }
    let alive = true;
    const timer = window.setTimeout(() => {
      import("@/lib/place-info")
        .then(({ searchCampusOsm }) => searchCampusOsm({ data: { query: term } }))
        .then((items) => {
          if (!alive) return;
          setOsmPlaces(
            items
              .filter((item) => isCampusCoordinate(item.lat, item.lng, item.label))
              .map((item) => ({
                label: item.label,
                lat: item.lat,
                lng: item.lng,
                cat: item.cat,
                subtitle: item.subtitle,
                officialUrl: item.officialUrl,
              })),
          );
        })
        .catch(() => {
          if (alive) setOsmPlaces([]);
        });
    }, 240);
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [q, enabled]);
  return osmPlaces;
}

/** Merge local campus POIs with live OSM campus search results, deduplicating nearby matches. */
export function mergeCampusSearchResults(
  local: PlaceEntry[],
  osm: PlaceEntry[],
  limit = 16,
): PlaceEntry[] {
  const merged: PlaceEntry[] = local.filter((p) => isCampusCoordinate(p.lat, p.lng, p.label));
  for (const item of osm) {
    if (!isCampusCoordinate(item.lat, item.lng, item.label)) continue;
    const norm = item.label.toLowerCase();
    const dup = merged.some(
      (existing) =>
        metres([existing.lat, existing.lng], [item.lat, item.lng]) < 80 &&
        (existing.label.toLowerCase().includes(norm) ||
          norm.includes(existing.label.toLowerCase())),
    );
    if (!dup) merged.push(item);
  }
  return merged.slice(0, limit);
}
