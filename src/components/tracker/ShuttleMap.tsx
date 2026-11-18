import { useEffect, useMemo, useRef, useState } from "react";
import type LType from "leaflet";
import { ROUTE_META, type RouteKey } from "@/data/schedule";
import { STOP_BY_ID, STOPS } from "@/data/stops";
import type { Journey, Place } from "@/lib/journey";
import { BUSES, busState, metres, ROUTES, SERVICES, serviceRunsOn } from "@/lib/shuttle";
import { cn } from "@/lib/utils";
import {
  busMarkerSpec,
  destinationMarkerSpec,
  poiMarkerSpec,
  routeArrowSpec,
  stopMarkerSpec,
  userDotSpec,
  type MarkerIconSpec,
} from "./map-icons";
import type { Clock, Selection } from "./types";
import type { PlaceEntry } from "./use-places";
import type { UserLocation } from "./use-user-location";

type Props = {
  clock: Clock;
  visibleBuses: Set<string>;
  showBusStops: boolean;
  pois: PlaceEntry[];
  poiFitNonce?: number;
  selection: Selection;
  onSelect: (s: Selection) => void;
  dark: boolean;
  focusNonce: number;
  userLocation: UserLocation | null;
  locateNonce: number;
  journey: Journey | null;
  journeyFrom: Place | null;
  journeyTo: Place | null;
  fitKey: string;
};

const CAMPUS: [number, number] = [1.5615, 103.638];

function toDivIcon(L: typeof LType, spec: MarkerIconSpec): LType.DivIcon {
  return L.divIcon({
    html: spec.html,
    iconSize: spec.size,
    iconAnchor: spec.anchor,
    className: "utm-osm-icon",
  });
}

function bearingDeg(a: [number, number], b: [number, number]): number {
  const k = Math.PI / 180;
  const x = (b[1] - a[1]) * k * Math.cos(((a[0] + b[0]) / 2) * k);
  const y = (b[0] - a[0]) * k;
  return (Math.atan2(x, y) * 180) / Math.PI;
}

function sampleRouteArrows(
  path: [number, number][],
  stepM = 190,
): Array<{ pos: [number, number]; heading: number }> {
  const arrows: Array<{ pos: [number, number]; heading: number }> = [];
  if (path.length < 2) return arrows;
  let nextTarget = 70;
  let dist = 0;

  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1]!;
    const b = path[i]!;
    const seg = metres(a, b);
    if (seg < 1) continue;
    while (dist + seg >= nextTarget) {
      const t = (nextTarget - dist) / seg;
      arrows.push({
        pos: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t],
        heading: bearingDeg(a, b),
      });
      nextTarget += stepM;
    }
    dist += seg;
  }
  return arrows;
}

export function ShuttleMap(props: Props) {
  const {
    clock,
    visibleBuses,
    showBusStops,
    pois,
    poiFitNonce = 0,
    selection,
    onSelect,
    dark,
    focusNonce,
    userLocation,
    locateNonce,
    journey,
    journeyFrom,
    journeyTo,
    fitKey,
  } = props;

  const containerRef = useRef<HTMLDivElement | null>(null);
  const leafletRef = useRef<typeof LType | null>(null);
  const mapRef = useRef<LType.Map | null>(null);
  const [mapReady, setMapReady] = useState(false);

  const routesLayerRef = useRef<LType.LayerGroup | null>(null);
  const journeyLayerRef = useRef<LType.LayerGroup | null>(null);
  const stopsLayerRef = useRef<LType.LayerGroup | null>(null);
  const poisLayerRef = useRef<LType.LayerGroup | null>(null);
  const busLayerRef = useRef<LType.LayerGroup | null>(null);
  const busMarkersRef = useRef(new Map<string, { marker: LType.Marker; iconKey: string }>());
  const userHaloRef = useRef<LType.Circle | null>(null);
  const userMarkerRef = useRef<LType.Marker | null>(null);
  const originMarkerRef = useRef<LType.Marker | null>(null);
  const destMarkerRef = useRef<LType.Marker | null>(null);

  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  // Initialize Leaflet + OpenStreetMap lazily on the client so SSR remains window-safe.
  useEffect(() => {
    let cancelled = false;
    const container = containerRef.current;
    if (!container) return;

    void import("leaflet").then((mod) => {
      if (cancelled || !containerRef.current) return;
      const L = (mod.default ?? mod) as typeof LType;
      leafletRef.current = L;

      const map = L.map(containerRef.current, {
        center: CAMPUS,
        zoom: 15,
        minZoom: 13,
        maxZoom: 19,
        zoomControl: false,
        attributionControl: true,
      });

      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>',
      }).addTo(map);

      routesLayerRef.current = L.layerGroup().addTo(map);
      journeyLayerRef.current = L.layerGroup().addTo(map);
      stopsLayerRef.current = L.layerGroup().addTo(map);
      poisLayerRef.current = L.layerGroup().addTo(map);
      busLayerRef.current = L.layerGroup().addTo(map);

      map.on("click", () => onSelectRef.current(null));

      mapRef.current = map;
      setMapReady(true);
    });

    return () => {
      cancelled = true;
      busMarkersRef.current.clear();
      userHaloRef.current = null;
      userMarkerRef.current = null;
      originMarkerRef.current = null;
      destMarkerRef.current = null;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      setMapReady(false);
    };
  }, []);

  const activeServices = useMemo(
    () => SERVICES.filter((s) => serviceRunsOn(s, clock.day) && visibleBuses.has(s.bus)),
    [clock.day, visibleBuses],
  );

  // Route lines remain hidden until a bus is tapped; then only that bus's routes for the day show.
  const shownRoutes = useMemo(() => {
    if (selection?.type !== "bus") return [] as RouteKey[];
    return Array.from(
      new Set(activeServices.filter((s) => s.bus === selection.id).map((s) => s.route)),
    );
  }, [selection, activeServices]);

  // Visible bus stops: shown when Bus Stops toggle is active, a stop/bus is selected, or part of an active journey.
  const visibleStops = useMemo(() => {
    const journeyStops = new Set<string>();
    if (journey) {
      for (const leg of journey.legs) {
        if (leg.kind === "bus") {
          journeyStops.add(leg.boardStop);
          journeyStops.add(leg.alightStop);
        }
      }
    }
    const served = new Set<string>();
    if (selection?.type === "bus") {
      for (const s of activeServices) {
        if (s.bus !== selection.id) continue;
        for (const h of [ROUTES[s.route].out, ROUTES[s.route].back]) {
          h.stops.forEach((st) => served.add(st.id));
        }
      }
    }
    return STOPS.filter((stop) => {
      const isSel = selection?.type === "stop" && selection.id === stop.id;
      return isSel || journeyStops.has(stop.id) || showBusStops || served.has(stop.id);
    });
  }, [activeServices, showBusStops, selection, journey]);

  // Visible POIs: active category filter results plus any selected place.
  const visiblePois = useMemo(() => {
    const list: PlaceEntry[] = [...pois];
    if (
      selection?.type === "place" &&
      !list.some(
        (p) =>
          p.label === selection.place.label &&
          Math.abs(p.lat - selection.place.lat) < 0.0001 &&
          Math.abs(p.lng - selection.place.lng) < 0.0001,
      )
    ) {
      list.push(selection.place);
    }
    return list;
  }, [pois, selection]);

  // Visible buses: shown when Bus Stops/shuttle layer is active, or when selected/part of journey.
  const visibleBusStates = useMemo(() => {
    const journeyBuses = new Set<string>();
    if (journey) {
      for (const leg of journey.legs) {
        if (leg.kind === "bus") journeyBuses.add(leg.trip.service.bus);
      }
    }

    const items: Array<{
      bus: string;
      pos: [number, number];
      heading: number;
      color: string;
      selected: boolean;
      waiting: boolean;
      zIndex: number;
    }> = [];

    for (const { bus } of BUSES) {
      const isSelected = selection?.type === "bus" && selection.id === bus;
      const inJourney = journeyBuses.has(bus);
      const shouldShow = isSelected || inJourney || (showBusStops && visibleBuses.has(bus));
      if (!shouldShow) continue;

      const st = busState(bus, clock.day, clock.minutes);
      if (st.kind === "off") continue;

      items.push({
        bus,
        pos: st.pos,
        heading: st.heading,
        color: ROUTE_META[st.trip.service.route].color,
        selected: isSelected,
        waiting: st.kind === "waiting",
        zIndex: isSelected ? 2000 : st.kind === "running" ? 1000 : 500,
      });
    }
    return items;
  }, [clock.day, clock.minutes, visibleBuses, showBusStops, selection, journey]);

  // Render bus stops
  useEffect(() => {
    const L = leafletRef.current;
    const layer = stopsLayerRef.current;
    if (!mapReady || !L || !layer) return;
    layer.clearLayers();

    for (const stop of visibleStops) {
      const isSel = selection?.type === "stop" && selection.id === stop.id;
      const marker = L.marker([stop.lat, stop.lng], {
        icon: toDivIcon(L, stopMarkerSpec(isSel, dark)),
        title: stop.name,
        zIndexOffset: isSel ? 900 : 10,
      });
      marker.on("click", (e) => {
        L.DomEvent.stopPropagation(e);
        onSelectRef.current({ type: "stop", id: stop.id });
      });
      marker.addTo(layer);
    }
  }, [mapReady, visibleStops, selection, dark]);

  // Render campus POI markers
  useEffect(() => {
    const L = leafletRef.current;
    const layer = poisLayerRef.current;
    if (!mapReady || !L || !layer) return;
    layer.clearLayers();

    for (const p of visiblePois) {
      const isSel =
        selection?.type === "place" &&
        selection.place.label === p.label &&
        Math.abs(selection.place.lat - p.lat) < 0.0001 &&
        Math.abs(selection.place.lng - p.lng) < 0.0001;
      const marker = L.marker([p.lat, p.lng], {
        icon: toDivIcon(L, poiMarkerSpec(p.cat, isSel, dark)),
        title: p.label,
        zIndexOffset: isSel ? 1100 : 20,
      });
      marker.on("click", (e) => {
        L.DomEvent.stopPropagation(e);
        onSelectRef.current({ type: "place", place: p });
      });
      marker.addTo(layer);
    }
  }, [mapReady, visiblePois, selection, dark]);

  // Smoothly update live bus markers without recreating DOM elements every tick
  useEffect(() => {
    const L = leafletRef.current;
    const layer = busLayerRef.current;
    if (!mapReady || !L || !layer) return;

    const seen = new Set<string>();
    const existing = busMarkersRef.current;

    for (const b of visibleBusStates) {
      seen.add(b.bus);
      const h6 = Math.round(b.heading / 6) * 6;
      const iconKey = `${b.color}:${h6}:${b.selected ? 1 : 0}:${b.waiting ? 1 : 0}:${dark ? 1 : 0}`;
      const entry = existing.get(b.bus);

      if (entry) {
        entry.marker.setLatLng(b.pos);
        entry.marker.setZIndexOffset(b.zIndex);
        if (entry.iconKey !== iconKey) {
          entry.marker.setIcon(
            toDivIcon(
              L,
              busMarkerSpec({
                label: b.bus,
                color: b.color,
                heading: b.heading,
                selected: b.selected,
                waiting: b.waiting,
                dark,
              }),
            ),
          );
          entry.iconKey = iconKey;
        }
      } else {
        const marker = L.marker(b.pos, {
          icon: toDivIcon(
            L,
            busMarkerSpec({
              label: b.bus,
              color: b.color,
              heading: b.heading,
              selected: b.selected,
              waiting: b.waiting,
              dark,
            }),
          ),
          title: `Bus ${b.bus}`,
          zIndexOffset: b.zIndex,
        });
        marker.on("click", (e) => {
          L.DomEvent.stopPropagation(e);
          onSelectRef.current({ type: "bus", id: b.bus });
        });
        marker.addTo(layer);
        existing.set(b.bus, { marker, iconKey });
      }
    }

    for (const [bus, entry] of existing) {
      if (!seen.has(bus)) {
        layer.removeLayer(entry.marker);
        existing.delete(bus);
      }
    }
  }, [mapReady, visibleBusStates, dark]);

  // Selected bus route polylines
  useEffect(() => {
    const L = leafletRef.current;
    const layer = routesLayerRef.current;
    if (!mapReady || !L || !layer) return;
    layer.clearLayers();
    if (shownRoutes.length === 0) return;

    for (const k of shownRoutes) {
      const color = ROUTE_META[k].color;
      for (const half of [ROUTES[k].out, ROUTES[k].back]) {
        L.polyline(half.path, {
          color: dark ? "#120b0c" : "#ffffff",
          opacity: 0.9,
          weight: 9,
          interactive: false,
        }).addTo(layer);
        L.polyline(half.path, {
          color,
          opacity: 0.95,
          weight: 5.5,
          interactive: false,
        }).addTo(layer);
        for (const arrow of sampleRouteArrows(half.path, 190)) {
          L.marker(arrow.pos, {
            icon: toDivIcon(L, routeArrowSpec(arrow.heading)),
            interactive: false,
          }).addTo(layer);
        }
      }
    }
  }, [mapReady, shownRoutes, dark]);

  // Planned trip legs: dotted walking legs and coloured bus legs
  useEffect(() => {
    const L = leafletRef.current;
    const layer = journeyLayerRef.current;
    if (!mapReady || !L || !layer) return;
    layer.clearLayers();
    if (!journey) return;

    for (const leg of journey.legs) {
      if (leg.kind === "walk") {
        L.polyline(leg.path, {
          color: dark ? "#0f172a" : "#ffffff",
          opacity: 0.9,
          weight: 7.5,
          dashArray: "0 12",
          lineCap: "round",
          interactive: false,
        }).addTo(layer);
        L.polyline(leg.path, {
          color: "#1a73e8",
          opacity: 1,
          weight: 4.5,
          dashArray: "0 12",
          lineCap: "round",
          interactive: false,
        }).addTo(layer);
      } else {
        const color = ROUTE_META[leg.trip.service.route].color;
        L.polyline(leg.path, {
          color: dark ? "#120b0c" : "#ffffff",
          opacity: 0.95,
          weight: 10,
          interactive: false,
        }).addTo(layer);
        L.polyline(leg.path, {
          color,
          opacity: 1,
          weight: 6.5,
          interactive: false,
        }).addTo(layer);
        for (const arrow of sampleRouteArrows(leg.path, 160)) {
          L.marker(arrow.pos, {
            icon: toDivIcon(L, routeArrowSpec(arrow.heading)),
            interactive: false,
          }).addTo(layer);
        }
      }
    }
  }, [mapReady, journey, dark]);

  // Journey destination + origin pins
  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!mapReady || !L || !map) return;

    if (destMarkerRef.current) {
      destMarkerRef.current.remove();
      destMarkerRef.current = null;
    }
    if (journeyTo) {
      destMarkerRef.current = L.marker([journeyTo.lat, journeyTo.lng], {
        icon: toDivIcon(L, destinationMarkerSpec()),
        title: journeyTo.label,
        zIndexOffset: 2500,
      }).addTo(map);
    }

    if (originMarkerRef.current) {
      originMarkerRef.current.remove();
      originMarkerRef.current = null;
    }
    if (journeyFrom) {
      originMarkerRef.current = L.marker([journeyFrom.lat, journeyFrom.lng], {
        icon: toDivIcon(L, userDotSpec(true)),
        title: journeyFrom.label,
        zIndexOffset: 2400,
      }).addTo(map);
    }
  }, [mapReady, journeyTo, journeyFrom]);

  // User location dot and accuracy halo
  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!mapReady || !L || !map) return;

    if (!userLocation) {
      userHaloRef.current?.remove();
      userHaloRef.current = null;
      userMarkerRef.current?.remove();
      userMarkerRef.current = null;
      return;
    }

    const center: [number, number] = [userLocation.lat, userLocation.lng];
    if (!userHaloRef.current) {
      userHaloRef.current = L.circle(center, {
        radius: userLocation.accuracy,
        fillColor: "#1a73e8",
        fillOpacity: 0.14,
        color: "#1a73e8",
        opacity: 0.38,
        weight: 1,
        interactive: false,
      }).addTo(map);
    } else {
      userHaloRef.current.setLatLng(center);
      userHaloRef.current.setRadius(userLocation.accuracy);
    }

    if (!userMarkerRef.current) {
      userMarkerRef.current = L.marker(center, {
        icon: toDivIcon(L, userDotSpec(false)),
        title: "Your location",
        zIndexOffset: 2300,
        interactive: false,
      }).addTo(map);
    } else {
      userMarkerRef.current.setLatLng(center);
    }
  }, [mapReady, userLocation]);

  // Fit bounds on planned trip
  const journeyRef = useRef(journey);
  journeyRef.current = journey;
  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    const j = journeyRef.current;
    if (!mapReady || !L || !map || !j || !fitKey) return;

    const coords: [number, number][] = [];
    for (const leg of j.legs) {
      for (const p of leg.path) coords.push(p);
    }
    if (coords.length === 0) return;

    const wide = window.innerWidth >= 640;
    map.fitBounds(L.latLngBounds(coords), {
      paddingTopLeft: wide ? [430, 88] : [28, 120],
      paddingBottomRight: wide ? [64, 48] : [28, Math.round(window.innerHeight * 0.56)],
      animate: true,
    });
  }, [mapReady, fitKey]);

  // Fit bounds when user filters a category or search results via Search
  const poisRef = useRef(pois);
  poisRef.current = pois;
  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    const list = poisRef.current;
    if (!mapReady || !L || !map || poiFitNonce === 0 || list.length === 0) return;
    const bounds = L.latLngBounds(list.map((p) => [p.lat, p.lng] as [number, number]));
    map.fitBounds(bounds, {
      paddingTopLeft: [48, 76],
      paddingBottomRight: [48, 72],
      maxZoom: 17,
      animate: true,
    });
  }, [mapReady, poiFitNonce]);

  // Pan to user location when requested
  const userLocRef = useRef(userLocation);
  userLocRef.current = userLocation;
  useEffect(() => {
    const map = mapRef.current;
    const loc = userLocRef.current;
    if (!mapReady || !map || !loc || locateNonce === 0) return;
    map.setView([loc.lat, loc.lng], Math.max(map.getZoom(), 17), { animate: true });
  }, [mapReady, locateNonce]);

  // Pan to selected bus, stop, or campus place
  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map || !selection) return;
    let target: [number, number] | null = null;
    if (selection.type === "stop") {
      const s = STOP_BY_ID[selection.id];
      if (s) target = [s.lat, s.lng];
    } else if (selection.type === "place") {
      target = [selection.place.lat, selection.place.lng];
    } else {
      const st = busState(selection.id, clock.day, clock.minutes);
      if (st.kind !== "off") target = st.pos;
    }
    if (target) {
      map.setView(target, Math.max(map.getZoom(), 16), { animate: true });
    }
    // Only pan when user explicitly picks an item, not on every clock tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapReady, focusNonce]);

  return (
    <div
      ref={containerRef}
      className={cn(
        "utm-osm-map absolute inset-0 z-0 isolate h-full w-full",
        dark && "utm-osm-dark",
      )}
      aria-label="Campus shuttle map"
    />
  );
}
