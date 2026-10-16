import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RouteMap } from "./RouteMap";

vi.mock("next/dynamic", () => ({
  default: () => function TestCanvas({ onReady, onError }: { onReady: () => void; onError: () => void }) {
    return (
      <div data-testid="map-canvas">
        <button onClick={onReady}>Test ready</button>
        <button onClick={onError}>Test tile failure</button>
      </div>
    );
  },
}));

const stops = [
  { time: "09:00", stop: "Market", lat: 23, lng: 113 },
  { time: "11:00", stop: "Unlocated stop", lat: null, lng: null },
  { time: "13:00", stop: "Museum", lat: 24, lng: 114 },
];

let enterViewport: () => void;
const disconnect = vi.fn();

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("IntersectionObserver", class {
    constructor(callback: IntersectionObserverCallback) {
      enterViewport = () => callback([{ isIntersecting: true } as IntersectionObserverEntry], this as unknown as IntersectionObserver);
    }
    observe = vi.fn();
    disconnect = disconnect;
  });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("RouteMap", () => {
  it("keeps geographic text without requesting a map before viewport proximity", () => {
    render(<RouteMap stops={stops} routeTitle="Test itinerary" />);
    expect(screen.queryByTestId("map-canvas")).not.toBeInTheDocument();
    expect(screen.getByText("Market")).toBeInTheDocument();
    expect(screen.queryByText("23.0000° latitude, 113.0000° longitude")).not.toBeInTheDocument();
    expect(screen.getByText("Coordinates unavailable")).toBeInTheDocument();
    expect(screen.getByText(/A visual reading of the route/)).toBeInTheDocument();

    act(() => enterViewport());
    expect(screen.getByTestId("map-canvas")).toBeInTheDocument();
    expect(disconnect).toHaveBeenCalled();
    fireEvent.click(screen.getByText("Test ready"));
    expect(screen.getByRole("list", { name: "Test itinerary: stop locations" })).toBeInTheDocument();
    expect(screen.getByText("Recorded locations for this itinerary.")).toBeInTheDocument();
  });

  it("unmounts a failed map, preserves data and retries only on request", () => {
    render(<RouteMap stops={stops} routeTitle="Test itinerary" />);
    act(() => enterViewport());
    fireEvent.click(screen.getByText("Test tile failure"));
    expect(screen.queryByTestId("map-canvas")).not.toBeInTheDocument();
    expect(screen.getByText(/The map could not load/)).toBeInTheDocument();
    expect(screen.getByText("Museum")).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(60000));
    expect(screen.queryByTestId("map-canvas")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry map" }));
    expect(screen.getByTestId("map-canvas")).toBeInTheDocument();
  });

  it("bounds a stalled chunk with a useful fallback", () => {
    render(<RouteMap stops={stops} routeTitle="Test itinerary" />);
    act(() => enterViewport());
    act(() => vi.advanceTimersByTime(20000));
    expect(screen.queryByTestId("map-canvas")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry map" })).toBeInTheDocument();
  });

  it("never mounts a map or offers retry without valid coordinates", () => {
    render(<RouteMap stops={[stops[1]]} routeTitle="No locations" />);
    expect(screen.getByText("Map locations are not available for this itinerary.")).toBeInTheDocument();
    expect(screen.queryByTestId("map-canvas")).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("keeps manual loading available without IntersectionObserver", () => {
    vi.stubGlobal("IntersectionObserver", undefined);
    // Property absence mirrors a browser that does not implement this API.
    Reflect.deleteProperty(window, "IntersectionObserver");
    render(<RouteMap stops={stops} routeTitle="Test itinerary" />);
    expect(screen.queryByTestId("map-canvas")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Load map" }));
    expect(screen.getByTestId("map-canvas")).toBeInTheDocument();
  });
});
