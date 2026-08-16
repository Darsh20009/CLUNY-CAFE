import { useState, useEffect } from "react";
import { isCapacitorNative } from "@/lib/platform";
import clunyLogo from "@assets/cluny-logo-customer.png";

const SPLASH_DURATION = 2400; // ms before starting fade-out
const FADE_DURATION = 500;    // ms for fade animation

interface SplashScreenProps {
  onDone: () => void;
}

export function SplashScreen({ onDone }: SplashScreenProps) {
  const [phase, setPhase] = useState<"in" | "visible" | "out">("in");

  useEffect(() => {
    // Fade in → visible → fade out
    const t1 = setTimeout(() => setPhase("visible"), 50);
    const t2 = setTimeout(() => setPhase("out"), SPLASH_DURATION);
    const t3 = setTimeout(onDone, SPLASH_DURATION + FADE_DURATION);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [onDone]);

  return (
    <div
      dir="rtl"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 99999,
        background: "linear-gradient(160deg, #0a0205 0%, #1a0510 50%, #0a0205 100%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 0,
        opacity: phase === "out" ? 0 : phase === "visible" ? 1 : 0,
        transition: phase === "out"
          ? `opacity ${FADE_DURATION}ms ease-in`
          : "opacity 400ms ease-out",
        userSelect: "none",
        WebkitUserSelect: "none",
      }}
    >
      {/* Radial glow behind logo */}
      <div
        style={{
          position: "absolute",
          width: 300,
          height: 300,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(45,155,110,0.18) 0%, transparent 70%)",
          animation: "splashPulse 2s ease-in-out infinite",
        }}
      />

      {/* Logo */}
      <div
        style={{
          position: "relative",
          transform: phase === "visible" ? "scale(1) translateY(0)" : "scale(0.85) translateY(12px)",
          transition: "transform 600ms cubic-bezier(0.34,1.4,0.64,1)",
        }}
      >
        <img
          src={clunyLogo}
          alt="CLUNY CAFE"
          style={{
            width: 120,
            height: 120,
            borderRadius: 28,
            objectFit: "cover",
            boxShadow: "0 24px 64px rgba(45,155,110,0.35), 0 0 0 1px rgba(255,255,255,0.06)",
          }}
        />
      </div>

      {/* Brand name */}
      <div
        style={{
          marginTop: 28,
          textAlign: "center",
          transform: phase === "visible" ? "translateY(0)" : "translateY(10px)",
          opacity: phase === "visible" ? 1 : 0,
          transition: "transform 600ms 150ms cubic-bezier(0.34,1.4,0.64,1), opacity 600ms 150ms ease",
        }}
      >
        <p
          style={{
            color: "#fff",
            fontWeight: 900,
            fontSize: 28,
            letterSpacing: "0.04em",
            margin: 0,
            lineHeight: 1.1,
          }}
        >
          CLUNY CAFE
        </p>
        <p
          style={{
            color: "rgba(255,255,255,0.35)",
            fontWeight: 500,
            fontSize: 13,
            letterSpacing: "0.12em",
            marginTop: 6,
            textTransform: "uppercase",
          }}
        >
          Cafe
        </p>
      </div>

      {/* Loading dots */}
      <div
        style={{
          position: "absolute",
          bottom: 60,
          display: "flex",
          gap: 7,
          opacity: phase === "visible" ? 1 : 0,
          transition: "opacity 600ms 400ms ease",
        }}
      >
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: "rgba(45,155,110,0.7)",
              animation: `splashDot 1.2s ${i * 0.2}s ease-in-out infinite`,
            }}
          />
        ))}
      </div>

      <style>{`
        @keyframes splashPulse {
          0%, 100% { transform: scale(1); opacity: 0.7; }
          50% { transform: scale(1.15); opacity: 1; }
        }
        @keyframes splashDot {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.3; }
          40% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

/**
 * Hook: returns true while the splash is visible.
 * Only activates inside a Capacitor native app.
 */
export function useSplash() {
  const native = isCapacitorNative();
  const [showing, setShowing] = useState(native);
  return { showing, done: () => setShowing(false) };
}
