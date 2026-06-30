/**
 * mapkit-js.ts
 * Loads Apple MapKit JS from Apple's CDN and initializes it.
 *
 * Token strategy:
 *  1. Token is fetched from /api/mapkit/token (or VITE_MAPKIT_TOKEN env fallback)
 *     BEFORE init() is called, so done() is invoked synchronously.
 *  2. When MapKit calls authorizationCallback again (on token expiry) we
 *     re-fetch a fresh one from the server — fully automatic refresh.
 */

declare global {
  interface Window { mapkit: any; }
}

let _loaded = false;
let _initPromise: Promise<any> | null = null;

/** Fetches a fresh token from the server; falls back to the bundled env var. */
export async function fetchMapKitToken(): Promise<string> {
  try {
    const res = await fetch("/api/mapkit/token", { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      if (data.token) return data.token as string;
    }
  } catch {
    // network error — fall through to env var
  }
  return (import.meta.env.VITE_MAPKIT_TOKEN as string) ?? "";
}

/** Dynamically loads the MapKit JS SDK and initializes it. Returns mapkit global. */
export async function loadMapKit(): Promise<any> {
  if (_initPromise) return _initPromise;

  _initPromise = (async () => {
    try {
      // Already initialized
      if (window.mapkit && _loaded) return window.mapkit;

      // 1. Fetch token BEFORE init so we can call done() synchronously
      const initialToken = await fetchMapKitToken();

      // 2. Load MapKit JS SDK from Apple CDN (full build includes map, services, look-around)
      if (!window.mapkit) {
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement("script");
          script.src = "https://cdn.apple-mapkit.com/mk/5.x.x/mapkit.js";
          script.crossOrigin = "anonymous";
          script.onload = () => resolve();
          script.onerror = () => reject(new Error("Failed to load MapKit JS SDK"));
          document.head.appendChild(script);
        });
      }

      // 3. Initialize — authorizationCallback calls done() synchronously on first call,
      //    then re-fetches from server on subsequent calls (token expiry refresh).
      let firstCall = true;
      window.mapkit.init({
        authorizationCallback: (done: (token: string) => void) => {
          if (firstCall) {
            firstCall = false;
            done(initialToken);
          } else {
            // Token expired — fetch a fresh one from the server
            fetchMapKitToken().then(done).catch(() => done(initialToken));
          }
        },
        language: document.documentElement.lang === "ar" ? "ar" : "en",
      });

      _loaded = true;
      return window.mapkit;
    } catch (err) {
      _initPromise = null; // allow retry
      throw err;
    }
  })();

  return _initPromise;
}

/** Build a mapkit.Coordinate from lat/lng */
export async function mkCoordinate(lat: number, lng: number): Promise<any> {
  const mk = await loadMapKit();
  return new mk.Coordinate(lat, lng);
}

/** Build a mapkit.CoordinateRegion centred on lat/lng with the given span */
export async function mkRegion(
  lat: number, lng: number,
  latSpan = 0.02, lngSpan = 0.02
): Promise<any> {
  const mk = await loadMapKit();
  return new mk.CoordinateRegion(
    new mk.Coordinate(lat, lng),
    new mk.CoordinateSpan(latSpan, lngSpan)
  );
}
