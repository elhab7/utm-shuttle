import { Fragment, useState } from "react";
import { ChevronDown, Radio } from "lucide-react";
import { ROUTE_META } from "@/data/schedule";
import { BUSES, busState, fmt, isFridayBreak, serviceRunsOn, toMin, tripsFor } from "@/lib/shuttle";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { BusBadge } from "./BusBadge";
import { DAYS, DAYS_LONG, busColor, busIsInactive, busRunsOn, statusText } from "./format";
import type { Clock } from "./types";

type Props = {
  clock: Clock;
  onDay: (day: number) => void;
  onTime: (minutes: number) => void;
  onLive: () => void;
  visibleBuses: Set<string>;
  onToggleBus: (bus: string, on: boolean) => void;
  onSetAll: (on: boolean) => void;
  onPickBus: (bus: string) => void;
};

const ORDER = [1, 2, 3, 4, 5, 6, 0];

export function SchedulePanel({
  clock,
  onDay,
  onTime,
  onLive,
  visibleBuses,
  onToggleBus,
  onSetAll,
  onPickBus,
}: Props) {
  const [open, setOpen] = useState<string | null>(null);
  const timeValue = fmt(clock.minutes);
  const sorted = [...BUSES].sort((a, b) => {
    const ra = busRunsOn(a.bus, clock.day) ? 0 : 1;
    const rb = busRunsOn(b.bus, clock.day) ? 0 : 1;
    return ra - rb || a.bus.localeCompare(b.bus);
  });
  const groups = [
    {
      key: "on",
      label: `Scheduled on ${DAYS_LONG[clock.day]}`,
      list: sorted.filter((b) => busRunsOn(b.bus, clock.day)),
    },
    {
      key: "off",
      label: `No service on ${DAYS_LONG[clock.day]}`,
      list: sorted.filter((b) => !busRunsOn(b.bus, clock.day)),
    },
  ];
  const runningCount = BUSES.filter(
    (b) => busState(b.bus, clock.day, clock.minutes).kind === "running",
  ).length;

  return (
    <div className="flex h-full flex-col">
      <div className="bg-header-gradient px-5 pb-5 pt-6 text-header-foreground">
        <p className="font-display text-xl font-semibold">Plan your ride</p>
        <p className="text-sm opacity-80">Pick a day and time, or follow live.</p>
      </div>

      <div className="space-y-4 border-b border-border px-5 py-4">
        <div className="grid grid-cols-7 gap-1.5">
          {ORDER.map((d) => (
            <Button
              key={d}
              size="sm"
              variant={clock.day === d ? "chipActive" : "chip"}
              className="h-9 px-0 text-xs"
              onClick={() => onDay(d)}
              aria-pressed={clock.day === d}
            >
              {DAYS[d]}
            </Button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Input
            type="time"
            value={timeValue}
            onChange={(e) => e.target.value && onTime(toMin(e.target.value))}
            className="h-10 flex-1 rounded-full px-4 font-semibold tabular-nums"
            aria-label="Time"
          />
          <Button
            variant={clock.live ? "live" : "liveOutline"}
            className="h-10 px-4"
            onClick={onLive}
          >
            <Radio className={cn(clock.live && "animate-pulse")} /> Live
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          {clock.live ? "Showing live Malaysia time" : "Simulating"} · {DAYS_LONG[clock.day]}{" "}
          {timeValue} ·{" "}
          <span className="font-semibold text-foreground">{runningCount} on the road</span>
        </p>
      </div>

      <div className="flex items-center justify-between px-5 pb-2 pt-4">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Buses
        </p>
        <div className="flex gap-1">
          <Button
            size="sm"
            variant="ghost"
            className="h-7 rounded-full px-2.5 text-xs"
            onClick={() => onSetAll(true)}
          >
            All
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 rounded-full px-2.5 text-xs"
            onClick={() => onSetAll(false)}
          >
            None
          </Button>
        </div>
      </div>

      <div className="scrollbar-thin min-h-0 flex-1 space-y-2 overflow-y-auto px-3 pb-6">
        {groups.map((g) =>
          g.list.length === 0 ? null : (
            <Fragment key={g.key}>
              <p className="px-2 pb-0.5 pt-2 text-[11px] font-semibold text-muted-foreground">
                {g.label}
              </p>
              {g.list.map(({ bus, services }) => {
                const runs = busRunsOn(bus, clock.day);
                const busInactive = busIsInactive(bus);
                const st = busState(bus, clock.day, clock.minutes);
                const status = statusText(st, runs, clock.minutes, busInactive);
                const inactive = st.kind === "off";
                const daySvcs = services.filter((s) => serviceRunsOn(s, clock.day));
                const headerSvc = daySvcs[0] ?? services[0];
                const expanded = open === bus;
                return (
                  <div
                    key={bus}
                    className={cn(
                      "rounded-2xl border transition-colors",
                      inactive ? "border-transparent bg-inactive" : "glass-card shadow-sm",
                    )}
                  >
                    <div className="flex items-center gap-3 px-3 py-2.5">
                      <Checkbox
                        checked={visibleBuses.has(bus)}
                        onCheckedChange={(v) => onToggleBus(bus, v === true)}
                        aria-label={`Show bus ${bus} on map`}
                        className="h-5 w-5 rounded-md"
                      />
                      <button
                        className="flex min-w-0 flex-1 items-center gap-3 text-left"
                        onClick={() => onPickBus(bus)}
                      >
                        <BusBadge bus={bus} color={busColor(bus, clock.day)} muted={inactive} />
                        <span className={cn("min-w-0", inactive && "opacity-55")}>
                          <span className="block truncate text-sm font-semibold">
                            {headerSvc?.name}
                          </span>
                          <span className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
                            {status.tone === "running" && (
                              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-live" />
                            )}
                            {status.tone === "waiting" && (
                              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                            )}
                            <span className="truncate">{status.label}</span>
                          </span>
                        </span>
                      </button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 rounded-full"
                        onClick={() => setOpen(expanded ? null : bus)}
                        aria-label={expanded ? `Hide ${bus} timetable` : `Show ${bus} timetable`}
                        aria-expanded={expanded}
                      >
                        <ChevronDown
                          className={cn("transition-transform", expanded && "rotate-180")}
                        />
                      </Button>
                    </div>
                    {expanded && (
                      <div
                        className={cn(
                          "space-y-3 border-t border-border px-3 pb-3 pt-2.5",
                          inactive && "opacity-70",
                        )}
                      >
                        {busInactive ? (
                          <p className="text-[11px] text-muted-foreground">
                            Temporarily inactive — no departures scheduled.
                          </p>
                        ) : !runs ? (
                          <p className="text-[11px] text-muted-foreground">
                            Not running on {DAYS_LONG[clock.day]}.
                          </p>
                        ) : (
                          daySvcs.map((svc) => {
                            const meta = ROUTE_META[svc.route];
                            const trips = tripsFor(svc, clock.day);
                            const cell = (time: string, dir: "out" | "back") => {
                              const m = toMin(time);
                              const fri = isFridayBreak(clock.day, m) && svc.days === "weekday";
                              const trip = trips.find((t) => t.dir === dir && t.depart === m);
                              const done =
                                fri || (trip ? trip.depart + trip.duration < clock.minutes : true);
                              const now =
                                trip &&
                                clock.minutes >= trip.depart &&
                                clock.minutes < trip.depart + trip.duration;
                              return (
                                <span
                                  key={time}
                                  className={cn(
                                    "rounded-md px-1.5 py-0.5 text-center text-xs tabular-nums",
                                    now
                                      ? "bg-accent font-bold text-accent-foreground"
                                      : done
                                        ? "text-muted-foreground/60"
                                        : "bg-secondary font-semibold text-secondary-foreground",
                                    fri && "line-through",
                                  )}
                                  title={fri ? "No service on Friday" : undefined}
                                >
                                  {fmt(m)}
                                </span>
                              );
                            };
                            return (
                              <div key={svc.id}>
                                <p className="mb-1.5 text-[11px] text-muted-foreground">
                                  {svc.via}
                                  {svc.days === "weekend" ? " · Sat & Sun" : " · Mon – Fri"}
                                </p>
                                <div className="grid grid-cols-2 gap-3">
                                  {(["out", "back"] as const).map((dir) => (
                                    <div key={dir}>
                                      <p className="mb-1 truncate text-[11px] font-semibold">
                                        From {dir === "out" ? meta.from : meta.to}
                                      </p>
                                      <div className="grid grid-cols-3 gap-1">
                                        {svc[dir].map((t) => cell(t, dir))}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          })
                        )}
                        {clock.day === 5 && runs && (
                          <p className="text-[11px] text-muted-foreground">
                            No service 12:40 – 14:00 on Friday.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </Fragment>
          ),
        )}
        <p className="px-2 pt-3 text-[11px] leading-relaxed text-muted-foreground">
          No service on public holidays or semester breaks. Arrival times may vary with traffic.
        </p>
      </div>
    </div>
  );
}
