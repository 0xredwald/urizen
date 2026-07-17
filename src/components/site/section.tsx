import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Section({
  id,
  children,
  className,
  index,
}: {
  id?: string;
  children: ReactNode;
  className?: string;
  index?: string;
}) {
  return (
    <section
      id={id}
      className={cn("relative scroll-mt-20 px-5 py-24 sm:px-8 sm:py-32", className)}
    >
      {index && (
        <span className="pointer-events-none absolute right-5 top-10 font-mono text-[0.75rem] uppercase tracking-[0.2em] text-muted-foreground/60 sm:right-8">
          {index}
        </span>
      )}
      <div className="mx-auto max-w-7xl">{children}</div>
    </section>
  );
}
