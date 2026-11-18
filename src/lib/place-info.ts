import { createServerFn } from "@tanstack/react-start";
import { isCampusCoordinate } from "@/data/utm-official";

export type PlaceInfoPayload = {
  displayName: string;
  category: string;
  openingHours: string;
  phone: string;
  road: string;
  postcode: string;
  osmUrl: string;
  officialTitle: string;
  officialSummary: string;
  officialUrl: string;
};

type CacheEntry<T> = { value: T; expiresAt: number };
const placeInfoCache = new Map<string, CacheEntry<PlaceInfoPayload>>();
const utmPageCache = new Map<string, CacheEntry<{ title: string; summary: string; url: string }>>();
const CACHE_TTL_MS = 1000 * 60 * 60 * 6;

function getCached<T>(map: Map<string, CacheEntry<T>>, key: string): T | null {
  const entry = map.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    map.delete(key);
    return null;
  }
  return entry.value;
}

function setCached<T>(map: Map<string, CacheEntry<T>>, key: string, value: T, max = 300) {
  if (map.size >= max) {
    const first = map.keys().next().value;
    if (first) map.delete(first);
  }
  map.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&#8211;|&ndash;/g, "–")
    .replace(/&#8212;|&mdash;/g, "—")
    .replace(/\s+/g, " ")
    .trim();
}

function isAllowedUtmUrl(rawUrl?: string): string | null {
  if (!rawUrl) return null;
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== "https:") return null;
    const host = parsed.hostname.toLowerCase();
    if (host === "utm.my" || host.endsWith(".utm.my")) return parsed.toString();
    return null;
  } catch {
    return null;
  }
}

async function fetchOfficialUtmMetadata(
  rawUrl?: string,
): Promise<{ title: string; summary: string; url: string } | null> {
  const safeUrl = isAllowedUtmUrl(rawUrl);
  if (!safeUrl) return null;
  const cached = getCached(utmPageCache, safeUrl);
  if (cached) return cached;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3500);
    const res = await fetch(safeUrl, {
      headers: {
        "User-Agent": "UTM-Johor-Shuttle-Navigator/1.0",
        Accept: "text/html",
      },
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return null;

    const html = (await res.text()).slice(0, 60000);
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const descMatch =
      html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i) ??
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i) ??
      html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i) ??
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:description["']/i);

    const payload = {
      title: titleMatch?.[1] ? decodeHtmlEntities(titleMatch[1]) : "",
      summary: descMatch?.[1] ? decodeHtmlEntities(descMatch[1]) : "",
      url: safeUrl,
    };
    setCached(utmPageCache, safeUrl, payload, 150);
    return payload;
  } catch {
    return null;
  }
}

export const fetchPlaceInfo = createServerFn({ method: "GET" })
  .inputValidator(
    (d: { label: string; lat: number; lng: number; officialUrl?: string | undefined }) => d,
  )
  .handler(async ({ data }): Promise<PlaceInfoPayload> => {
    const { label, lat, lng, officialUrl } = data;
    const cacheKey = `${lat.toFixed(4)},${lng.toFixed(4)}:${officialUrl ?? ""}:${label.toLowerCase()}`;
    const hit = getCached(placeInfoCache, cacheKey);
    if (hit) return hit;

    const fallbackOsmUrl = `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=18/${lat}/${lng}`;
    const safeInitialUrl = isAllowedUtmUrl(officialUrl) ?? "";

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 4000);
      const params = new URLSearchParams({
        lat: String(lat),
        lon: String(lng),
        format: "jsonv2",
        extratags: "1",
        addressdetails: "1",
        zoom: "18",
      });

      const nominatimPromise = fetch(
        `https://nominatim.openstreetmap.org/reverse?${params.toString()}`,
        {
          headers: {
            "User-Agent": "UTM-Johor-Shuttle-Navigator/1.0 (campus-navigation)",
            Accept: "application/json",
          },
          signal: controller.signal,
        },
      )
        .then((r) => (r.ok ? (r.json() as Promise<Record<string, unknown>>) : null))
        .catch(() => null)
        .finally(() => clearTimeout(timer));

      const [osmRaw, utmInitial] = await Promise.all([
        nominatimPromise,
        officialUrl ? fetchOfficialUtmMetadata(officialUrl) : Promise.resolve(null),
      ]);

      const osmData = (osmRaw ?? {}) as {
        display_name?: string;
        category?: string;
        type?: string;
        osm_type?: string;
        osm_id?: number;
        address?: Record<string, string>;
        extratags?: Record<string, string>;
      };

      const osmWebsite =
        osmData.extratags?.["website"] ?? osmData.extratags?.["contact:website"] ?? "";
      const utmMeta =
        utmInitial ?? (osmWebsite ? await fetchOfficialUtmMetadata(osmWebsite) : null);

      const osmLetter =
        osmData.osm_type === "node" ? "node" : osmData.osm_type === "relation" ? "relation" : "way";

      const payload: PlaceInfoPayload = {
        displayName: osmData.display_name ?? "",
        category: osmData.type ? osmData.type.replace(/_/g, " ") : (osmData.category ?? ""),
        openingHours: osmData.extratags?.["opening_hours"] ?? "",
        phone: osmData.extratags?.["phone"] ?? osmData.extratags?.["contact:phone"] ?? "",
        road: osmData.address?.["road"] ?? osmData.address?.["pedestrian"] ?? "",
        postcode: osmData.address?.["postcode"] ?? "81310",
        osmUrl: osmData.osm_id
          ? `https://www.openstreetmap.org/${osmLetter}/${osmData.osm_id}`
          : fallbackOsmUrl,
        officialTitle: utmMeta?.title ?? "",
        officialSummary: utmMeta?.summary ?? "",
        officialUrl: utmMeta?.url ?? safeInitialUrl,
      };
      setCached(placeInfoCache, cacheKey, payload);
      return payload;
    } catch {
      return {
        displayName: "",
        category: "",
        openingHours: "",
        phone: "",
        road: "",
        postcode: "81310",
        osmUrl: fallbackOsmUrl,
        officialTitle: "",
        officialSummary: "",
        officialUrl: safeInitialUrl,
      };
    }
  });

export function googleMapsPlaceUrl(label: string, lat: number, lng: number): string {
  const p = new URLSearchParams({
    api: "1",
    query: `${label} UTM Johor Bahru`,
    center: `${lat},${lng}`,
  });
  return `https://www.google.com/maps/search/?${p.toString()}`;
}

export function googleMapsDirectionsUrl(
  lat: number,
  lng: number,
  from?: { lat: number; lng: number } | null,
): string {
  const p = new URLSearchParams({ api: "1", destination: `${lat},${lng}`, travelmode: "walking" });
  if (from) p.set("origin", `${from.lat},${from.lng}`);
  return `https://www.google.com/maps/dir/?${p.toString()}`;
}

export type OsmSearchCat =
  | "faculty"
  | "food"
  | "study"
  | "residence"
  | "shop"
  | "worship"
  | "sport"
  | "bank"
  | "health"
  | "place";

export type OsmSearchPlace = {
  label: string;
  lat: number;
  lng: number;
  cat: OsmSearchCat;
  subtitle?: string;
  officialUrl?: string;
};

const osmSearchCache = new Map<string, CacheEntry<OsmSearchPlace[]>>();

function classifyOsmSearchItem(label: string, category?: string, type?: string): OsmSearchCat {
  const l = label.toLowerCase();
  const c = (category ?? "").toLowerCase();
  const t = (type ?? "").toLowerCase();

  if (
    t === "mosque" ||
    t === "place_of_worship" ||
    /\b(masjid|surau|mosque|mush?olla|islamic centre)\b/i.test(l)
  ) {
    return "worship";
  }
  if (
    t === "clinic" ||
    t === "hospital" ||
    t === "doctors" ||
    t === "pharmacy" ||
    /\b(pku|kesihatan|clinic|klinik|health|medical|pharmacy)\b/i.test(l)
  ) {
    return "health";
  }
  if (
    t === "bank" ||
    t === "atm" ||
    /\b(bank|atm|maybank|cimb|bank islam|muamalat|rhb)\b/i.test(l)
  ) {
    return "bank";
  }
  if (t === "library" || /\b(library|perpustakaan|psz|przs|study)\b/i.test(l)) {
    return "study";
  }
  if (
    /\b(kolej|ktdi|ktf|krp|ktho|ktr|ktc|kp|kdse|kdoj|k9|k10|kediaman|hostel|dormitory)\b/i.test(
      l,
    ) ||
    t === "dormitory"
  ) {
    return "residence";
  }
  if (
    /\b(facult|fakulti|school of computing|computing|electrical|mechanical|civil|chemical|built environment|science|management|ahibs|fssh|mjiit|n28|p19|c22|n29)\b/i.test(
      l,
    )
  ) {
    return "faculty";
  }
  if (
    t === "restaurant" ||
    t === "cafe" ||
    t === "fast_food" ||
    t === "food_court" ||
    t === "canteen" ||
    /\b(cafe|cafeteria|kafe|canteen|ark[ae]d|food|dining|bistro|restaurant)\b/i.test(l)
  ) {
    return "food";
  }
  if (
    c === "leisure" ||
    t === "stadium" ||
    t === "sports_centre" ||
    t === "pitch" ||
    t === "swimming_pool" ||
    /\b(stadium|sport|sukan|gym|court|pool|futsal|badminton|track)\b/i.test(l)
  ) {
    return "sport";
  }
  if (c === "shop" || /\b(shop|mart|kedai|coop|koperasi|store|bookstore|print)\b/i.test(l)) {
    return "shop";
  }
  return "place";
}

export const searchCampusOsm = createServerFn({ method: "GET" })
  .inputValidator((d: { query: string }) => d)
  .handler(async ({ data }): Promise<OsmSearchPlace[]> => {
    const q = data.query.trim();
    if (q.length < 2) return [];
    const cacheKey = q.toLowerCase();
    const cached = getCached(osmSearchCache, cacheKey);
    if (cached) return cached;

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 3500);
      const params = new URLSearchParams({
        q,
        format: "jsonv2",
        bounded: "1",
        viewbox: "103.615,1.580,103.662,1.543",
        countrycodes: "my",
        limit: "15",
        extratags: "1",
        addressdetails: "1",
      });
      const res = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
        headers: {
          "User-Agent": "UTM-Johor-Shuttle-Navigator/1.0 (campus-navigation)",
          Accept: "application/json",
        },
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!res.ok) return [];

      const rawList = (await res.json()) as Array<{
        name?: string;
        display_name?: string;
        lat?: string;
        lon?: string;
        category?: string;
        type?: string;
        address?: Record<string, string>;
        extratags?: Record<string, string>;
      }>;

      const results: OsmSearchPlace[] = [];
      const seen = new Set<string>();
      for (const item of rawList) {
        const lat = Number(item.lat);
        const lng = Number(item.lon);
        const firstPart = item.display_name?.split(",")[0]?.trim() ?? "";
        const label = (item.name?.trim() || firstPart).trim();
        if (
          !label ||
          !Number.isFinite(lat) ||
          !Number.isFinite(lng) ||
          !isCampusCoordinate(lat, lng, label)
        )
          continue;

        const dedupeKey = `${label.toLowerCase()}|${lat.toFixed(4)}|${lng.toFixed(4)}`;
        if (seen.has(dedupeKey)) continue;
        seen.add(dedupeKey);

        const cat = classifyOsmSearchItem(label, item.category, item.type);
        const road = item.address?.["road"] ?? item.address?.["pedestrian"] ?? "";
        const typeLabel = item.type ? item.type.replace(/_/g, " ") : "";
        const subtitle =
          road && typeLabel
            ? `${typeLabel} · ${road}`
            : road || (typeLabel && typeLabel !== "yes" ? typeLabel : "OSM Campus Place");
        const officialUrl =
          isAllowedUtmUrl(item.extratags?.["website"] ?? item.extratags?.["contact:website"]) ??
          "https://www.utm.my";

        results.push({ label, lat, lng, cat, subtitle, officialUrl });
      }

      setCached(osmSearchCache, cacheKey, results, 200);
      return results;
    } catch {
      return [];
    }
  });
