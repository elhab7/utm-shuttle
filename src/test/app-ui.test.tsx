import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import rawWalkGraph from "@/data/walk-graph.json";
import { STOP_BY_ID } from "@/data/stops";
import * as walkGraphModule from "@/lib/walk-graph";
import { TrackerApp } from "@/components/tracker/TrackerApp";

vi.mock("@/components/tracker/ShuttleMap", () => ({
  ShuttleMap: ({ pois }: { pois: Array<{ label: string }> }) => (
    <div data-testid="shuttle-map" data-poi-count={pois.length} />
  ),
}));

describe("TrackerApp UI controls", () => {
  it("excludes off-campus POIs, shows search results on map on Enter, and opens the schedule menu", async () => {
    render(<TrackerApp />);

    expect(screen.queryByRole("button", { name: /^faculties$/i })).not.toBeInTheDocument();

    const locateBtn = screen.getByRole("button", { name: /show my location/i });
    const searchBtn = screen.getByRole("button", { name: /search buses, stops and places/i });
    const menuBtn = screen.getByRole("button", { name: /open schedule menu/i });

    expect(locateBtn).toBeInTheDocument();

    // Open search and verify no 'Show on map' options panel clutters the search dropdown
    fireEvent.click(searchBtn);
    expect(screen.queryByText(/show on map/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /bus stops/i })).not.toBeInTheDocument();

    // Off-campus landmarks must NOT appear in search results
    const input = screen.getByPlaceholderText(/search bus, stop, mosque, faculty/i);
    fireEvent.change(input, { target: { value: "taman universiti" } });
    await waitFor(() => {
      expect(screen.queryByText(/aeon mall taman universiti/i)).not.toBeInTheDocument();
    });

    // Searching "surau" and pressing Enter shows all matching on-campus results on the map
    fireEvent.change(input, { target: { value: "surau" } });
    await waitFor(() => {
      expect(screen.getByText(/surau ktdi/i)).toBeInTheDocument();
      expect(screen.queryByText(/surau flora/i)).not.toBeInTheDocument();
    });

    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => {
      const count = Number(screen.getByTestId("shuttle-map").getAttribute("data-poi-count"));
      expect(count).toBeGreaterThan(5);
    });

    const clearChip = screen.getByRole("button", { name: /clear .* filter/i });
    expect(clearChip).toBeInTheDocument();
    fireEvent.click(clearChip);
    expect(screen.queryByRole("button", { name: /clear .* filter/i })).not.toBeInTheDocument();

    // Menu drawer opens properly
    fireEvent.click(menuBtn);
    expect(screen.getByText(/plan your ride/i)).toBeInTheDocument();
  });

  it("lets users choose a departure day and time for directions and reset back to Now", async () => {
    const graph = walkGraphModule.buildWalkGraph(
      rawWalkGraph as unknown as walkGraphModule.RawWalkGraph,
    );
    const loadSpy = vi.spyOn(walkGraphModule, "loadWalkGraph").mockResolvedValue(graph);

    render(<TrackerApp />);

    // Open search and pick destination "Cluster"
    fireEvent.click(screen.getByRole("button", { name: /search buses, stops and places/i }));
    const searchInput = screen.getByPlaceholderText(/search bus, stop, mosque, faculty/i);
    fireEvent.change(searchInput, { target: { value: "Cluster" } });
    fireEvent.click(await screen.findByText(STOP_BY_ID["cluster"]!.name));

    // Open Directions from InfoCard
    fireEvent.click(await screen.findByRole("button", { name: /walk \/ route here/i }));

    // Pick a custom starting stop ("KDOJ")
    const changeBtn = await screen.findByRole("button", { name: /change/i });
    fireEvent.click(changeBtn);
    const fromInput = screen.getByPlaceholderText(/start from a stop or place/i);
    fireEvent.change(fromInput, { target: { value: "KDOJ" } });
    const kdojMatches = await screen.findAllByText(STOP_BY_ID["kdoj"]!.name);
    fireEvent.click(kdojMatches[0]!);

    const daySelect = screen.getByLabelText(/departure day/i);
    const timeInput = screen.getByLabelText(/departure time/i);

    // Choose Monday 07:50 -> should list multiple shuttle + walk routing options
    fireEvent.change(daySelect, { target: { value: "1" } });
    fireEvent.change(timeInput, { target: { value: "07:50" } });

    await waitFor(() => {
      expect(screen.getByText(/routing options · monday/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /^now$/i })).toBeInTheDocument();
    });

    // Choose late night 23:30 -> should switch to walking-only message for custom time
    fireEvent.change(timeInput, { target: { value: "23:30" } });

    await waitFor(() => {
      expect(
        screen.getByText(/no more shuttles on monday after 23:30 — walking only\./i),
      ).toBeInTheDocument();
    });

    // Clicking Now resets back to current live clock
    fireEvent.click(screen.getByRole("button", { name: /^now$/i }));
    await waitFor(() => {
      expect(screen.queryByRole("button", { name: /^now$/i })).not.toBeInTheDocument();
    });

    loadSpy.mockRestore();
  }, 15000);
});
