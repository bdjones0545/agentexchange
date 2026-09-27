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
        "",
        className,
      ].join(" ")}
      {...props}
    >
      {children}
    </div>
  );
}
