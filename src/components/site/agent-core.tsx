import Image from "next/image";
import { UrizenMark } from "@/components/brand/marks";

/** Animated "agent core" HUD: rotating rings, radar sweep, Blake soul. */
export function AgentCore() {
  return (
    <div className="scanlines relative mx-auto aspect-square w-full max-w-md overflow-hidden border border-border bg-[#0c0c0e]">
      {/* Blake "soul" behind */}
      <Image
        src="/img/blake-albion.webp"
        alt="William Blake, Albion Rose"
        fill
        sizes="(max-width:1024px) 90vw, 40vw"
        className="object-cover opacity-30 mix-blend-screen"
        style={{ maskImage: "radial-gradient(60% 60% at 50% 45%, #000, transparent 80%)", WebkitMaskImage: "radial-gradient(60% 60% at 50% 45%, #000, transparent 80%)" }}
      />
      {/* dot grid */}
      <div className="dots absolute inset-0 opacity-40" />

      {/* radar sweep */}
      <div className="absolute inset-0 grid place-items-center">
        <div className="anim-radar size-[78%] rounded-full" style={{ background: "conic-gradient(from 0deg, transparent 0deg, rgba(52, 240, 3,0.18) 40deg, transparent 70deg)" }} />
      </div>

      {/* rings */}
      <div className="absolute inset-0 grid place-items-center">
        <div className="anim-spin-slow size-[82%] rounded-full border border-dashed border-signal/30" />
      </div>
      <div className="absolute inset-0 grid place-items-center">
        <div className="anim-spin-rev relative size-[60%] rounded-full border border-border">
          <span className="absolute -top-1 left-1/2 size-2 -translate-x-1/2 rounded-full bg-signal" />
        </div>
      </div>
      <div className="absolute inset-0 grid place-items-center">
        <div className="anim-spin-slow size-[40%] rounded-full border border-signal/40" />
      </div>

      {/* center mark */}
      <div className="absolute inset-0 grid place-items-center">
        <UrizenMark className="anim-pulse-glow h-16 w-auto text-signal" />
      </div>

      {/* corner HUD ticks */}
      {["left-3 top-3 border-l border-t", "right-3 top-3 border-r border-t", "left-3 bottom-3 border-l border-b", "right-3 bottom-3 border-r border-b"].map((c) => (
        <span key={c} className={`absolute size-4 border-signal/60 ${c}`} />
      ))}

      {/* labels */}
      <div className="absolute left-3 top-3 ml-6 font-mono text-[0.72rem] uppercase tracking-[0.16em] text-muted-foreground">
        AGENT&nbsp;#001
      </div>
      <div className="absolute bottom-3 left-3 ml-6 font-mono text-[0.72rem] uppercase tracking-[0.16em] text-muted-foreground">
        URIZEN
      </div>
    </div>
  );
}
