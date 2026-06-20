import type { HTMLAttributes, PropsWithChildren } from "react";

type GlassCardProps = PropsWithChildren<HTMLAttributes<HTMLDivElement>>;

export function GlassCard({
  children,
  className = "",
  ...props
}: GlassCardProps) {
  return (
    <div
      className={[
        "rounded-ae-lg border border-white/[0.07] bg-ae-surface-glass p-5 shadow-ae-glow",
        "backdrop-blur-2xl ring-1 ring-white/[0.03]",
        className,
      ].join(" ")}
      {...props}
    >
      {children}
    </div>
  );
}
