import { useCallback, useEffect, useRef, useState } from "react";

export type UserLocation = { lat: number; lng: number; accuracy: number };
export type LocationStatus = "idle" | "locating" | "on" | "denied" | "unavailable";

/** Watches the device position once the user asks for it (or if they already allowed it before). */
export function useUserLocation() {
  const [location, setLocation] = useState<UserLocation | null>(null);
  const [status, setStatus] = useState<LocationStatus>("idle");
  const watchId = useRef<number | null>(null);
  const hasFix = useRef(false);

  const start = useCallback(() => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setStatus("unavailable");
      return;
    }
    if (watchId.current !== null) return;
    setStatus(hasFix.current ? "on" : "locating");
    watchId.current = navigator.geolocation.watchPosition(
      (p) => {
        hasFix.current = true;
        setLocation({
          lat: p.coords.latitude,
          lng: p.coords.longitude,
          accuracy: p.coords.accuracy,
        });
        setStatus("on");
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
          watchId.current = null;
          hasFix.current = false;
          setLocation(null);
          setStatus("denied");
        } else if (!hasFix.current) {
          setStatus("unavailable");
        }
      },
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 20_000 },
    );
  }, []);

  useEffect(() => {
    // Resume automatically for visitors who already allowed location.
    navigator.permissions
      ?.query({ name: "geolocation" as PermissionName })
      .then((r) => {
        if (r.state === "granted") start();
      })
      .catch(() => {});
    return () => {
      if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
    };
  }, [start]);

  return { location, status, start };
}
