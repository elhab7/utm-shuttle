import { useState } from "react";
import {
  ChevronDown,
  CircleDot,
  Clock3,
  Footprints,
  LoaderCircle,
  MapPin,
  Navigation,
  X,
} from "lucide-react";
import { ROUTE_META } from "@/data/schedule";
import type { BusLeg, Journey, Place, PlanResult, WalkLeg } from "@/lib/journey";
import { fmt, headsign, toMin } from "@/lib/shuttle";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { BusBadge } from "./BusBadge";
import { DAYS_LONG, relative, stopName } from "./format";
import { PlaceSearch } from "./PlaceSearch";
import type { LocationStatus } from "./use-user-location";

type Props = {
  routeDay: number;
  routeMinutes: number;
  isCustomTime: boolean;
  onRouteTime: (t: { day: number; minutes: number } | null) => void;
  to: Place;
  from: Place | null; // null = your location
  locStatus: LocationStatus;
  hasLocation: boolean;
  graphReady: boolean;
  graphError: boolean;
  result: PlanResult | null;
  selected: Journey | null;
  onSelect: (id: string) => void;
  onFrom: (p: Place | null) => void;
  onClose: () => void;
};

const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

const dist = (m: number) =>
  m < 1000 ? `${Math.max(10, Math.round(m / 10) * 10)} m` : `${(m / 1000).toFixed(1)} km`;
const mins = (x: number) => Math.max(1, Math.round(x));

export function DirectionsPanel(props: Props) {
  const {
    routeDay,
    routeMinutes,
    isCustomTime,
    onRouteTime,
    to,
    from,
    locStatus,
    hasLocation,
    graphReady,
    graphError,
    result,
    selected,
    onSelect,
    onFrom,
    onClose,
  } = props;
  const [picking, setPicking] = useState(false);
  const needStart = !from && (locStatus === "denied" || locStatus === "unavailable");
  const showPicker = picking || needStart || result?.tooFar === "from";

  return (
    <div className="glass-panel pointer-events-auto absolute inset-x-3 bottom-3 z-[600] flex max-h-[62vh] flex-col overflow-hidden rounded-3xl animate-in fade-in slide-in-from-bottom-4 duration-300 sm:bottom-4 sm:left-4 sm:right-auto sm:max-h-[calc(100%-6rem)] sm:w-[400px]">
      <Button
        variant="ghost"
        size="icon"
        className="absolute right-3 top-3 z-10 rounded-full"
        onClick={onClose}
        aria-label="Close directions"
      >
        <X />
      </Button>
      <div className="px-4 pb-3 pt-4 sm:px-5 sm:pt-5">
        <div className="flex items-center gap-3 pr-10">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground">
            <Navigation className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="font-display text-lg font-semibold leading-tight">Directions</p>
            <p className="text-xs text-muted-foreground">Walking + campus shuttle</p>
          </div>
        </div>

        <div className="glass-card mt-3 rounded-2xl p-3 text-sm">
          <div className="flex items-center gap-2.5">
            <CircleDot className="h-4 w-4 shrink-0 text-primary" />
            <span className="min-w-0 flex-1 truncate">
              <span className="text-muted-foreground">From </span>
              <span className="font-medium">{from ? from.label : "Your location"}</span>
            </span>
            <button
              onClick={() => setPicking((p) => !p)}
              className="shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold text-primary hover:bg-secondary"
            >
              {showPicker && !needStart ? "Cancel" : "Change"}
            </button>
          </div>
          <div className="my-1 ml-[7px] h-3 border-l-2 border-dotted border-muted-foreground/50" />
          <div className="flex items-center gap-2.5">
            <MapPin className="h-4 w-4 shrink-0 text-accent" />
            <span className="min-w-0 flex-1 truncate">
              <span className="text-muted-foreground">To </span>
              <span className="font-medium">{to.label}</span>
            </span>
          </div>

          <div className="mt-2.5 flex flex-wrap items-center gap-1.5 border-t border-border/70 pt-2.5">
            <Clock3 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Depart</span>
            <select
              value={routeDay}
              onChange={(e) => onRouteTime({ day: Number(e.target.value), minutes: routeMinutes })}
              aria-label="Departure day"
              className="h-7 rounded-full border border-border/80 bg-background/70 px-2.5 text-xs font-medium text-foreground outline-none focus:border-primary"
            >
              {DAY_ORDER.map((d) => (
                <option key={d} value={d}>
                  {DAYS_LONG[d]}
                </option>
              ))}
            </select>
            <input
              type="time"
              value={fmt(routeMinutes)}
              onChange={(e) => {
                if (!e.target.value) return;
                onRouteTime({ day: routeDay, minutes: toMin(e.target.value) });
              }}
              aria-label="Departure time"
              className="h-7 rounded-full border border-border/80 bg-background/70 px-2.5 text-xs font-semibold tabular-nums text-foreground outline-none focus:border-primary"
            />
            {isCustomTime && (
              <button
                type="button"
                onClick={() => onRouteTime(null)}
                className="ml-auto rounded-full bg-secondary px-2.5 py-1 text-[11px] font-semibold text-primary transition-colors hover:bg-secondary/80"
              >
                Now
              </button>
            )}
          </div>

          {showPicker && (
            <PlaceSearch
              placeholder="Start from a stop or place"
              onPick={(p) => {
                onFrom(p);
                setPicking(false);
              }}
              {...(locStatus === "denied"
                ? {}
                : {
                    onUseLocation: () => {
                      onFrom(null);
                      setPicking(false);
                    },
                  })}
            />
          )}
        </div>
      </div>

      <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto border-t border-border px-3 py-3">
        <Status {...props} needStart={needStart} />
        {result && result.options.length > 0 && (
          <>
            <p className="px-1 pb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Routing options · {DAYS_LONG[routeDay]} ({result.options.length})
            </p>
            <div className="scrollbar-thin max-h-[220px] space-y-2 overflow-y-auto pr-1">
              {result.options.map((o, i) => (
                <OptionCard
                  key={o.id}
                  j={o}
                  best={i === 0}
                  active={selected?.id === o.id}
                  now={routeMinutes}
                  isCustomTime={isCustomTime}
                  onClick={() => onSelect(o.id)}
                />
              ))}
            </div>
            {result.noBusesLeft && (
              <p className="px-2 pt-2 text-xs text-muted-foreground">
                {isCustomTime
                  ? `No more shuttles on ${DAYS_LONG[routeDay]} after ${fmt(routeMinutes)} — walking only.`
                  : "No more shuttles today — walking only."}
              </p>
            )}
            {selected && <Timeline j={selected} now={routeMinutes} to={to.label} />}
          </>
        )}
        {!graphReady && !graphError && hasLocation && <Loading text="Preparing walking map…" />}
      </div>
      <div className="border-t border-border px-5 py-2 text-[11px] text-muted-foreground">
        Walking paths ©{" "}
        <a
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noopener noreferrer"
          className="underline"
        >
          OpenStreetMap
        </a>{" "}
        contributors · bus times are estimates
      </div>
    </div>
  );
}

function Loading({ text }: { text: string }) {
  return (
    <p className="flex items-center gap-2 px-2 py-3 text-sm text-muted-foreground">
      <LoaderCircle className="h-4 w-4 animate-spin" /> {text}
    </p>
  );
}

function Status({
  from,
  locStatus,
  hasLocation,
  graphError,
  result,
  needStart,
}: Props & { needStart: boolean }) {
  if (graphError)
    return (
      <p className="px-2 py-3 text-sm text-muted-foreground">
        Couldn't load the walking map. Check your connection and try again.
      </p>
    );
  if (!from && !hasLocation) {
    if (needStart)
      return (
        <p className="px-2 py-3 text-sm text-muted-foreground">
          {locStatus === "denied"
            ? "Location is blocked, so pick where you're starting from."
            : "Couldn't find your location. Pick where you're starting from."}
        </p>
      );
    return <Loading text="Finding your location…" />;
  }
  if (result?.tooFar)
    return (
      <p className="px-2 py-3 text-sm text-muted-foreground">
        {result.tooFar === "from"
          ? `You're about ${dist(result.farMetres ?? 0)} from campus. Directions work on campus — pick a starting point.`
          : "That place is outside campus, so we can't plan a walk there."}
      </p>
    );
  return null;
}

function OptionCard({
  j,
  best,
  active,
  now,
  isCustomTime,
  onClick,
}: {
  j: Journey;
  best: boolean;
  active: boolean;
  now: number;
  isCustomTime: boolean;
  onClick: () => void;
}) {
  const leaveIn = j.leaveAt - now;
  const shownMins = j.buses > 0 && leaveIn >= 5 ? j.arriveAt - j.leaveAt : j.arriveAt - now;
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full rounded-2xl border px-3 py-2.5 text-left transition-colors",
        active ? "border-primary bg-secondary" : "border-border bg-card/60 hover:bg-secondary",
      )}
    >
      <div className="flex items-center gap-2">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
          {j.legs.map((l, i) => (
            <span key={i} className="flex items-center gap-1">
              {i > 0 && <span className="text-xs text-muted-foreground">›</span>}
              {l.kind === "walk" ? (
                <span className="flex items-center gap-0.5 text-xs font-medium text-muted-foreground">
                  <Footprints className="h-3.5 w-3.5" />
                  {mins(l.minutes)}
                </span>
              ) : (
                <BusBadge bus={l.trip.service.bus} color={ROUTE_META[l.trip.service.route].color} />
              )}
            </span>
          ))}
        </div>
        <span className="text-right">
          <span className="block font-display text-base font-semibold tabular-nums leading-tight">
            {mins(shownMins)} min
          </span>
          <span className="block text-[11px] tabular-nums text-muted-foreground">
            arrive {fmt(j.arriveAt)}
          </span>
        </span>
      </div>
      <p className="mt-1 text-[11px] text-muted-foreground">
        {best && (
          <span className="mr-1.5 rounded-full bg-accent px-1.5 py-0.5 font-semibold text-accent-foreground">
            Best
          </span>
        )}
        {j.buses === 0
          ? "Walk all the way"
          : leaveIn < 1
            ? isCustomTime
              ? `Leave at ${fmt(j.leaveAt)}`
              : "Leave now"
            : `Leave in ${relative(j.leaveAt, now)} (${fmt(j.leaveAt)})`}{" "}
        · {dist(j.walkMetres)} walking
      </p>
    </button>
  );
}

function Timeline({ j, now, to }: { j: Journey; now: number; to: string }) {
  return (
    <ol className="mt-3 space-y-1 px-1">
      {j.legs.map((l, i) =>
        l.kind === "walk" ? <WalkRow key={i} leg={l} /> : <BusRow key={i} leg={l} now={now} />,
      )}
      <li className="flex items-center gap-3 px-1 py-1.5">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-accent text-accent-foreground">
          <MapPin className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1 text-sm">
          <span className="block truncate font-medium">{to}</span>
          <span className="block text-[11px] text-muted-foreground">Arrive {fmt(j.arriveAt)}</span>
        </span>
      </li>
    </ol>
  );
}

function WalkRow({ leg }: { leg: WalkLeg }) {
  const [open, setOpen] = useState(false);
  return (
    <li className="rounded-xl px-1 py-1.5">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 text-left"
        aria-expanded={open}
      >
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-secondary text-secondary-foreground">
          <Footprints className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1 text-sm">
          <span className="block font-medium">
            Walk {mins(leg.minutes)} min · {dist(leg.metres)}
          </span>
          <span className="block truncate text-[11px] text-muted-foreground">
            to {leg.to} · {fmt(leg.start)}
          </span>
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
        />
      </button>
      {open && (
        <ol className="ml-[15px] mt-1 border-l-2 border-dotted border-muted-foreground/40 pl-5">
          {leg.steps.map((s, i) => (
            <li key={i} className="flex justify-between gap-3 py-1 text-xs">
              <span>{s.text}</span>
              {s.metres > 0 && (
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  {dist(s.metres)}
                </span>
              )}
            </li>
          ))}
        </ol>
      )}
    </li>
  );
}

function BusRow({ leg, now }: { leg: BusLeg; now: number }) {
  const color = ROUTE_META[leg.trip.service.route].color;
  return (
    <li className="flex items-start gap-3 px-1 py-1.5">
      <BusBadge bus={leg.trip.service.bus} color={color} />
      <span className="min-w-0 flex-1 text-sm">
        <span className="block font-medium">
          Board at {stopName(leg.boardStop)} · {fmt(leg.boardAt)}
          <span className="font-normal text-muted-foreground"> ({relative(leg.boardAt, now)})</span>
        </span>
        <span className="block truncate text-[11px] text-muted-foreground">
          To {headsign(leg.trip)}
        </span>
        <span className="mt-0.5 block text-[11px] text-muted-foreground">
          Ride {leg.stopsCount} stop{leg.stopsCount > 1 ? "s" : ""} · get off at{" "}
          <span className="font-medium text-foreground">{stopName(leg.alightStop)}</span>{" "}
          {fmt(leg.alightAt)}
        </span>
      </span>
    </li>
  );
}
