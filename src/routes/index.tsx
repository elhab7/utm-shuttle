import { ClientOnly, createFileRoute } from "@tanstack/react-router";
import { TrackerApp } from "@/components/tracker/TrackerApp";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "UTM Shuttle — Live Campus Bus Tracker" },
      {
        name: "description",
        content:
          "Track UTM Skudai campus shuttles on a live map with next stops, ETAs and the full 2026/2027 timetable.",
      },
      { property: "og:title", content: "UTM Shuttle — Live Campus Bus Tracker" },
      {
        property: "og:description",
        content:
          "Where's my bus? Live positions, next stops and ETAs for every UTM campus shuttle.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Loading() {
  return (
    <div className="flex h-dvh flex-col bg-background">
      <div className="h-16 bg-header-gradient" />
      <div className="grid flex-1 place-items-center text-sm text-muted-foreground">
        Loading shuttle map…
      </div>
    </div>
  );
}

function Index() {
  return (
    <ClientOnly fallback={<Loading />}>
      <TrackerApp />
    </ClientOnly>
  );
}
