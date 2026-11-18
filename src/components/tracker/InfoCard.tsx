import { useEffect, useMemo, useState } from "react";
import {
  Bus,
  BusFront,
  Clock3,
  ExternalLink,
  Footprints,
  Globe,
  LoaderCircle,
  MapPin,
  Navigation,
  Phone,
  X,
} from "lucide-react";
import { ROUTE_META } from "@/data/schedule";
import { STOP_BY_ID, STOPS } from "@/data/stops";
import type { Place } from "@/lib/journey";
import {
  fetchPlaceInfo,
  googleMapsDirectionsUrl,
  googleMapsPlaceUrl,
  type PlaceInfoPayload,
} from "@/lib/place-info";
import { arrivalsAt, busState, fmt, metres, walkMinutes } from "@/lib/shuttle";
import { Button } from "@/components/ui/button";
import {
  busColor,
  busIsInactive,
  busRunsOn,
  busServiceFor,
  relative,
  runDaysLabel,
  statusText,
} from "./format";
import { BusBadge } from "./BusBadge";
import { PlaceIcon } from "./PlaceIcon";
import type { Clock, Selection } from "./types";
import type { PlaceEntry } from "./use-places";
import type { UserLocation } from "./use-user-location";

type Props = {
  clock: Clock;
  selection: NonNullable<Selection>;
  visibleBuses: Set<string>;
  onSelect: (s: Selection) => void;
  onDirections: (to: Place) => void;
  userLocation: UserLocation | null;
};

export function InfoCard({
  clock,
  selection,
  visibleBuses,
  onSelect,
  onDirections,
  userLocation,
}: Props) {
  return (
    <div className="glass-panel pointer-events-auto absolute inset-x-3 bottom-3 z-[600] flex max-h-[54vh] flex-col overflow-hidden rounded-3xl animate-in fade-in slide-in-from-bottom-4 duration-300 sm:left-4 sm:right-auto sm:bottom-4 sm:w-[395px] sm:max-h-[calc(100%-7.5rem)]">
      <Button
        variant="ghost"
        size="icon"
        className="absolute right-3 top-3 z-10 rounded-full"
        onClick={() => onSelect(null)}
        aria-label="Close details"
      >
        <X />
      </Button>
      {selection.type === "bus" ? (
        <BusDetails bus={selection.id} clock={clock} onSelect={onSelect} />
      ) : selection.type === "stop" ? (
        <StopDetails
          stopId={selection.id}
          clock={clock}
          visibleBuses={visibleBuses}
          onSelect={onSelect}
          onDirections={onDirections}
          userLocation={userLocation}
        />
      ) : (
        <PlaceDetails
          place={selection.place}
          clock={clock}
          visibleBuses={visibleBuses}
          onSelect={onSelect}
          onDirections={onDirections}
          userLocation={userLocation}
        />
      )}
    </div>
  );
}

function BusDetails({
  bus,
  clock,
  onSelect,
}: {
  bus: string;
  clock: Clock;
  onSelect: (s: Selection) => void;
}) {
  const st = busState(bus, clock.day, clock.minutes);
  const runs = busRunsOn(bus, clock.day);
  const busInactive = busIsInactive(bus);
  const status = statusText(st, runs, clock.minutes, busInactive);
  const svc =
    st.kind === "off"
      ? (st.nextDeparture?.service ?? busServiceFor(bus, clock.day))
      : st.trip.service;
  const color = busColor(bus, clock.day);

  return (
    <>
      <div className="px-5 pb-3 pt-5 pr-14">
        <div className="flex items-center gap-3">
          <BusBadge bus={bus} color={color} size="lg" />
          <div className="min-w-0">
            <p className="font-display text-lg font-semibold leading-tight">
              {svc?.name ?? "Campus shuttle"}
            </p>
            {svc && (
              <p className="truncate text-xs text-muted-foreground">
                {svc.via}
                {!runs && ` · ${runDaysLabel(bus)}`}
              </p>
            )}
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2 text-sm">
          <span
            className={
              status.tone === "running"
                ? "h-2.5 w-2.5 rounded-full bg-live animate-live-pulse"
                : status.tone === "waiting"
                  ? "h-2.5 w-2.5 rounded-full bg-accent"
                  : "h-2.5 w-2.5 rounded-full bg-muted-foreground/50"
            }
          />
          <span className="font-medium">{status.label}</span>
        </div>
        {st.kind === "running" && (
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-gold-gradient transition-all duration-1000"
              style={{ width: `${Math.round(st.progress * 100)}%` }}
            />
          </div>
        )}
      </div>

      {st.kind !== "off" ? (
        <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto border-t border-border px-3 py-2">
          <p className="px-2 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Next stops
          </p>
          <ol className="relative">
            {st.nextStops.map((n, i) => (
              <li key={`${n.stopId}-${i}`}>
                <button
                  onClick={() => onSelect({ type: "stop", id: n.stopId })}
                  className="group flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:bg-secondary/70"
                >
                  <span className="relative flex h-full w-4 justify-center">
                    <span
                      className={
                        i === 0
                          ? "z-10 h-3.5 w-3.5 rounded-full border-[3px] border-accent bg-card"
                          : "z-10 h-3 w-3 rounded-full border-2 bg-card"
                      }
                      style={i === 0 ? undefined : { borderColor: color }}
                    />
                  </span>
                  <span className="flex-1 truncate text-sm font-medium">{n.name}</span>
                  <span className="text-right">
                    <span className="block text-sm font-semibold tabular-nums">
                      {relative(n.eta, clock.minutes)}
                    </span>
                    <span className="block text-[11px] tabular-nums text-muted-foreground">
                      {fmt(n.eta)}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </div>
      ) : (
        <div className="border-t border-border px-5 py-4 text-sm text-muted-foreground">
          {busInactive
            ? "This bus route is temporarily inactive."
            : runs
              ? st.nextDeparture
                ? `This bus is parked. Next departure at ${fmt(st.nextDeparture.depart)} from ${ROUTE_META[st.nextDeparture.service.route][st.nextDeparture.dir === "out" ? "from" : "to"]}.`
                : "Finished for the day."
              : "This bus does not run on the selected day."}
        </div>
      )}
    </>
  );
}

function StopDetails({
  stopId,
  clock,
  visibleBuses,
  onSelect,
  onDirections,
  userLocation,
}: {
  stopId: string;
  clock: Clock;
  visibleBuses: Set<string>;
  onSelect: (s: Selection) => void;
  onDirections: (to: Place) => void;
  userLocation: UserLocation | null;
}) {
  const stop = STOP_BY_ID[stopId];
  const away =
    stop && userLocation
      ? metres([userLocation.lat, userLocation.lng], [stop.lat, stop.lng])
      : null;
  const externalUrl = stop ? googleMapsDirectionsUrl(stop.lat, stop.lng, userLocation) : null;
  const allBusIds = useMemo(
    () => (visibleBuses.size > 0 ? visibleBuses : undefined),
    [visibleBuses],
  );
  const arrivals = arrivalsAt(stopId, clock.day, clock.minutes, allBusIds).slice(0, 12);

  return (
    <>
      <div className="px-5 pb-3 pt-5 pr-14">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
            <BusFront className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="font-display text-lg font-semibold leading-tight">
              {stop?.name ?? stopId}
            </p>
            <p className="text-xs text-muted-foreground">Bus stop · upcoming buses</p>
          </div>
        </div>
        {stop && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              className="rounded-full"
              onClick={() =>
                onDirections({ label: stop.name, lat: stop.lat, lng: stop.lng, stopId: stop.id })
              }
            >
              <Navigation /> Walk / route here
            </Button>
            {externalUrl && (
              <Button asChild size="sm" variant="secondary" className="rounded-full">
                <a href={externalUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink /> Google Maps
                </a>
              </Button>
            )}
            {away !== null && (
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Footprints className="h-3.5 w-3.5" />
                {away < 1000
                  ? `${Math.round(away / 10) * 10} m`
                  : `${(away / 1000).toFixed(1)} km`}{" "}
                away · ~{walkMinutes(away)} min walk
              </span>
            )}
          </div>
        )}
      </div>

      <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto border-t border-border px-3 py-2">
        {arrivals.length === 0 ? (
          <div className="flex items-center gap-3 px-2 py-4 text-sm text-muted-foreground">
            <Clock3 className="h-4 w-4 shrink-0" />
            {(() => {
              const later = arrivalsAt(stopId, clock.day, clock.minutes, allBusIds, 24 * 60)[0];
              return later
                ? `No buses in the next 3 hours. Next: ${later.trip.service.bus} at ${fmt(later.eta)}.`
                : "No more buses here on this day.";
            })()}
          </div>
        ) : (
          <ul>
            {arrivals.map((a) => (
              <li key={`${a.trip.service.id}-${a.trip.dir}-${a.trip.depart}`}>
                <button
                  onClick={() => onSelect({ type: "bus", id: a.trip.service.bus })}
                  className="flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left transition-colors hover:bg-secondary/70"
                >
                  <BusBadge
                    bus={a.trip.service.bus}
                    color={ROUTE_META[a.trip.service.route].color}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">To {a.headsign}</span>
                    <span className="block truncate text-[11px] text-muted-foreground">
                      {a.isOrigin ? "Departs from here" : a.trip.service.name}
                    </span>
                  </span>
                  <span className="text-right">
                    <span className="block text-sm font-semibold tabular-nums">
                      {relative(a.eta, clock.minutes)}
                    </span>
                    <span className="block text-[11px] tabular-nums text-muted-foreground">
                      {fmt(a.eta)}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="flex items-center gap-2 border-t border-border px-5 py-2.5 text-[11px] text-muted-foreground">
        <Bus className="h-3.5 w-3.5" /> Times are estimates from the official timetable.
      </div>
    </>
  );
}

function PlaceDetails({
  place,
  clock,
  visibleBuses,
  onSelect,
  onDirections,
  userLocation,
}: {
  place: PlaceEntry;
  clock: Clock;
  visibleBuses: Set<string>;
  onSelect: (s: Selection) => void;
  onDirections: (to: Place) => void;
  userLocation: UserLocation | null;
}) {
  const [info, setInfo] = useState<PlaceInfoPayload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setInfo(null);
    fetchPlaceInfo({
      data: {
        label: place.label,
        lat: place.lat,
        lng: place.lng,
        officialUrl: place.officialUrl,
      },
    })
      .then((res) => {
        if (alive) setInfo(res);
      })
      .catch(() => {
        if (alive) setInfo(null);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [place.label, place.lat, place.lng, place.officialUrl]);

  const away = userLocation
    ? metres([userLocation.lat, userLocation.lng], [place.lat, place.lng])
    : null;

  const nearestStops = useMemo(() => {
    const busFilter = visibleBuses.size > 0 ? visibleBuses : undefined;
    return STOPS.map((s) => ({
      stop: s,
      dist: metres([place.lat, place.lng], [s.lat, s.lng]),
      next: arrivalsAt(s.id, clock.day, clock.minutes, busFilter, 24 * 60)[0],
    }))
      .sort((a, b) => a.dist - b.dist)
      .slice(0, 3);
  }, [place.lat, place.lng, clock.day, clock.minutes, visibleBuses]);

  const gmapsUrl = googleMapsPlaceUrl(place.label, place.lat, place.lng);
  const officialUrl = info?.officialUrl || place.officialUrl;

  return (
    <>
      <div className="px-5 pb-3 pt-5 pr-14">
        <div className="flex items-start gap-3">
          <PlaceIcon cat={place.cat} className="h-11 w-11 rounded-2xl" />
          <div className="min-w-0">
            <p className="font-display text-lg font-semibold leading-tight">{place.label}</p>
            <p className="mt-0.5 text-xs capitalize text-muted-foreground">
              {place.subtitle || info?.category || place.cat} · UTM Johor Bahru
            </p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button size="sm" className="rounded-full" onClick={() => onDirections(place)}>
            <Navigation /> Directions
          </Button>
          {officialUrl && (
            <Button asChild size="sm" variant="secondary" className="rounded-full">
              <a href={officialUrl} target="_blank" rel="noopener noreferrer">
                <Globe /> UTM Page
              </a>
            </Button>
          )}
          <Button asChild size="sm" variant="secondary" className="rounded-full">
            <a href={gmapsUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink /> Google Maps
            </a>
          </Button>
        </div>
        {away !== null && (
          <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Footprints className="h-3.5 w-3.5" />
            {away < 1000
              ? `${Math.round(away / 10) * 10} m`
              : `${(away / 1000).toFixed(1)} km`}{" "}
            from you · ~{walkMinutes(away)} min walk
          </p>
        )}
      </div>

      <div className="scrollbar-thin min-h-0 flex-1 space-y-3 overflow-y-auto border-t border-border px-4 py-3">
        <div className="glass-card rounded-2xl p-3 text-xs">
          {loading ? (
            <p className="flex items-center gap-2 text-muted-foreground">
              <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> Fetching UTM & map info…
            </p>
          ) : (
            <div className="space-y-1.5">
              {info?.officialTitle && (
                <p className="font-semibold text-foreground">{info.officialTitle}</p>
              )}
              {info?.officialSummary && (
                <p className="leading-relaxed text-muted-foreground">{info.officialSummary}</p>
              )}
              {(info?.road || info?.displayName) && (
                <p className="flex items-start gap-1.5 text-muted-foreground">
                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                  <span>
                    {info.road ? `${info.road}, ${info.postcode} Skudai` : info.displayName}
                  </span>
                </p>
              )}
              {info?.openingHours && (
                <p className="flex items-center gap-1.5 text-muted-foreground">
                  <Clock3 className="h-3.5 w-3.5 shrink-0 text-primary" />
                  <span>{info.openingHours}</span>
                </p>
              )}
              {info?.phone && (
                <p className="flex items-center gap-1.5 text-muted-foreground">
                  <Phone className="h-3.5 w-3.5 shrink-0 text-primary" />
                  <span>{info.phone}</span>
                </p>
              )}
              {!info?.officialSummary && !info?.road && !info?.displayName && (
                <p className="text-muted-foreground">
                  Universiti Teknologi Malaysia (UTM), 81310 Johor Bahru.
                </p>
              )}
            </div>
          )}
        </div>

        <div>
          <p className="px-1 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Nearest shuttle stops
          </p>
          <ul className="space-y-1">
            {nearestStops.map(({ stop, dist, next }) => (
              <li key={stop.id}>
                <button
                  onClick={() => onSelect({ type: "stop", id: stop.id })}
                  className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:bg-secondary/70"
                >
                  <PlaceIcon cat="stop" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{stop.name}</span>
                    <span className="block truncate text-[11px] text-muted-foreground">
                      {Math.round(dist)} m · ~{walkMinutes(dist)} min walk
                    </span>
                  </span>
                  {next && (
                    <span className="text-right">
                      <span className="block text-xs font-semibold">
                        {next.trip.service.bus} · {relative(next.eta, clock.minutes)}
                      </span>
                      <span className="block text-[11px] tabular-nums text-muted-foreground">
                        {fmt(next.eta)}
                      </span>
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </>
  );
}
