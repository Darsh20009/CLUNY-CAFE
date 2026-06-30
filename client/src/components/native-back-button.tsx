import { ChevronRight } from "lucide-react";
import { useLocation } from "wouter";
import { useEffect, useState, useCallback } from "react";

const HIDE_ON_PATHS = [
  "/", "/menu", "/welcome", "/customer-login", "/auth", "/forgot-password",
  "/employee/login", "/employee", "/manager/login", "/kiosk", "/qirox",
  "/tenant/signup", "/promo",
];

const NAV_STACK_KEY = "qirox_nav_stack";

function getNavStack(): string[] {
  try {
    return JSON.parse(sessionStorage.getItem(NAV_STACK_KEY) || "[]");
  } catch { return []; }
}

function setNavStack(stack: string[]) {
  try {
    sessionStorage.setItem(NAV_STACK_KEY, JSON.stringify(stack));
  } catch {}
}

export function clearNavStack() {
  try { sessionStorage.removeItem(NAV_STACK_KEY); } catch {}
}

function shouldHidePath(path: string): boolean {
  return (
    HIDE_ON_PATHS.includes(path) ||
    path.startsWith("/kiosk") ||
    path.startsWith("/employee") ||
    path.startsWith("/manager") ||
    path.startsWith("/admin") ||
    path.startsWith("/qirox")
  );
}

export function NativeBackButton() {
  const [location, navigate] = useLocation();
  const [hasPrev, setHasPrev] = useState(false);

  // Push to nav stack when route changes via wouter navigate
  useEffect(() => {
    if (shouldHidePath(location)) {
      setNavStack([location]);
      setHasPrev(false);
      return;
    }
    const stack = getNavStack();
    const last = stack[stack.length - 1];
    if (last !== location) {
      const newStack = [...stack, location];
      if (newStack.length > 30) newStack.shift();
      setNavStack(newStack);
      setHasPrev(newStack.length > 1);
    } else {
      setHasPrev(stack.length > 1);
    }
  }, [location]);

  // Sync nav stack with native browser back (iOS swipe-back gesture / history.back())
  useEffect(() => {
    const onPopState = () => {
      const newPath = window.location.pathname + window.location.search;
      const stack = getNavStack();
      if (stack.length <= 1) {
        setHasPrev(false);
        return;
      }
      const idx = stack.lastIndexOf(newPath);
      if (idx >= 0) {
        const newStack = stack.slice(0, idx + 1);
        setNavStack(newStack);
        setHasPrev(newStack.length > 1);
      } else if (stack.length > 1) {
        const newStack = stack.slice(0, -1);
        setNavStack(newStack);
        setHasPrev(newStack.length > 1);
      }
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const handleBack = useCallback(() => {
    const stack = getNavStack();
    if (stack.length <= 1) {
      navigate("/");
      return;
    }
    stack.pop();
    const prev = stack[stack.length - 1];
    setNavStack(stack);
    setHasPrev(stack.length > 1);
    if (prev) navigate(prev);
    else navigate("/");
  }, [navigate]);

  if (!hasPrev) return null;
  if (shouldHidePath(location)) return null;

  return (
    <button
      onClick={handleBack}
      data-testid="button-native-back"
      aria-label="رجوع"
      style={{ direction: "ltr" }}
      className="fixed top-3 right-3 z-[200] flex items-center justify-center w-10 h-10 rounded-full bg-white/90 dark:bg-black/80 border border-gray-200 dark:border-gray-700 shadow-lg backdrop-blur-sm active:scale-90 transition-transform"
    >
      <ChevronRight className="w-5 h-5 text-gray-800 dark:text-gray-100" />
    </button>
  );
}
