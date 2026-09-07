import Image from "next/image";
import logoImage from "../../public/images/logo/logo.png";

export function LogoMark({ size = 32, className = "" }: { size?: number; className?: string }) {
  return (
    <Image
      src={logoImage}
      alt="AI広報"
      className={className}
      style={{ height: size, width: "auto", objectFit: "contain", flexShrink: 0 }}
      sizes={`${Math.ceil(size * logoImage.width / logoImage.height)}px`}
    />
  );
}

export function Logo({
  size = 30,
  showTagline = false,
  className = "",
}: {
  size?: number;
  showTagline?: boolean;
  className?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <LogoMark size={Math.round(size * 1.6)} />
      {showTagline && (
        <span
          className="font-serif font-medium muted tracking-wide"
          style={{ fontSize: Math.round(size * 0.3) }}
        >
          成果を出すAI広報部
        </span>
      )}
    </span>
  );
}
