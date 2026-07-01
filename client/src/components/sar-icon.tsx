interface SarIconProps {
  className?: string;
  size?: number;
}

export function SarIcon({ className = "", size = 16 }: SarIconProps) {
  return (
    <span
      className={`inline-flex items-center justify-center font-bold select-none ${className}`}
      style={{ fontSize: size, lineHeight: 1, fontFamily: "'Cairo', 'Arial', sans-serif" }}
      aria-label="ريال سعودي"
    >
      ر.س
    </span>
  );
}

export default SarIcon;
