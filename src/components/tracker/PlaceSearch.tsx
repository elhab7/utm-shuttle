import { useEffect, useMemo, useRef, useState } from "react";
import { LocateFixed } from "lucide-react";
import type { Place } from "@/lib/journey";
import { PlaceIcon } from "./PlaceIcon";
import {
  mergeCampusSearchResults,
  searchPlaces,
  searchStops,
  useCampusOsmSearch,
  usePlaces,
} from "./use-places";

/** Inline search for a start point: bus stops and campus places (including live OSM campus places). */
export function PlaceSearch({
  placeholder,
  onPick,
  onUseLocation,
}: {
  placeholder: string;
  onPick: (p: Place) => void;
  onUseLocation?: () => void;
}) {
  const [q, setQ] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const places = usePlaces(true);
  const osmPlaces = useCampusOsmSearch(q, true);
  useEffect(() => input.current?.focus(), []);
  const results = useMemo(() => {
    const localPlaces = searchPlaces(places, q, 8);
    return [...searchStops(q, 4), ...mergeCampusSearchResults(localPlaces, osmPlaces, 10)];
  }, [places, osmPlaces, q]);
  return (
    <div className="mt-2">
      <input
        ref={input}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="h-10 w-full rounded-full border border-border bg-card px-4 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
      />
      <div className="mt-1 max-h-48 overflow-y-auto">
        {onUseLocation && !q.trim() && (
          <button
            onClick={onUseLocation}
            className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left text-sm font-medium hover:bg-secondary"
          >
            <span className="grid h-8 w-9 place-items-center rounded-xl bg-secondary text-primary">
              <LocateFixed className="h-4 w-4" />
            </span>
            Use my location
          </button>
        )}
        {results.map((p) => (
          <button
            key={`${p.cat}-${p.label}-${p.lat}`}
            onClick={() => onPick(p)}
            className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-secondary"
          >
            <PlaceIcon cat={p.cat} />
            <span className="truncate text-sm font-medium">{p.label}</span>
          </button>
        ))}
        {q.trim() && results.length === 0 && (
          <p className="px-2 py-3 text-sm text-muted-foreground">
            {places ? "No matches." : "Loading places…"}
          </p>
        )}
      </div>
    </div>
  );
}
