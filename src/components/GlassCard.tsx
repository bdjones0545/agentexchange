import type { HTMLAttributes, PropsWithChildren } from "react";
import { trackSpotlight } from "./landing/motion";

type GlassCardProps = PropsWithChildren<HTMLAttributes<HTMLDivElement> & {
  /** Adds the pointer-following light and a hover lift for clickable cards. */
  interactive?: boolean;
}>;

export function GlassCard({
  children,
  className = "",
  interactive = false,
  onPointerMove,
  ...props
}: GlassCardProps) {
  return (
    <div
      className={[
        "rounded-2xl border border-white/[0.08] bg-gradient-to-b from-ae-surface to-ae-surface/70 p-5",
        "shadow-[inset_0_1px_0_rgb(255_255_255_/_0.04),0_24px_48px_-28px_rgb(0_0_0_/_0.7)]",
        interactive ? "ax-spotlight transition duration-300 hover:-translate-y-0.5 hover:border-ae-primary/30" : "",
        className,
      ].join(" ")}
      onPointerMove={interactive ? (event) => { trackSpotlight(event); onPointerMove?.(event); } : onPointerMove}
      {...props}
    >
      {children}
    </div>
  );
}
