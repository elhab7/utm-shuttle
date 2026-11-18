import { cn } from "@/lib/utils";

/** Route colour comes from timetable data, so it is applied inline. */
export function BusBadge({
  bus,
  color,
  size = "md",
  muted,
}: {
  bus: string;
  color: string;
  size?: "md" | "lg";
  muted?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-grid shrink-0 place-items-center rounded-xl font-display font-bold text-on-route shadow-sm ring-2 ring-card",
        size === "lg" ? "h-11 min-w-11 px-2 text-base" : "h-8 min-w-9 px-1.5 text-xs",
        muted && "grayscale opacity-60",
      )}
      style={{ backgroundColor: color }}
    >
      {bus}
    </span>
  );
}
