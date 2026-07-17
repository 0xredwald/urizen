import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Eyebrow({
  children,
  className,
  marker = true,
}: {
  children: ReactNode;
  className?: string;
  marker?: boolean;
}) {
  return (
    <span className={cn("eyebrow inline-flex items-center gap-2.5", className)}>
      {marker && <span className="size-1.5 bg-signal" aria-hidden />}
      {children}
    </span>
  );
}

type BtnVariant = "solid" | "ghost" | "signal";

const btnBase =
  "group relative inline-flex items-center justify-center gap-2.5 border px-7 py-3.5 font-mono text-[0.78rem] uppercase tracking-[0.14em] transition-colors duration-200 select-none";

const btnVariants: Record<BtnVariant, string> = {
  solid:
    "border-foreground bg-foreground text-background hover:bg-transparent hover:text-foreground",
  ghost:
    "border-border bg-transparent text-foreground hover:border-foreground/80 hover:bg-foreground/[0.04]",
  signal:
    "border-signal bg-signal text-[#04140a] hover:bg-transparent hover:text-signal",
};

export function BrutalLink({
  children,
  className,
  variant = "ghost",
  ...props
}: ComponentProps<typeof Link> & { variant?: BtnVariant }) {
  return (
    <Link className={cn(btnBase, btnVariants[variant], className)} {...props}>
      {children}
    </Link>
  );
}

export function Stat({
  value,
  label,
  note,
  className,
}: {
  value: ReactNode;
  label: string;
  note?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <span className="font-display text-5xl leading-none text-signal sm:text-6xl">
        {value}
      </span>
      <span className="font-mono text-xs uppercase tracking-[0.16em] text-foreground">
        {label}
      </span>
      {note && (
        <span className="font-mono text-[0.76rem] uppercase tracking-[0.1em] text-muted-foreground">
          {note}
        </span>
      )}
    </div>
  );
}
