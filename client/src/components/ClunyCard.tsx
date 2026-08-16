import cardFrame from "@assets/Screenshot_2026-04-23_at_2.48.53_AM_1776901738354.png";
import SarIcon from "@/components/sar-icon";

interface ClunyCardProps {
  phone?: string;
  points?: number;
  sarValue?: number | string;
  customerName?: string;
  className?: string;
}

export default function ClunyCard({
  phone,
  points = 0,
  sarValue,
  customerName,
  className = "",
}: ClunyCardProps) {
  const displayPhone = phone
    ? phone.replace(/^\+?966|^00966/, "966").replace(/^0(\d{9})$/, "966$1")
    : "966XXXXXXXXX";

  const sarNum =
    typeof sarValue === "number"
      ? sarValue
      : typeof sarValue === "string"
      ? parseFloat(sarValue) || 0
      : points * 0.02;

  const displaySar = sarNum.toLocaleString("en-SA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return (
    <div
      className={`relative overflow-hidden select-none ${className}`}
      style={{
        width: "100%",
        aspectRatio: "85.6 / 53.98",
        borderRadius: 22,
        backgroundImage: `url(${cardFrame})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        boxShadow:
          "0 32px 80px rgba(0,0,0,0.85), 0 0 0 1px rgba(200,165,58,0.18), inset 0 1px 0 rgba(200,165,58,0.08)",
      }}
      data-testid="loyalty-card"
    >
      {/* Middle: Phone number + name */}
      <div
        style={{
          position: "absolute",
          top: "54%",
          left: "7%",
          right: "7%",
          transform: "translateY(-50%)",
        }}
      >
        <p
          dir="ltr"
          style={{
            color: "#E5C461",
            fontWeight: 700,
            fontSize: "clamp(11px, 3vw, 18px)",
            letterSpacing: "0.18em",
            margin: 0,
            fontFamily: "'Courier New', 'Trebuchet MS', monospace",
            textShadow: "0 1px 10px rgba(0,0,0,0.85)",
          }}
          data-testid="text-phone-display"
        >
          {displayPhone}
        </p>
        {customerName && (
          <p
            style={{
              color: "rgba(229,196,97,0.85)",
              fontSize: "clamp(7px, 1.6vw, 11px)",
              margin: "5px 0 0",
              letterSpacing: "0.12em",
              textShadow: "0 1px 6px rgba(0,0,0,0.8)",
              textTransform: "uppercase",
            }}
          >
            {customerName}
          </p>
        )}
      </div>

      {/* Bottom: Points + SAR */}
      <div
        style={{
          position: "absolute",
          bottom: "10%",
          left: "7%",
          right: "7%",
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
        }}
      >
        <div>
          <p
            style={{
              color: "rgba(229,196,97,0.7)",
              fontSize: "clamp(5px, 1.3vw, 8px)",
              letterSpacing: "0.35em",
              margin: 0,
              textTransform: "uppercase",
              textShadow: "0 1px 4px rgba(0,0,0,0.9)",
            }}
          >
            Points
          </p>
          <p
            style={{
              color: "#E5C461",
              fontWeight: 900,
              fontSize: "clamp(20px, 5.2vw, 32px)",
              margin: 0,
              lineHeight: 1,
              textShadow: "0 2px 14px rgba(0,0,0,0.9)",
            }}
            data-testid="text-points"
          >
            {points.toLocaleString()}
          </p>
        </div>

        <div style={{ textAlign: "right" }}>
          <p
            style={{
              color: "rgba(229,196,97,0.65)",
              fontSize: "clamp(5px, 1.3vw, 8px)",
              letterSpacing: "0.25em",
              margin: 0,
              textTransform: "uppercase",
              textShadow: "0 1px 4px rgba(0,0,0,0.9)",
            }}
          >
            Value
          </p>
          <p
            style={{
              color: "#E5C461",
              fontSize: "clamp(10px, 2.4vw, 14px)",
              margin: 0,
              fontFamily: "monospace",
              letterSpacing: "0.04em",
              textShadow: "0 1px 6px rgba(0,0,0,0.9)",
            }}
            data-testid="text-sar-value"
          >
            {displaySar} <SarIcon size={13} className="inline-block align-middle opacity-90" />
          </p>
        </div>
      </div>
    </div>
  );
}
