import { useEffect } from "react";
import { useLocation } from "wouter";

const MANAGER_ROLES = new Set(["admin", "owner", "manager", "branch_manager"]);

function routeForRole(role: string, managerOnly: boolean): string | null {
  if (managerOnly && !MANAGER_ROLES.has(role)) return null;
  if (role === "admin") return "/admin/dashboard";
  if (role === "owner") return "/owner/dashboard";
  if (role === "manager" || role === "branch_manager") return "/manager/dashboard";
  if (role === "cleaner") return "/employee/attendance";
  return "/employee/home";
}

function clearCachedEmployeeSession() {
  try {
    localStorage.removeItem("currentEmployee");
    localStorage.removeItem("qirox-restore-key");
  } catch {
    // Storage can be unavailable in restricted browser contexts.
  }
}

/**
 * Redirect only after the server confirms the saved employee session.
 * Retain the cached employee for offline POS use, but clear it after the
 * server explicitly reports an expired or missing session.
 */
export function useVerifiedEmployeeSessionRedirect(managerOnly = false) {
  const [, setLocation] = useLocation();

  useEffect(() => {
    let active = true;
    let cached: Record<string, any>;

    try {
      const stored = localStorage.getItem("currentEmployee");
      if (!stored) return;
      cached = JSON.parse(stored);
    } catch {
      clearCachedEmployeeSession();
      return;
    }

    if (!cached?.role) {
      clearCachedEmployeeSession();
      return;
    }

    const redirect = (role: string) => {
      const destination = routeForRole(role, managerOnly);
      if (active && destination) setLocation(destination);
    };

    // Preserve the existing offline entry path for cached POS sessions.
    if (!navigator.onLine) {
      redirect(cached.role);
      return () => {
        active = false;
      };
    }

    const headers: Record<string, string> = {};
    const employeeId = cached.id || cached._id;
    const restoreKey = localStorage.getItem("qirox-restore-key");
    if (employeeId) headers["x-employee-id"] = String(employeeId);
    if (restoreKey) headers["x-restore-key"] = restoreKey;

    fetch("/api/employees/me", { credentials: "include", headers })
      .then(async (response) => {
        if (response.status === 401 || response.status === 404) {
          clearCachedEmployeeSession();
          return;
        }
        if (!response.ok) return;

        const employee = await response.json();
        if (!active || !employee?.role) return;

        try {
          localStorage.setItem(
            "currentEmployee",
            JSON.stringify({ ...cached, ...employee }),
          );
        } catch {
          // The verified server session can still be used without local caching.
        }
        redirect(employee.role);
      })
      .catch(() => {
        // Leave cached data intact on transient network/server errors.
      });

    return () => {
      active = false;
    };
  }, [managerOnly, setLocation]);
}
