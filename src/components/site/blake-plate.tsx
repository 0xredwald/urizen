import Image from "next/image";

/**
 * A William Blake engraving rendered as a neon-green duotone with a slow
 * ken-burns drift. Grayscale × signal-green (multiply) → black shadows,
 * neon highlights. Tasteful, animated, on-brand.
 */
export function BlakePlate({
  src,
  alt,
  className,
  delay = 0,
}: {
  src: string;
  alt: string;
  className?: string;
  delay?: number;
}) {
  return (
    <figure
      className={`scanlines group relative overflow-hidden border border-white/10 ${className ?? ""}`}
      style={{ isolation: "isolate" }}
    >
      <Image
        src={src}
        alt={alt}
        fill
        sizes="(max-width: 1024px) 45vw, 30vw"
        className="anim-kenburns object-cover grayscale contrast-[1.15] brightness-110"
        style={{ animationDelay: `${delay}s` }}
      />
      {/* neon-green duotone */}
      <div className="pointer-events-none absolute inset-0" style={{ background: "var(--signal)", mixBlendMode: "multiply" }} />
      <div className="pointer-events-none absolute inset-0" style={{ background: "rgba(52,240,3,0.14)", mixBlendMode: "screen" }} />
      {/* vignette */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(120% 100% at 50% 28%, transparent 42%, rgba(10,10,11,0.62) 100%)" }}
      />
    </figure>
  );
}
