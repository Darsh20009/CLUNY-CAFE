/**
 * Kiosk Lock — keeps the POS/kiosk screen from being knocked out of place by
 * OS-level gestures.
 *
 * IMPORTANT CONTEXT: the "screen shrinks into a corner for a few seconds then
 * comes back" symptom (sometimes paired with a flash of white) that recurs on
 * Android POS tablets is, in the vast majority of cases, NOT a bug in the POS
 * page's own code — it is Android's system "recent apps" / task-switcher
 * gesture (an edge-swipe-and-hold from the bottom of the screen). That
 * gesture shrinks WHATEVER app is on screen into a small floating card
 * (showing a blank/white placeholder behind it) and restores it a moment
 * later when released — from the user's point of view it looks exactly like
 * "the screen shrank to a corner and came back", but the web page itself
 * never actually re-rendered or resized anything.
 *
 * No amount of rewriting the POS React code can prevent an OS-level system
 * gesture — that gesture happens above the browser, not inside it. The two
 * real fixes are:
 *   1) Requesting Fullscreen at the browser/OS level, which supresses (or at
 *      least greatly reduces) how easily that edge gesture can be triggered,
 *      and immediately re-asserts fullscreen if it ever gets exited.
 *   2) Enabling Android's built-in "Screen Pinning" (kiosk mode) on the
 *      device itself, which fully disables the home/recent-apps gestures
 *      system-wide. This is a device setting, not something fixable in code
 *      — ask the user to enable "تثبيت الشاشة" (Screen Pinning) in Android
 *      Settings > Security, then triple-tap the app's task-switcher icon (or
 *      hold Overview) and pin CLUNY CAFE's browser/PWA tab.
 */

let fullscreenRequested = false;

function tryRequestFullscreen() {
  const el = document.documentElement as any;
  if (document.fullscreenElement) return;
  const req = el.requestFullscreen || el.webkitRequestFullscreen || el.mozRequestFullScreen || el.msRequestFullscreen;
  if (!req) return;
  try {
    const result = req.call(el);
    if (result && typeof result.catch === "function") {
      result.catch(() => {
        // Fullscreen requires a user gesture on most browsers — the retry
        // listeners below cover that case.
      });
    }
  } catch {
    // ignore — will retry on next user interaction
  }
}

let wakeLock: any = null;
async function requestWakeLock() {
  try {
    if ("wakeLock" in navigator) {
      wakeLock = await (navigator as any).wakeLock.request("screen");
    }
  } catch {
    // Not supported or denied — non-fatal.
  }
}

/**
 * Call once from a kiosk/POS-style page (POS, Kitchen Display, Order Status
 * Display, etc). Attempts fullscreen immediately, retries on the first user
 * interaction (fullscreen requires a user gesture in most browsers), and
 * re-asserts fullscreen + wake lock whenever the tab regains focus/visibility
 * (covers the case where an OS gesture or notification shade briefly kicks
 * the page out of fullscreen).
 */
export function enableKioskLock(): () => void {
  tryRequestFullscreen();
  requestWakeLock();

  const onFirstInteraction = () => {
    if (!fullscreenRequested) {
      fullscreenRequested = true;
      tryRequestFullscreen();
      requestWakeLock();
    }
  };
  document.addEventListener("pointerdown", onFirstInteraction, { once: true });
  document.addEventListener("touchstart", onFirstInteraction, { once: true });

  const onVisibilityChange = () => {
    if (document.visibilityState === "visible") {
      tryRequestFullscreen();
      requestWakeLock();
    }
  };
  document.addEventListener("visibilitychange", onVisibilityChange);

  const onFullscreenChange = () => {
    // If something (an OS gesture, an alert, etc.) knocked us out of
    // fullscreen, immediately try to re-enter it.
    if (!document.fullscreenElement) {
      tryRequestFullscreen();
    }
  };
  document.addEventListener("fullscreenchange", onFullscreenChange);

  return () => {
    document.removeEventListener("pointerdown", onFirstInteraction);
    document.removeEventListener("touchstart", onFirstInteraction);
    document.removeEventListener("visibilitychange", onVisibilityChange);
    document.removeEventListener("fullscreenchange", onFullscreenChange);
    if (wakeLock) {
      try { wakeLock.release(); } catch {}
      wakeLock = null;
    }
  };
}
