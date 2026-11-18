import { useEffect, useMemo, useRef } from "react";
import {
  APILoadingStatus,
  APIProvider,
  AdvancedMarker,
  AdvancedMarkerAnchorPoint,
  ColorScheme,
  Map as GoogleMap,
  useApiLoadingStatus,
  useMap,
  useMapsLibrary,
} from "@vis.gl/react-google-maps";
import { ROUTE_META, type RouteKey } from "@/data/schedule";
import { STOP_BY_ID, STOPS } from "@/data/stops";
import type { Journey, Place } from "@/lib/journey";
import { BUSES, busState, ROUTES, SERVICES, serviceRunsOn } from "@/lib/shuttle";
import {
  BusMarkerIcon,
  DestinationMarkerIcon,
  PoiMarkerIcon,
  StopMarkerIcon,
  UserLocationDot,
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

const CAMPUS = { lat: 1.5615, lng: 103.638 };
const MAPS_LIBRARIES = ["marker"];

export function ShuttleMap(props: Props) {
  const apiKey = import.meta.env["VITE_GOOGLE_MAPS_API_KEY"] ?? "";
  const {
    clock,
    visibleBuses,
    showBusStops,
    pois,
    selection,
    onSelect,
    dark,
    userLocation,
    journey,
    journeyFrom,
    journeyTo,
  } = props;

  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

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

  return (
    <div className="absolute inset-0 z-0 isolate h-full w-full" aria-label="Campus shuttle map">
      <APIProvider apiKey={apiKey} language="en" region="MY" libraries={MAPS_LIBRARIES}>
        <MapStatusWatcher />
        <GoogleMap
          mapId="DEMO_MAP_ID"
          colorScheme={dark ? ColorScheme.DARK : ColorScheme.LIGHT}
          defaultCenter={CAMPUS}
          defaultZoom={15}
          gestureHandling="greedy"
          disableDefaultUI
          clickableIcons={false}
          internalUsageAttributionIds={["gmp_mcp_codeassist_v1_aistudio"]}
          onClick={() => onSelectRef.current(null)}
          className="h-full w-full"
        >
          <MapEffectsOverlay
            shownRoutes={shownRoutes}
            dark={dark}
            journey={journey}
            fitKey={props.fitKey}
            pois={pois}
            poiFitNonce={props.poiFitNonce ?? 0}
            userLocation={userLocation}
            locateNonce={props.locateNonce}
            selection={selection}
            focusNonce={props.focusNonce}
            clock={clock}
          />

          {visibleStops.map((stop) => {
            const isSel = selection?.type === "stop" && selection.id === stop.id;
            return (
              <AdvancedMarker
                key={`stop-${stop.id}`}
                position={{ lat: stop.lat, lng: stop.lng }}
                title={stop.name}
                anchorPoint={AdvancedMarkerAnchorPoint.BOTTOM}
                zIndex={isSel ? 900 : 10}
                onClick={() => onSelectRef.current({ type: "stop", id: stop.id })}
              >
                <StopMarkerIcon selected={isSel} dark={dark} />
              </AdvancedMarker>
            );
          })}

          {visiblePois.map((p) => {
            const isSel =
              selection?.type === "place" &&
              selection.place.label === p.label &&
              Math.abs(selection.place.lat - p.lat) < 0.0001 &&
              Math.abs(selection.place.lng - p.lng) < 0.0001;
            return (
              <AdvancedMarker
                key={`poi-${p.label}-${p.lat}-${p.lng}`}
                position={{ lat: p.lat, lng: p.lng }}
                title={p.label}
                anchorPoint={AdvancedMarkerAnchorPoint.BOTTOM}
                zIndex={isSel ? 1100 : 20}
                onClick={() => onSelectRef.current({ type: "place", place: p })}
              >
                <PoiMarkerIcon cat={p.cat} selected={isSel} dark={dark} />
              </AdvancedMarker>
            );
          })}

          {visibleBusStates.map((b) => (
            <AdvancedMarker
              key={`bus-${b.bus}`}
              position={{ lat: b.pos[0], lng: b.pos[1] }}
              title={`Bus ${b.bus}`}
              anchorPoint={AdvancedMarkerAnchorPoint.CENTER}
              zIndex={b.zIndex}
              onClick={() => onSelectRef.current({ type: "bus", id: b.bus })}
            >
              <BusMarkerIcon
                label={b.bus}
                color={b.color}
                heading={b.heading}
                selected={b.selected}
                waiting={b.waiting}
                dark={dark}
              />
            </AdvancedMarker>
          ))}

          {journeyTo && (
            <AdvancedMarker
              position={{ lat: journeyTo.lat, lng: journeyTo.lng }}
              title={journeyTo.label}
              anchorPoint={AdvancedMarkerAnchorPoint.BOTTOM}
              zIndex={2500}
            >
              <DestinationMarkerIcon />
            </AdvancedMarker>
          )}

          {journeyFrom && (
            <AdvancedMarker
              position={{ lat: journeyFrom.lat, lng: journeyFrom.lng }}
              title={journeyFrom.label}
              anchorPoint={AdvancedMarkerAnchorPoint.CENTER}
              zIndex={2400}
            >
              <UserLocationDot isOrigin />
            </AdvancedMarker>
          )}

          {userLocation && (
            <AdvancedMarker
              position={{ lat: userLocation.lat, lng: userLocation.lng }}
              title="Your location"
              anchorPoint={AdvancedMarkerAnchorPoint.CENTER}
              zIndex={2300}
            >
              <UserLocationDot />
            </AdvancedMarker>
          )}
        </GoogleMap>
      </APIProvider>
    </div>
  );
}

function MapStatusWatcher() {
  const status = useApiLoadingStatus();
  useEffect(() => {
    if (status === APILoadingStatus.AUTH_FAILURE) {
      window.dispatchEvent(new CustomEvent("gmp-quota-exceeded"));
    }
  }, [status]);
  return null;
}

function MapEffectsOverlay({
  shownRoutes,
  dark,
  journey,
  fitKey,
  pois,
  poiFitNonce,
  userLocation,
  locateNonce,
  selection,
  focusNonce,
  clock,
}: {
  shownRoutes: RouteKey[];
  dark: boolean;
  journey: Journey | null;
  fitKey: string;
  pois: PlaceEntry[];
  poiFitNonce: number;
  userLocation: UserLocation | null;
  locateNonce: number;
  selection: Selection;
  focusNonce: number;
  clock: Clock;
}) {
  const map = useMap();
  const mapsLib = useMapsLibrary("maps");

  // Route polylines for selected bus
  useEffect(() => {
    if (!map || !mapsLib || shownRoutes.length === 0) return;
    const polylines: google.maps.Polyline[] = [];
    const arrowSymbol: google.maps.Symbol = {
      path: google.maps.SymbolPath.FORWARD_OPEN_ARROW,
      scale: 2.1,
      strokeColor: "#ffffff",
      strokeWeight: 1.8,
      strokeOpacity: 0.95,
    };

    for (const k of shownRoutes) {
      for (const half of [ROUTES[k].out, ROUTES[k].back]) {
        const path = half.path.map(([lat, lng]) => ({ lat, lng }));
        polylines.push(
          new mapsLib.Polyline({
            map,
            path,
            strokeColor: dark ? "#120b0c" : "#ffffff",
            strokeOpacity: 0.9,
            strokeWeight: 9,
            clickable: false,
            zIndex: 10,
          }),
          new mapsLib.Polyline({
            map,
            path,
            strokeColor: ROUTE_META[k].color,
            strokeOpacity: 0.95,
            strokeWeight: 5.5,
            clickable: false,
            zIndex: 11,
            icons: [{ icon: arrowSymbol, offset: "45px", repeat: "150px" }],
          }),
        );
      }
    }

    return () => {
      for (const line of polylines) line.setMap(null);
    };
  }, [map, mapsLib, shownRoutes, dark]);

  // Planned trip legs: dotted walking legs and coloured bus legs
  useEffect(() => {
    if (!map || !mapsLib || !journey) return;
    const polylines: google.maps.Polyline[] = [];
    const walkDotCasing: google.maps.Symbol = {
      path: google.maps.SymbolPath.CIRCLE,
      fillColor: dark ? "#0f172a" : "#ffffff",
      fillOpacity: 0.9,
      strokeOpacity: 0,
      scale: 3.6,
    };
    const walkDot: google.maps.Symbol = {
      path: google.maps.SymbolPath.CIRCLE,
      fillColor: "#1a73e8",
      fillOpacity: 1,
      strokeOpacity: 0,
      scale: 2.3,
    };
    const arrowSymbol: google.maps.Symbol = {
      path: google.maps.SymbolPath.FORWARD_OPEN_ARROW,
      scale: 2.2,
      strokeColor: "#ffffff",
      strokeWeight: 2,
      strokeOpacity: 0.95,
    };

    for (const leg of journey.legs) {
      const path = leg.path.map(([lat, lng]) => ({ lat, lng }));
      if (leg.kind === "walk") {
        polylines.push(
          new mapsLib.Polyline({
            map,
            path,
            strokeOpacity: 0,
            clickable: false,
            zIndex: 20,
            icons: [{ icon: walkDotCasing, offset: "0", repeat: "12px" }],
          }),
          new mapsLib.Polyline({
            map,
            path,
            strokeOpacity: 0,
            clickable: false,
            zIndex: 21,
            icons: [{ icon: walkDot, offset: "0", repeat: "12px" }],
          }),
        );
      } else {
        const color = ROUTE_META[leg.trip.service.route].color;
        polylines.push(
          new mapsLib.Polyline({
            map,
            path,
            strokeColor: dark ? "#120b0c" : "#ffffff",
            strokeOpacity: 0.95,
            strokeWeight: 10,
            clickable: false,
            zIndex: 22,
          }),
          new mapsLib.Polyline({
            map,
            path,
            strokeColor: color,
            strokeOpacity: 1,
            strokeWeight: 6.5,
            clickable: false,
            zIndex: 23,
            icons: [{ icon: arrowSymbol, offset: "45px", repeat: "130px" }],
          }),
        );
      }
    }

    return () => {
      for (const line of polylines) line.setMap(null);
    };
  }, [map, mapsLib, journey, dark]);

  // Accuracy halo circle around user location
  const haloRef = useRef<google.maps.Circle | null>(null);
  useEffect(() => {
    if (!map || !mapsLib) return;
    if (!userLocation) {
      haloRef.current?.setMap(null);
      haloRef.current = null;
      return;
    }
    const center = { lat: userLocation.lat, lng: userLocation.lng };
    if (!haloRef.current) {
      haloRef.current = new mapsLib.Circle({
        map,
        center,
        radius: userLocation.accuracy,
        fillColor: "#1a73e8",
        fillOpacity: 0.14,
        strokeColor: "#1a73e8",
        strokeOpacity: 0.38,
        strokeWeight: 1,
        clickable: false,
        zIndex: 5,
      });
    } else {
      haloRef.current.setCenter(center);
      haloRef.current.setRadius(userLocation.accuracy);
    }
  }, [map, mapsLib, userLocation]);

  useEffect(() => {
    return () => {
      haloRef.current?.setMap(null);
      haloRef.current = null;
    };
  }, []);

  // Fit bounds on planned trip
  const journeyRef = useRef(journey);
  journeyRef.current = journey;
  useEffect(() => {
    const j = journeyRef.current;
    if (!map || !j || !fitKey) return;
    const bounds = new google.maps.LatLngBounds();
    let count = 0;
    for (const leg of j.legs) {
      for (const [lat, lng] of leg.path) {
        bounds.extend({ lat, lng });
        count++;
      }
    }
    if (count === 0) return;
    const wide = window.innerWidth >= 640;
    map.fitBounds(
      bounds,
      wide
        ? { top: 88, left: 430, right: 64, bottom: 48 }
        : { top: 120, left: 28, right: 28, bottom: Math.round(window.innerHeight * 0.56) },
    );
  }, [map, fitKey]);

  // Fit bounds when user filters a category via Search
  const poisRef = useRef(pois);
  poisRef.current = pois;
  useEffect(() => {
    const list = poisRef.current;
    if (!map || poiFitNonce === 0 || list.length === 0) return;
    const bounds = new google.maps.LatLngBounds();
    for (const p of list) bounds.extend({ lat: p.lat, lng: p.lng });
    map.fitBounds(bounds, { top: 76, right: 48, bottom: 72, left: 48 });
  }, [map, poiFitNonce]);

  // Pan to user location when requested
  const userLocRef = useRef(userLocation);
  userLocRef.current = userLocation;
  useEffect(() => {
    const loc = userLocRef.current;
    if (!map || !loc || locateNonce === 0) return;
    map.panTo({ lat: loc.lat, lng: loc.lng });
    if ((map.getZoom() ?? 0) < 16) map.setZoom(17);
  }, [map, locateNonce]);

  // Pan to selected bus, stop, or campus place
  useEffect(() => {
    if (!map || !selection) return;
    if (selection.type === "stop") {
      const s = STOP_BY_ID[selection.id];
      if (s) map.panTo({ lat: s.lat, lng: s.lng });
    } else if (selection.type === "place") {
      map.panTo({ lat: selection.place.lat, lng: selection.place.lng });
    } else {
      const st = busState(selection.id, clock.day, clock.minutes);
      if (st.kind !== "off") map.panTo({ lat: st.pos[0], lng: st.pos[1] });
    }
    if ((map.getZoom() ?? 0) < 15) map.setZoom(16);
    // Only pan when user explicitly picks an item, not on every clock tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, focusNonce]);

  return null;
}
