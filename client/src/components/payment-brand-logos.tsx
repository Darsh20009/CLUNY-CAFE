import { SiApplepay, SiMastercard, SiVisa } from "react-icons/si";

export function MadaLogo({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 54 30"
      role="img"
      aria-label="مدى"
      className={className}
    >
      <defs>
        <linearGradient id="mada-gradient" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stopColor="#2874a6" />
          <stop offset="100%" stopColor="#22a77a" />
        </linearGradient>
      </defs>
      <text
        x="27"
        y="22"
        textAnchor="middle"
        direction="rtl"
        unicodeBidi="bidi-override"
        fontFamily="Arial, sans-serif"
        fontSize="23"
        fontWeight="700"
        fill="url(#mada-gradient)"
      >
        مدى
      </text>
    </svg>
  );
}

export function CardNetworkLogos({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center gap-2.5 ${className}`} aria-label="مدى، Visa، Mastercard">
      <MadaLogo className="h-7 w-12" />
      <SiVisa className="h-5 w-9 text-[#1434CB]" aria-label="Visa" />
      <SiMastercard className="h-6 w-8 text-[#EB001B]" aria-label="Mastercard" />
    </div>
  );
}

export function ApplePayLogo({ className = "" }: { className?: string }) {
  return <SiApplepay className={className} aria-label="Apple Pay" />;
}
