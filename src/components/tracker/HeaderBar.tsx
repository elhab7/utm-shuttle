import { useEffect, useMemo, useRef, useState } from "react";
import { BusFront, MapPinned, Menu, Navigation, Search, X } from "lucide-react";
import type { Place } from "@/lib/journey";
import { BUSES, fmt } from "@/lib/shuttle";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { BusBadge } from "./BusBadge";
import { PlaceIcon } from "./PlaceIcon";
import {
  detectPoiCategory,
  filterCampusPois,
  isBusStopQuery,
  loadPlaces,
  searchPlaces,
  searchStops,
  usePlaces,
  type PlaceEntry,
} from "./use-places";
import { DAYS, DAYS_LONG, busColor, busRunsOn, busServiceFor } from "./format";
import type { Clock, Selection } from "./types";

type Props = {
  clock: Clock;
  onMenu: () => void;
  onPick: (s: NonNullable<Selection>) => void;
  onDirections: (to: Place) => void;
  showBusStops: boolean;
  onSetBusStops: (on: boolean) => void;
  activeFilterLabel: string | null;
  onShowPoiResults: (filter: { label: string; places: PlaceEntry[] } | null) => void;
};

export function HeaderBar({
  clock,
  onMenu,
  onPick,
  onDirections,
  showBusStops,
  onSetBusStops,
  activeFilterLabel,
  onShowPoiResults,
}: Props) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const places = usePlaces(open);

  useEffect(() => {
    if (open) input.current?.focus();
  }, [open]);

  const detectedCat = useMemo(() => detectPoiCategory(q), [q]);
  const busStopSearch = useMemo(() => isBusStopQuery(q), [q]);

  const categoryMatches = useMemo(() => {
    if (!detectedCat || !places) return [];
    return filterCampusPois(places, detectedCat.group);
  }, [detectedCat, places]);

  const results = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return { buses: [], stops: [], places: [] };
    return {
      buses: BUSES.filter(
        ({ bus, services }) =>
          bus.toLowerCase().includes(s) ||
          services.some((x) => x.name.toLowerCase().includes(s) || x.via.toLowerCase().includes(s)),
      )
        .sort((a, b) => Number(busRunsOn(b.bus, clock.day)) - Number(busRunsOn(a.bus, clock.day)))
        .slice(0, 8),
      stops: searchStops(s, 8),
      places: searchPlaces(places, s, detectedCat ? 80 : 30),
    };
  }, [q, clock.day, places, detectedCat]);

  const close = () => {
    setOpen(false);
    setQ("");
  };

  const pick = (sel: NonNullable<Selection>) => {
    onPick(sel);
    close();
  };

  const directions = (to: Place) => {
    onDirections(to);
    close();
  };

  const pickPlace = (p: PlaceEntry) => {
    onPick({ type: "place", place: p });
    close();
  };

  const handleEnter = async () => {
    const raw = q.trim();
    if (!raw) return;
    const term = raw.toLowerCase();

    const exactBus = results.buses.find((x) => x.bus.toLowerCase() === term);
    const exactStop = results.stops.find(
      (x) =>
        x.stopId === term ||
        x.label.toLowerCase() === term ||
        x.label.toLowerCase().startsWith(`${term} `),
    );
    if (exactBus) {
      pick({ type: "bus", id: exactBus.bus });
      return;
    }
    if (exactStop) {
      pick({ type: "stop", id: exactStop.stopId! });
      return;
    }

    const loadedPlaces = places ?? (await loadPlaces());
    const cat = detectPoiCategory(raw);
    const matchedPlaces = searchPlaces(loadedPlaces, raw, 80);
    const catPlaces = cat ? filterCampusPois(loadedPlaces, cat.group) : [];

    if (cat && cat.isExactCategory && catPlaces.length > 0) {
      onPick(null as unknown as NonNullable<Selection>);
      onShowPoiResults({ label: cat.meta.shortLabel, places: catPlaces });
      close();
      return;
    }

    if (matchedPlaces.length === 1 && results.stops.length === 0) {
      pickPlace(matchedPlaces[0]!);
      return;
    }

    if (matchedPlaces.length > 0) {
      const label = cat ? cat.meta.shortLabel : raw;
      const list = cat && catPlaces.length > matchedPlaces.length ? catPlaces : matchedPlaces;
      onShowPoiResults({ label, places: list });
      close();
      return;
    }

    if (busStopSearch || results.stops.length > 0) {
      onSetBusStops(true);
      if (results.stops.length === 1) {
        pick({ type: "stop", id: results.stops[0]!.stopId! });
      } else if (results.stops.length > 1) {
        onShowPoiResults({ label: raw, places: results.stops });
        close();
      } else {
        close();
      }
      return;
    }

    if (results.buses[0]) {
      pick({ type: "bus", id: results.buses[0].bus });
    }
  };

  const hasResults = results.buses.length + results.stops.length + results.places.length > 0;

  return (
    <header className="relative z-[700] flex h-16 shrink-0 items-center gap-1 border-b border-white/15 bg-header-gradient px-2 text-header-foreground shadow-lg sm:px-3">
      <Button variant="header" size="iconLg" onClick={onMenu} aria-label="Open schedule menu">
        <Menu />
      </Button>
      <Button
        variant="header"
        size="iconLg"
        onClick={() => setOpen((o) => !o)}
        aria-label="Search buses, stops and places"
      >
        {open ? <X /> : <Search />}
      </Button>

      <div className="relative ml-1 flex min-w-0 flex-1 items-center">
        <div
          className={cn(
            "absolute inset-y-0 left-0 flex items-center transition-all duration-300",
            open ? "w-full opacity-100" : "pointer-events-none w-0 opacity-0",
          )}
        >
          <input
            ref={input}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") close();
              if (e.key === "Enter") {
                void handleEnter();
              }
            }}
            placeholder="Search bus, stop, mosque, faculty…"
            className="h-10 w-full rounded-full border border-white/25 bg-white/15 px-4 text-sm text-header-foreground placeholder:text-header-foreground/70 backdrop-blur-md focus:bg-white/20 focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>

        <div className={cn("min-w-0 transition-opacity duration-200", open && "opacity-0")}>
          <p className="font-display truncate text-base font-semibold leading-tight tracking-tight sm:text-lg">
            UTM Shuttle
          </p>
          <p className="flex items-center gap-1.5 text-[11px] opacity-85">
            <span
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                clock.live ? "bg-live animate-live-pulse" : "bg-accent",
              )}
            />
            {clock.live ? "Live" : "Simulated"} · {DAYS[clock.day]} {fmt(clock.minutes)}
          </p>
        </div>

        {open && q.trim() !== "" && (
          <div className="glass-panel scrollbar-thin absolute left-0 right-0 top-14 max-h-[65vh] overflow-y-auto rounded-3xl text-foreground">
            {detectedCat && categoryMatches.length > 0 && (
              <div className="border-b border-border p-2.5">
                <button
                  onClick={() => {
                    onShowPoiResults(
                      activeFilterLabel === detectedCat.meta.shortLabel
                        ? null
                        : { label: detectedCat.meta.shortLabel, places: categoryMatches },
                    );
                    close();
                  }}
                  className={cn(
                    "flex w-full items-center justify-between gap-2 rounded-2xl px-3.5 py-2.5 text-left text-xs font-semibold transition-colors",
                    activeFilterLabel === detectedCat.meta.shortLabel
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary/80 text-foreground hover:bg-secondary",
                  )}
                >
                  <span className="flex items-center gap-2">
                    <MapPinned className="h-4 w-4 shrink-0" />
                    {activeFilterLabel === detectedCat.meta.shortLabel
                      ? `Showing all ${categoryMatches.length} ${detectedCat.meta.label} on map (tap to clear)`
                      : `Show all ${categoryMatches.length} ${detectedCat.meta.label} on map`}
                  </span>
                </button>
              </div>
            )}

            {busStopSearch && (
              <div className="border-b border-border p-2.5">
                <button
                  onClick={() => {
                    onSetBusStops(!showBusStops);
                    close();
                  }}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-2xl px-3.5 py-2.5 text-left text-xs font-semibold transition-colors",
                    showBusStops
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary/80 text-foreground hover:bg-secondary",
                  )}
                >
                  <BusFront className="h-4 w-4 shrink-0" />
                  {showBusStops
                    ? "Bus stops & live buses are shown on map (tap to hide)"
                    : "Show all bus stops & live buses on map"}
                </button>
              </div>
            )}

            {!hasResults && !detectedCat && (
              <p className="px-4 py-5 text-sm text-muted-foreground">
                No matching buses, stops or places on campus.
              </p>
            )}
            {results.buses.length > 0 && (
              <div className="py-2">
                <p className="px-4 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Buses
                </p>
                {results.buses.map(({ bus }) => {
                  const svc = busServiceFor(bus, clock.day);
                  const runs = busRunsOn(bus, clock.day);
                  return (
                    <button
                      key={bus}
                      onClick={() => pick({ type: "bus", id: bus })}
                      className="flex w-full items-center gap-3 px-4 py-2 text-left transition-colors hover:bg-secondary/70"
                    >
                      <BusBadge bus={bus} color={busColor(bus, clock.day)} muted={!runs} />
                      <span className={cn("min-w-0", !runs && "opacity-60")}>
                        <span className="block truncate text-sm font-medium">{svc?.name}</span>
                        <span className="block truncate text-[11px] text-muted-foreground">
                          {runs ? svc?.via : `No service on ${DAYS_LONG[clock.day]}`}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
            {results.stops.length > 0 && (
              <div className="border-t border-border py-2">
                <p className="px-4 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Stops ({results.stops.length})
                </p>
                {results.stops.map((s) => (
                  <div
                    key={s.stopId}
                    className="flex items-center transition-colors hover:bg-secondary/70"
                  >
                    <button
                      onClick={() => pick({ type: "stop", id: s.stopId! })}
                      className="flex min-w-0 flex-1 items-center gap-3 py-2 pl-4 text-left"
                    >
                      <PlaceIcon cat="stop" />
                      <span className="truncate text-sm font-medium">{s.label}</span>
                    </button>
                    <DirectionsButton onClick={() => directions(s)} label={s.label} />
                  </div>
                ))}
              </div>
            )}
            {results.places.length > 0 && (
              <div className="border-t border-border py-2">
                <p className="px-4 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {detectedCat
                    ? `${detectedCat.meta.label} (${results.places.length})`
                    : `Campus places (${results.places.length})`}
                </p>
                {results.places.map((p) => (
                  <div
                    key={`${p.label}-${p.lat}-${p.lng}`}
                    className="flex items-center transition-colors hover:bg-secondary/70"
                  >
                    <button
                      onClick={() => pickPlace(p)}
                      className="flex min-w-0 flex-1 items-center gap-3 py-2 pl-4 text-left"
                    >
                      <PlaceIcon cat={p.cat} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{p.label}</span>
                        {p.subtitle && (
                          <span className="block truncate text-[11px] text-muted-foreground">
                            {p.subtitle}
                          </span>
                        )}
                      </span>
                    </button>
                    <DirectionsButton onClick={() => directions(p)} label={p.label} />
                  </div>
                ))}
              </div>
            )}
            {!places && (
              <p className="border-t border-border px-4 py-2 text-[11px] text-muted-foreground">
                Loading campus places…
              </p>
            )}
          </div>
        )}
      </div>

      <img
        src="/favicon.png"
        alt="Universiti Teknologi Malaysia"
        className="ml-auto h-11 w-11 shrink-0 rounded-full bg-white/90 object-cover p-0.5 shadow-md ring-2 ring-accent/80"
      />
    </header>
  );
}

function DirectionsButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      aria-label={`Directions to ${label}`}
      title="Get directions"
      className="mr-2 grid h-9 w-9 shrink-0 place-items-center rounded-full text-primary transition-colors hover:bg-card"
    >
      <Navigation className="h-4 w-4" />
    </button>
  );
}
