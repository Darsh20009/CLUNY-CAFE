import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { openWindowOnSecondaryScreen } from "../client/src/lib/multi-screen-window.ts";

const originalWindow = globalThis.window;
const originalLocalStorage = globalThis.localStorage;

function makePopup() {
  const movedTo: number[][] = [];
  const resizedTo: number[][] = [];
  const popup = {
    opener: null,
    closed: false,
    document: { title: "", body: { innerHTML: "" } },
    location: { replace: (_url: string) => undefined },
    moveTo: (left: number, top: number) => movedTo.push([left, top]),
    resizeTo: (width: number, height: number) => resizedTo.push([width, height]),
  } as unknown as Window;
  return { popup, movedTo, resizedTo };
}

function installBrowserMocks(
  popup: Window | null,
  getScreenDetails?: () => Promise<any>,
) {
  const values = new Map<string, string>();
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { open: () => popup, getScreenDetails },
  });
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    },
  });
  return values;
}

afterEach(() => {
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: originalWindow,
  });
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: originalLocalStorage,
  });
});

test("opens on the non-primary screen and remembers its position", async () => {
  const { popup, movedTo, resizedTo } = makePopup();
  const saved = installBrowserMocks(popup, async () => ({
    screens: [
      { isPrimary: true, left: 0, top: 0, width: 1920, height: 1080 },
      {
        isPrimary: false,
        label: "Rear monitor",
        left: 1920,
        top: 0,
        availLeft: 1920,
        availTop: 0,
        availWidth: 1920,
        availHeight: 1040,
      },
    ],
  }));

  const opened = openWindowOnSecondaryScreen("/dual-pos", "test-screen");
  assert.equal(opened.popup, popup);
  assert.equal(await opened.placement, "secondary");
  assert.deepEqual(movedTo, [[1920, 0]]);
  assert.deepEqual(resizedTo, [[1920, 1040]]);
  assert.equal(JSON.parse(saved.get("test-screen") || "{}").label, "Rear monitor");
});

test("keeps the display usable when screen permission is denied", async () => {
  const { popup } = makePopup();
  installBrowserMocks(popup, async () => {
    throw new Error("permission denied");
  });

  const opened = openWindowOnSecondaryScreen("/dual-pos", "test-screen");
  assert.equal(opened.popup, popup);
  assert.equal(await opened.placement, "permission-denied");
});

test("reports a blocked popup without attempting screen placement", async () => {
  installBrowserMocks(null, async () => ({ screens: [] }));

  const opened = openWindowOnSecondaryScreen("/dual-pos", "test-screen");
  assert.equal(opened.popup, null);
  assert.equal(await opened.placement, "unsupported");
});
