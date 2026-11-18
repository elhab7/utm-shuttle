import {
  BedDouble,
  BookOpen,
  Building2,
  BusFront,
  Dumbbell,
  GraduationCap,
  HeartPulse,
  Landmark,
  Moon,
  ShoppingBag,
  UtensilsCrossed,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { PlaceCat } from "./use-places";

const ICONS = {
  faculty: GraduationCap,
  food: UtensilsCrossed,
  study: BookOpen,
  residence: BedDouble,
  shop: ShoppingBag,
  worship: Moon,
  sport: Dumbbell,
  bank: Landmark,
  health: HeartPulse,
  place: Building2,
  stop: BusFront,
} as const;

export function PlaceIcon({ cat, className }: { cat: PlaceCat; className?: string }) {
  const Icon = ICONS[cat] ?? Building2;
  return (
    <span
      className={cn(
        "grid h-8 w-9 shrink-0 place-items-center rounded-xl",
        cat === "stop" || cat === "faculty"
          ? "bg-primary text-primary-foreground"
          : "bg-secondary text-secondary-foreground",
        className,
      )}
    >
      <Icon className="h-4 w-4" />
    </span>
  );
}
