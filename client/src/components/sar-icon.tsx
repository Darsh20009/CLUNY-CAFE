interface SarIconProps {
  className?: string;
  size?: number;
}

export function SarIcon({ className = "", size = 16 }: SarIconProps) {
  return (
    <img
      src="/riyal-symbol.png"
      alt="﷼"
      aria-label="ريال سعودي"
      className={`inline-block select-none ${className}`}
      style={{
        height: size,
        width: "auto",
        verticalAlign: "middle",
        marginBottom: 1,
        mixBlendMode: "multiply",
      }}
    />
  );
}

export default SarIcon;
