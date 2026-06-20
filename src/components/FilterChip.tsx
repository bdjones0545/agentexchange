import type { ButtonHTMLAttributes, PropsWithChildren } from "react";

type FilterChipProps = PropsWithChildren<
  ButtonHTMLAttributes<HTMLButtonElement> & {
    active?: boolean;
  }
>;

export function FilterChip({
  active = false,
  children,
  className = "",
  type = "button",
  ...props
}: FilterChipProps) {
  return (
    <button
      className={[
        "inline-flex items-center gap-2 rounded-full border px-4 py-2 font-ae-label text-xs font-semibold uppercase tracking-[0.08em] transition",
        active
          ? "border-ae-primary/40 bg-ae-primary/15 text-ae-primary shadow-ae-glow"
          : "border-white/10 bg-white/[0.04] text-ae-text-muted hover:border-ae-primary/30 hover:bg-white/[0.07] hover:text-ae-text",
        className,
      ].join(" ")}
      type={type}
      {...props}
    >
      {children}
    </button>
  );
}
