import { SiApplepay, SiMastercard, SiVisa } from "react-icons/si";

export function MadaLogo({ className = "" }: { className?: string }) {
  return (
    <img
      src="/mada-logo.png"
      alt="مدى mada"
      className={`object-contain ${className}`}
      draggable={false}
    />
  );
}

export function CardNetworkLogos({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center gap-2.5 ${className}`} aria-label="مدى، Visa، Mastercard">
      <MadaLogo className="h-7 w-[82px]" />
      <SiVisa className="h-5 w-9 text-[#1434CB]" aria-label="Visa" />
      <SiMastercard className="h-6 w-8 text-[#EB001B]" aria-label="Mastercard" />
    </div>
  );
}

export function ApplePayLogo({ className = "" }: { className?: string }) {
  return <SiApplepay className={className} aria-label="Apple Pay" />;
}
