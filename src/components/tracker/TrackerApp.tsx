import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LoaderCircle, LocateFixed, LocateOff, X } from "lucide-react";
import { planJourney, type Place, type PlanResult } from "@/lib/journey";
import { advanceClock, BUSES, malaysiaNow } from "@/lib/shuttle";
import { loadWalkGraph, type WalkGraph } from "@/lib/walk-graph";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { DirectionsPanel } from "./DirectionsPanel";
import { HeaderBar } from "./HeaderBar";
import { InfoCard } from "./InfoCard";
import { SchedulePanel } from "./SchedulePanel";
import { ShuttleMap } from "./ShuttleMap";
import type { Clock, Selection } from "./types";
import type { PlaceEntry } from "./use-places";
import { useUserLocation } from "./use-user-location";

type Mode = { live: true } | { live: false; day: number; startMin: number; setAt: number };

function readClock(mode: Mode): Clock {
  if (mode.live) return { ...malaysiaNow(), live: true };
  const elapsed = (Date.now() - mode.setAt) / 60000;
  return { ...advanceClock(mode.day, mode.startMin, elapsed), live: false };
}

function usePrefersDark() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    setDark(mq.matches);
    const on = (e: MediaQueryListEvent) => setDark(e.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return dark;
}

export function TrackerApp() {
  const [mode, setMode] = useState<Mode>({ live: true });
  const [clock, setClock] = useState<Clock>(() => readClock({ live: true }));
  const [menuOpen, setMenuOpen] = useState(false);
  const [visibleBuses, setVisibleBuses] = useState<Set<string>>(
    () => new Set(BUSES.map((b) => b.bus)),
  );
  const [showBusStops, setShowBusStops] = useState(true);
  const [poiFilter, setPoiFilter] = useState<{ label: string; places: PlaceEntry[] } | null>(null);
  const [poiFitNonce, setPoiFitNonce] = useState(0);
  const [selection, setSelection] = useState<Selection>(null);
  const [focusNonce, setFocusNonce] = useState(0);
  const dark = usePrefersDark();

  const activePois = useMemo(() => poiFilter?.places ?? [], [poiFilter]);

  const showPoiResults = useCallback((filter: { label: string; places: PlaceEntry[] } | null) => {
    setPoiFilter(filter);
    if (filter && filter.places.length > 0) {
      setSelection(null);
      setDirectionsTo(null);
      setPoiFitNonce((n) => n + 1);
    }
  }, []);

  const { location: userLocation, status: locStatus, start: startLocation } = useUserLocation();
  const [locateNonce, setLocateNonce] = useState(0);
  const [wantCenter, setWantCenter] = useState(false);
  const [locNotice, setLocNotice] = useState<string | null>(null);

  // Multimodal directions state (walking + campus shuttle + walking)
  const [directionsTo, setDirectionsTo] = useState<Place | null>(null);
  const [directionsFrom, setDirectionsFrom] = useState<Place | null>(null);
  const [routeTime, setRouteTime] = useState<{ day: number; minutes: number } | null>(null);
  const [selectedJourneyId, setSelectedJourneyId] = useState<string | null>(null);
  const [walkGraph, setWalkGraph] = useState<WalkGraph | null>(null);
  const [graphError, setGraphError] = useState(false);
  const [fitNonce, setFitNonce] = useState(0);
  const planTimeRef = useRef<{ day: number; minutes: number }>({
    day: clock.day,
    minutes: clock.minutes,
  });

  useEffect(() => {
    if (!directionsTo) return;
    if (!directionsFrom && locStatus === "idle") startLocation();
    if (!walkGraph && !graphError) {
      loadWalkGraph()
        .then(setWalkGraph)
        .catch(() => setGraphError(true));
    }
  }, [directionsTo, directionsFrom, locStatus, startLocation, walkGraph, graphError]);

  const liveMinute = Math.floor(clock.minutes);
  const effectiveRouteDay = routeTime?.day ?? (clock.live ? clock.day : planTimeRef.current.day);
  const effectiveRouteMinutes =
    routeTime?.minutes ?? (clock.live ? liveMinute : Math.floor(planTimeRef.current.minutes));

  const planResult: PlanResult | null = useMemo(() => {
    if (!directionsTo || !walkGraph) return null;
    const fromPlace: Place | null =
      directionsFrom ??
      (userLocation
        ? { label: "Your location", lat: userLocation.lat, lng: userLocation.lng }
        : null);
    if (!fromPlace) return null;
    return planJourney(
      walkGraph,
      fromPlace,
      directionsTo,
      effectiveRouteDay,
      effectiveRouteMinutes,
    );
  }, [
    directionsTo,
    directionsFrom,
    userLocation,
    walkGraph,
    effectiveRouteDay,
    effectiveRouteMinutes,
  ]);

  const effectiveFrom: Place | null = useMemo(() => {
    if (directionsFrom) return directionsFrom;
    if (userLocation)
      return { label: "Your location", lat: userLocation.lat, lng: userLocation.lng };
    return null;
  }, [directionsFrom, userLocation]);

  const selectedJourney = useMemo(() => {
    if (!planResult || planResult.options.length === 0) return null;
    return planResult.options.find((o) => o.id === selectedJourneyId) ?? planResult.options[0]!;
  }, [planResult, selectedJourneyId]);

  const fitKey = useMemo(() => {
    if (!selectedJourney || !directionsTo) return "";
    return `${fitNonce}-${directionsTo.label}-${effectiveFrom?.lat ?? 0}-${selectedJourney.id}`;
  }, [fitNonce, selectedJourney, directionsTo, effectiveFrom]);

  useEffect(() => {
    if (wantCenter && userLocation) {
      setLocateNonce((n) => n + 1);
      setWantCenter(false);
    }
  }, [wantCenter, userLocation]);

  useEffect(() => {
    if (locStatus !== "denied" && locStatus !== "unavailable") return;
    setWantCenter(false);
    setLocNotice(
      locStatus === "denied"
        ? "Location is blocked. Allow location for this site in your browser settings."
        : "Couldn't find your location. Check that location is turned on.",
    );
    const id = window.setTimeout(() => setLocNotice(null), 6000);
    return () => window.clearTimeout(id);
  }, [locStatus]);

  const locate = () => {
    setLocNotice(null);
    startLocation();
    setWantCenter(true);
  };

  useEffect(() => {
    setClock(readClock(mode));
    const id = window.setInterval(() => setClock(readClock(mode)), 1000);
    return () => window.clearInterval(id);
  }, [mode]);

  const select = useCallback((s: Selection) => {
    if (s) setDirectionsTo(null);
    setSelection(s);
    if (s) setFocusNonce((n) => n + 1);
  }, []);

  const openDirections = useCallback(
    (to: Place) => {
      setSelection(null);
      setDirectionsTo(to);
      setRouteTime(null);
      setSelectedJourneyId(null);
      planTimeRef.current = { day: clock.day, minutes: clock.minutes };
      setFitNonce((n) => n + 1);
      if (locStatus === "idle") startLocation();
    },
    [clock.day, clock.minutes, locStatus, startLocation],
  );

  const setCustom = (day: number, startMin: number) => {
    planTimeRef.current = { day, minutes: startMin };
    setMode({ live: false, day, startMin, setAt: Date.now() });
  };

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background">
      <HeaderBar
        clock={clock}
        onMenu={() => setMenuOpen(true)}
        onPick={(s) => {
          if (!s) {
            select(null);
            return;
          }
          if (s.type === "bus") setVisibleBuses((v) => new Set(v).add(s.id));
          select(s);
        }}
        onDirections={openDirections}
        showBusStops={showBusStops}
        onSetBusStops={setShowBusStops}
        activeFilterLabel={poiFilter?.label ?? null}
        onShowPoiResults={showPoiResults}
      />

      <main className="relative min-h-0 flex-1">
        <ShuttleMap
          clock={clock}
          visibleBuses={visibleBuses}
          showBusStops={showBusStops}
          pois={activePois}
          poiFitNonce={poiFitNonce}
          selection={selection}
          onSelect={select}
          dark={dark}
          focusNonce={focusNonce}
          userLocation={userLocation}
          locateNonce={locateNonce}
          journey={directionsTo ? selectedJourney : null}
          journeyFrom={directionsTo ? effectiveFrom : null}
          journeyTo={directionsTo}
          fitKey={fitKey}
        />

        {poiFilter && (
          <button
            onClick={() => setPoiFilter(null)}
            className="glass-panel pointer-events-auto absolute left-3 top-3 z-[500] flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-semibold text-foreground transition-colors hover:bg-secondary/80 sm:left-4"
            aria-label={`Clear ${poiFilter.label} filter`}
          >
            <span>
              {poiFilter.label} · {activePois.length}
            </span>
            <X className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        )}

        <button
          onClick={locate}
          aria-label="Show my location"
          title="Show my location"
          className={cn(
            "glass-panel pointer-events-auto absolute bottom-8 right-3 z-[500] grid h-11 w-11 place-items-center rounded-full transition-colors sm:bottom-8 sm:right-4",
            locStatus === "on" ? "text-primary" : "text-foreground",
          )}
        >
          {locStatus === "locating" ? (
            <LoaderCircle className="h-5 w-5 animate-spin" />
          ) : locStatus === "denied" ? (
            <LocateOff className="h-5 w-5 text-muted-foreground" />
          ) : (
            <LocateFixed className="h-5 w-5" />
          )}
        </button>

        {locNotice && (
          <p
            role="status"
            className="glass-panel pointer-events-auto absolute bottom-21 right-3 z-[500] max-w-[240px] rounded-2xl px-3 py-2 text-xs font-medium sm:bottom-21 sm:right-4"
          >
            {locNotice}
          </p>
        )}

        {selection && !directionsTo && (
          <InfoCard
            clock={clock}
            selection={selection}
            visibleBuses={visibleBuses}
            onSelect={select}
            onDirections={openDirections}
            userLocation={userLocation}
          />
        )}

        {directionsTo && (
          <DirectionsPanel
            routeDay={effectiveRouteDay}
            routeMinutes={effectiveRouteMinutes}
            isCustomTime={routeTime !== null}
            onRouteTime={(t) => {
              setRouteTime(t);
              setSelectedJourneyId(null);
            }}
            to={directionsTo}
            from={directionsFrom}
            locStatus={locStatus}
            hasLocation={Boolean(userLocation)}
            graphReady={Boolean(walkGraph)}
            graphError={graphError}
            result={planResult}
            selected={selectedJourney}
            onSelect={(id) => {
              setSelectedJourneyId(id);
              setFitNonce((n) => n + 1);
            }}
            onFrom={(p) => {
              setDirectionsFrom(p);
              setFitNonce((n) => n + 1);
            }}
            onClose={() => {
              setDirectionsTo(null);
              setRouteTime(null);
            }}
          />
        )}
      </main>

      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent
          side="left"
          className="w-[90vw] gap-0 overflow-hidden border-border bg-sidebar p-0 backdrop-blur-2xl sm:max-w-[400px] [&>button]:text-header-foreground"
        >
          <SheetTitle className="sr-only">Shuttle schedule</SheetTitle>
          <SheetDescription className="sr-only">
            Choose day and time and filter buses
          </SheetDescription>
          <SchedulePanel
            clock={clock}
            onDay={(d) => setCustom(d, clock.minutes)}
            onTime={(m) => setCustom(clock.day, m)}
            onLive={() => setMode({ live: true })}
            visibleBuses={visibleBuses}
            onToggleBus={(bus, on) => {
              if (on) setShowBusStops(true);
              setVisibleBuses((v) => {
                const n = new Set(v);
                if (on) n.add(bus);
                else n.delete(bus);
                return n;
              });
            }}
            onSetAll={(on) => {
              setShowBusStops(on);
              setVisibleBuses(on ? new Set(BUSES.map((b) => b.bus)) : new Set());
            }}
            onPickBus={(bus) => {
              setVisibleBuses((v) => new Set(v).add(bus));
              select({ type: "bus", id: bus });
              setMenuOpen(false);
            }}
          />
        </SheetContent>
      </Sheet>
    </div>
  );
}
