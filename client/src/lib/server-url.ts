/**
 * Capacitor API URL utility.
 *
 * In a regular browser the relative URL `/api/...` works fine because the
 * Express server also serves the static assets on the same origin.
 *
 * In a Capacitor native build the app assets are loaded from
 * `capacitor://localhost/...` which has no backend — all `/api/...` calls
 * must be redirected to the real production server.
 *
 * Priority for the server URL (highest → lowest):
 *   1. Build-time env  VITE_CAPACITOR_SERVER_URL  (set in .env)
 *   2. Runtime storage localStorage("qirox_server_url")
 *   3. Empty string → relative URLs (works in browser / when server.url is
 *      set in capacitor.config.json)
 */

export function isCapacitorNative(): boolean {
  try {
    if (!!(window as any).Capacitor?.isNative) return true;
    if (window.location.protocol === "capacitor:") return true;
    if (window.location.hostname === "localhost" && !!(window as any).Capacitor) return true;
    if (navigator.userAgent.includes("BlackRoseApp")) return true;
    return false;
  } catch {
    return false;
  }
}

export function getServerUrl(): string {
  if (!isCapacitorNative()) return '';

  const buildTimeUrl = (import.meta.env.VITE_CAPACITOR_SERVER_URL as string) || '';
  if (buildTimeUrl) return buildTimeUrl.replace(/\/$/, '');

  try {
    const runtime = localStorage.getItem('qirox_server_url') || '';
    if (runtime) return runtime.replace(/\/$/, '');
  } catch {}

  return '';
}

/**
 * Converts a relative API path to an absolute URL when running in Capacitor.
 * In the browser this is a no-op (returns the path unchanged).
 */
export function apiUrl(path: string): string {
  const base = getServerUrl();
  if (!base) return path;
  return base + (path.startsWith('/') ? path : '/' + path);
}
