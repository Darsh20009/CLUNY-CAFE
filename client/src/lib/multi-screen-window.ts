type DetailedScreen = {
  isPrimary?: boolean;
  label?: string;
  availLeft?: number;
  availTop?: number;
  availWidth?: number;
  availHeight?: number;
  left?: number;
  top?: number;
  width?: number;
  height?: number;
};

type ScreenDetails = {
  screens: DetailedScreen[];
  currentScreen?: DetailedScreen;
};

type WindowWithScreenDetails = Window & {
  getScreenDetails?: () => Promise<ScreenDetails>;
};

export type ScreenPlacementResult =
  | "secondary"
  | "no-secondary-screen"
  | "unsupported"
  | "permission-denied";

export function openWindowOnSecondaryScreen(
  url: string,
  preferenceKey: string,
): { popup: Window | null; placement: Promise<ScreenPlacementResult> } {
  const screenApi = (window as WindowWithScreenDetails).getScreenDetails;
  let detailsPromise: Promise<ScreenDetails> | null = null;

  // Start the permission request directly in the click handler. The popup is
  // still opened synchronously below so browser popup blockers do not drop it.
  if (screenApi) {
    try {
      detailsPromise = screenApi.call(window);
    } catch {
      detailsPromise = null;
    }
  }

  const popup = window.open(
    "about:blank",
    "_blank",
    "popup=yes,width=1280,height=900",
  );

  if (!popup) {
    return { popup: null, placement: Promise.resolve("unsupported") };
  }

  try {
    popup.opener = null;
    popup.document.title = "شاشة العميل - CLUNY";
    popup.document.body.innerHTML =
      '<main dir="rtl" style="font:600 20px sans-serif;display:grid;place-items:center;height:90vh;color:#287b5a">جارٍ فتح شاشة العميل…</main>';
    popup.location.replace(url);
  } catch {
    // The page can still open normally if the browser restricts popup access.
  }

  if (!screenApi || !detailsPromise) {
    return { popup, placement: Promise.resolve("unsupported") };
  }

  const placement = detailsPromise.then((details): ScreenPlacementResult => {
    const screens = Array.isArray(details?.screens) ? details.screens : [];
    const externalScreens = screens.filter((screen) => screen.isPrimary === false);
    if (!externalScreens.length) return "no-secondary-screen";

    let preferred: { label?: string; left?: number; top?: number } | null = null;
    try {
      const stored = localStorage.getItem(preferenceKey);
      preferred = stored ? JSON.parse(stored) : null;
    } catch {
      preferred = null;
    }

    const target =
      (preferred && externalScreens.find((screen) =>
        (preferred?.label ? screen.label === preferred.label : true) &&
        screen.left === preferred.left &&
        screen.top === preferred.top
      )) ||
      externalScreens[0];

    const left = target.availLeft ?? target.left ?? 0;
    const top = target.availTop ?? target.top ?? 0;
    const width = target.availWidth ?? target.width ?? 1280;
    const height = target.availHeight ?? target.height ?? 800;

    try {
      if (popup.closed) return "unsupported";
      popup.moveTo(left, top);
      popup.resizeTo(width, height);
      localStorage.setItem(preferenceKey, JSON.stringify({
        label: target.label || "",
        left: target.left ?? left,
        top: target.top ?? top,
      }));
      return "secondary";
    } catch {
      return "unsupported";
    }
  }).catch((): ScreenPlacementResult => "permission-denied");

  return { popup, placement };
}
