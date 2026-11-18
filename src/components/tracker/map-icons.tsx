import type { PlaceCat } from "./use-places";

const MAROON = "#6b1229";
const GOLD = "#F2A93B";

/** Compact top-down bus rotated along the road, with a small route number pill underneath. */
export function BusMarkerIcon({
  label,
  color,
  heading,
  selected,
  waiting,
  dark,
}: {
  label: string;
  color: string;
  heading: number;
  selected: boolean;
  waiting: boolean;
  dark: boolean;
}) {
  const h = Math.round(heading / 6) * 6;
  const outline = dark ? "#1f1416" : "#ffffff";
  const scale = selected ? 1.24 : 1;
  const S = Math.round(28 * scale);
  const pillW = Math.round((10 + label.length * 5.6) * scale);
  const pillH = Math.round(13 * scale);
  const W = Math.max(S + 4, pillW + 4);
  const H = S + pillH + 2;
  const cx = W / 2;
  const cy = S / 2;
  const filterId = `b-${label}-${selected ? "sel" : "std"}`;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={W}
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      className="select-none"
      aria-hidden="true"
    >
      <defs>
        <filter id={filterId} x="-40%" y="-40%" width="180%" height="180%">
          <feDropShadow dx="0" dy="1" stdDeviation="1.2" floodOpacity="0.35" />
        </filter>
      </defs>
      {selected && (
        <circle
          cx={cx}
          cy={cy}
          r={14.5 * scale}
          fill={GOLD}
          fillOpacity={0.24}
          stroke={GOLD}
          strokeWidth={2.4}
        />
      )}
      <g opacity={waiting ? 0.8 : 1}>
        <g
          transform={`translate(${cx} ${cy}) rotate(${h}) scale(${scale})`}
          filter={`url(#${filterId})`}
        >
          <rect
            x="-5"
            y="-10.5"
            width="10"
            height="21"
            rx="3"
            fill={color}
            stroke={outline}
            strokeWidth="1.6"
            strokeDasharray={waiting ? "3 2" : undefined}
          />
          <rect x="-3.5" y="-9" width="7" height="3.2" rx="1" fill="#e6f1fb" fillOpacity={0.95} />
          <rect x="-2.6" y="-3" width="5.2" height="5.5" rx="1" fill="#ffffff" fillOpacity={0.28} />
          <rect
            x="-3.2"
            y="7.2"
            width="6.4"
            height="1.8"
            rx="0.8"
            fill="#ffffff"
            fillOpacity={0.55}
          />
        </g>
        <rect
          x={cx - pillW / 2}
          y={S - 2}
          width={pillW}
          height={pillH}
          rx={pillH / 2}
          fill={color}
          stroke={outline}
          strokeWidth="1.5"
        />
        <text
          x={cx}
          y={S - 2 + pillH * 0.73}
          textAnchor="middle"
          fontFamily="Manrope, Arial, sans-serif"
          fontSize={(9 * scale).toFixed(1)}
          fontWeight="800"
          fill="#ffffff"
        >
          {label}
        </text>
      </g>
    </svg>
  );
}

/** Compact bus-stop marker: minimal rounded sign with a crisp bus glyph. */
export function StopMarkerIcon({ selected, dark }: { selected: boolean; dark: boolean }) {
  const s = selected ? 1.38 : 1;
  const W = 18;
  const H = 22;
  const plate = selected ? GOLD : MAROON;
  const glyph = selected ? MAROON : "#ffffff";
  const border = selected ? MAROON : dark ? "#f2d6c9" : "#ffffff";
  const filterId = `st-${selected ? "s" : "n"}-${dark ? "d" : "l"}`;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={Math.round(W * s)}
      height={Math.round(H * s)}
      viewBox={`0 0 ${W} ${H}`}
      className="select-none"
      aria-hidden="true"
    >
      <defs>
        <filter id={filterId} x="-40%" y="-40%" width="180%" height="180%">
          <feDropShadow dx="0" dy="1" stdDeviation="1" floodOpacity="0.32" />
        </filter>
      </defs>
      <g filter={`url(#${filterId})`}>
        <path
          d="M6.5 15.5 L9 20.5 L11.5 15.5 Z"
          fill={plate}
          stroke={border}
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
        <rect
          x="1.5"
          y="1.5"
          width="15"
          height="14.5"
          rx="4.5"
          fill={plate}
          stroke={border}
          strokeWidth="1.6"
        />
        <g
          transform="translate(5 4.7)"
          fill="none"
          stroke={glyph}
          strokeWidth="1.3"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="0.4" y="0.4" width="7.2" height="6.4" rx="1.4" />
          <path d="M0.4 3.8h7.2M2 8v-1.2M6 8v-1.2" />
        </g>
      </g>
    </svg>
  );
}

const CAT_BADGE: Record<PlaceCat, { bg: string; letter: string }> = {
  faculty: { bg: "#7a142e", letter: "F" },
  study: { bg: "#4f46e5", letter: "L" },
  residence: { bg: "#0f766e", letter: "K" },
  food: { bg: "#c2410c", letter: "C" },
  worship: { bg: "#047857", letter: "M" },
  sport: { bg: "#0369a1", letter: "S" },
  health: { bg: "#be123c", letter: "+" },
  bank: { bg: "#4338ca", letter: "$" },
  shop: { bg: "#b45309", letter: "B" },
  place: { bg: "#6b1229", letter: "P" },
  stop: { bg: "#6b1229", letter: "T" },
};

/** Compact campus POI pin for faculties, libraries, colleges, food, mosque, and services. */
export function PoiMarkerIcon({
  cat,
  selected,
  dark,
}: {
  cat: PlaceCat;
  selected: boolean;
  dark: boolean;
}) {
  const meta = CAT_BADGE[cat] ?? CAT_BADGE.place;
  const s = selected ? 1.3 : 1;
  const fill = selected ? GOLD : meta.bg;
  const fg = selected ? MAROON : "#ffffff";
  const border = selected ? MAROON : dark ? "#f5e3dc" : "#ffffff";
  const W = 22;
  const H = 27;
  const filterId = `poi-${cat}-${selected ? "s" : "n"}`;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={Math.round(W * s)}
      height={Math.round(H * s)}
      viewBox={`0 0 ${W} ${H}`}
      className="select-none"
      aria-hidden="true"
    >
      <defs>
        <filter id={filterId} x="-40%" y="-40%" width="180%" height="180%">
          <feDropShadow dx="0" dy="1" stdDeviation="1" floodOpacity="0.32" />
        </filter>
      </defs>
      <g filter={`url(#${filterId})`}>
        <path
          d="M8 18 L11 25 L14 18 Z"
          fill={fill}
          stroke={border}
          strokeWidth="1.3"
          strokeLinejoin="round"
        />
        <circle cx="11" cy="11" r="8.5" fill={fill} stroke={border} strokeWidth="1.6" />
        <text
          x="11"
          y="14.2"
          textAnchor="middle"
          fontFamily="Manrope, Arial, sans-serif"
          fontSize="9.5"
          fontWeight="800"
          fill={fg}
        >
          {meta.letter}
        </text>
      </g>
    </svg>
  );
}

/** Destination pin for directions. */
export function DestinationMarkerIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="30"
      height="39"
      viewBox="0 0 34 44"
      className="select-none"
      aria-hidden="true"
    >
      <defs>
        <filter id="dest-pin" x="-40%" y="-40%" width="180%" height="180%">
          <feDropShadow dx="0" dy="1.5" stdDeviation="1.6" floodOpacity="0.4" />
        </filter>
      </defs>
      <path
        filter="url(#dest-pin)"
        d="M17 42c-1.2-4.5-4.4-8.4-8-12.2C5.8 26.4 3 23 3 17a14 14 0 0 1 28 0c0 6-2.8 9.4-6 12.8-3.6 3.8-6.8 7.7-8 12.2z"
        fill={GOLD}
        stroke={MAROON}
        strokeWidth="2.5"
      />
      <circle cx="17" cy="17" r="5.5" fill={MAROON} />
    </svg>
  );
}

/** User location indicator dot. */
export function UserLocationDot({ isOrigin = false }: { isOrigin?: boolean }) {
  return (
    <span
      className={
        isOrigin
          ? "block h-4 w-4 rounded-full border-[3.5px] border-[#1a73e8] bg-white shadow-md"
          : "block h-4 w-4 rounded-full border-[3px] border-white bg-[#1a73e8] shadow-md"
      }
      aria-hidden="true"
    />
  );
}

export type MarkerIconSpec = {
  html: string;
  size: [number, number];
  anchor: [number, number];
};

const ICON_CACHE = new Map<string, MarkerIconSpec>();

function cached(key: string, build: () => MarkerIconSpec): MarkerIconSpec {
  let hit = ICON_CACHE.get(key);
  if (!hit) {
    hit = build();
    ICON_CACHE.set(key, hit);
  }
  return hit;
}

export function busMarkerSpec({
  label,
  color,
  heading,
  selected,
  waiting,
  dark,
}: {
  label: string;
  color: string;
  heading: number;
  selected: boolean;
  waiting: boolean;
  dark: boolean;
}): MarkerIconSpec {
  const h = Math.round(heading / 6) * 6;
  const key = `bus:${label}:${color}:${h}:${selected ? 1 : 0}:${waiting ? 1 : 0}:${dark ? 1 : 0}`;
  return cached(key, () => {
    const outline = dark ? "#1f1416" : "#ffffff";
    const scale = selected ? 1.24 : 1;
    const S = Math.round(28 * scale);
    const pillW = Math.round((10 + label.length * 5.6) * scale);
    const pillH = Math.round(13 * scale);
    const W = Math.max(S + 4, pillW + 4);
    const H = S + pillH + 2;
    const cx = W / 2;
    const cy = S / 2;
    const filterId = `b-${label}-${selected ? "sel" : "std"}`;

    const ring = selected
      ? `<circle cx="${cx}" cy="${cy}" r="${14.5 * scale}" fill="${GOLD}" fill-opacity="0.24" stroke="${GOLD}" stroke-width="2.4" />`
      : "";
    const dash = waiting ? `stroke-dasharray="3 2"` : "";

    const html = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="display:block;user-select:none" aria-hidden="true">
      <defs><filter id="${filterId}" x="-40%" y="-40%" width="180%" height="180%"><feDropShadow dx="0" dy="1" stdDeviation="1.2" flood-opacity="0.35" /></filter></defs>
      ${ring}
      <g opacity="${waiting ? 0.8 : 1}">
        <g transform="translate(${cx} ${cy}) rotate(${h}) scale(${scale})" filter="url(#${filterId})">
          <rect x="-5" y="-10.5" width="10" height="21" rx="3" fill="${color}" stroke="${outline}" stroke-width="1.6" ${dash} />
          <rect x="-3.5" y="-9" width="7" height="3.2" rx="1" fill="#e6f1fb" fill-opacity="0.95" />
          <rect x="-2.6" y="-3" width="5.2" height="5.5" rx="1" fill="#ffffff" fill-opacity="0.28" />
          <rect x="-3.2" y="7.2" width="6.4" height="1.8" rx="0.8" fill="#ffffff" fill-opacity="0.55" />
        </g>
        <rect x="${cx - pillW / 2}" y="${S - 2}" width="${pillW}" height="${pillH}" rx="${pillH / 2}" fill="${color}" stroke="${outline}" stroke-width="1.5" />
        <text x="${cx}" y="${S - 2 + pillH * 0.73}" text-anchor="middle" font-family="Manrope, Arial, sans-serif" font-size="${(9 * scale).toFixed(1)}" font-weight="800" fill="#ffffff">${label}</text>
      </g>
    </svg>`;

    return { html, size: [W, H], anchor: [cx, cy] };
  });
}

export function stopMarkerSpec(selected: boolean, dark: boolean): MarkerIconSpec {
  const key = `stop:${selected ? 1 : 0}:${dark ? 1 : 0}`;
  return cached(key, () => {
    const s = selected ? 1.38 : 1;
    const w = Math.round(18 * s);
    const h = Math.round(22 * s);
    const plate = selected ? GOLD : MAROON;
    const glyph = selected ? MAROON : "#ffffff";
    const border = selected ? MAROON : dark ? "#f2d6c9" : "#ffffff";
    const filterId = `st-${selected ? "s" : "n"}-${dark ? "d" : "l"}`;

    const html = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 18 22" style="display:block;user-select:none" aria-hidden="true">
      <defs><filter id="${filterId}" x="-40%" y="-40%" width="180%" height="180%"><feDropShadow dx="0" dy="1" stdDeviation="1" flood-opacity="0.32" /></filter></defs>
      <g filter="url(#${filterId})">
        <path d="M6.5 15.5 L9 20.5 L11.5 15.5 Z" fill="${plate}" stroke="${border}" stroke-width="1.2" stroke-linejoin="round" />
        <rect x="1.5" y="1.5" width="15" height="14.5" rx="4.5" fill="${plate}" stroke="${border}" stroke-width="1.6" />
        <g transform="translate(5 4.7)" fill="none" stroke="${glyph}" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round">
          <rect x="0.4" y="0.4" width="7.2" height="6.4" rx="1.4" />
          <path d="M0.4 3.8h7.2M2 8v-1.2M6 8v-1.2" />
        </g>
      </g>
    </svg>`;

    return { html, size: [w, h], anchor: [w / 2, h] };
  });
}

export function poiMarkerSpec(cat: PlaceCat, selected: boolean, dark: boolean): MarkerIconSpec {
  const key = `poi:${cat}:${selected ? 1 : 0}:${dark ? 1 : 0}`;
  return cached(key, () => {
    const meta = CAT_BADGE[cat] ?? CAT_BADGE.place;
    const s = selected ? 1.3 : 1;
    const fill = selected ? GOLD : meta.bg;
    const fg = selected ? MAROON : "#ffffff";
    const border = selected ? MAROON : dark ? "#f5e3dc" : "#ffffff";
    const w = Math.round(22 * s);
    const h = Math.round(27 * s);
    const filterId = `poi-${cat}-${selected ? "s" : "n"}`;

    const html = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 22 27" style="display:block;user-select:none" aria-hidden="true">
      <defs><filter id="${filterId}" x="-40%" y="-40%" width="180%" height="180%"><feDropShadow dx="0" dy="1" stdDeviation="1" flood-opacity="0.32" /></filter></defs>
      <g filter="url(#${filterId})">
        <path d="M8 18 L11 25 L14 18 Z" fill="${fill}" stroke="${border}" stroke-width="1.3" stroke-linejoin="round" />
        <circle cx="11" cy="11" r="8.5" fill="${fill}" stroke="${border}" stroke-width="1.6" />
        <text x="11" y="14.2" text-anchor="middle" font-family="Manrope, Arial, sans-serif" font-size="9.5" font-weight="800" fill="${fg}">${meta.letter}</text>
      </g>
    </svg>`;

    return { html, size: [w, h], anchor: [w / 2, h] };
  });
}

export function destinationMarkerSpec(): MarkerIconSpec {
  return cached("dest", () => {
    const html = `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="39" viewBox="0 0 34 44" style="display:block;user-select:none" aria-hidden="true">
      <defs><filter id="dest-pin" x="-40%" y="-40%" width="180%" height="180%"><feDropShadow dx="0" dy="1.5" stdDeviation="1.6" flood-opacity="0.4" /></filter></defs>
      <path filter="url(#dest-pin)" d="M17 42c-1.2-4.5-4.4-8.4-8-12.2C5.8 26.4 3 23 3 17a14 14 0 0 1 28 0c0 6-2.8 9.4-6 12.8-3.6 3.8-6.8 7.7-8 12.2z" fill="${GOLD}" stroke="${MAROON}" stroke-width="2.5" />
      <circle cx="17" cy="17" r="5.5" fill="${MAROON}" />
    </svg>`;
    return { html, size: [30, 39], anchor: [15, 39] };
  });
}

export function userDotSpec(isOrigin = false): MarkerIconSpec {
  return cached(`dot:${isOrigin ? 1 : 0}`, () => ({
    html: isOrigin
      ? `<span style="display:block;width:16px;height:16px;border-radius:9999px;border:3.5px solid #1a73e8;background:#ffffff;box-shadow:0 2px 6px rgba(0,0,0,0.35)" aria-hidden="true"></span>`
      : `<span style="display:block;width:16px;height:16px;border-radius:9999px;border:3px solid #ffffff;background:#1a73e8;box-shadow:0 2px 6px rgba(0,0,0,0.35)" aria-hidden="true"></span>`,
    size: [16, 16],
    anchor: [8, 8],
  }));
}

export function routeArrowSpec(heading: number): MarkerIconSpec {
  const h = Math.round(heading / 10) * 10;
  return cached(`arrow:${h}`, () => ({
    html: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 14 14" style="display:block;pointer-events:none" aria-hidden="true">
      <g transform="translate(7 7) rotate(${h})">
        <path d="M-3.2 2.2 L0 -2.6 L3.2 2.2" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" opacity="0.95" />
      </g>
    </svg>`,
    size: [14, 14],
    anchor: [7, 7],
  }));
}
