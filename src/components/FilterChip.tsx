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
        "inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full border px-3.5 py-1.5 text-xs font-medium transition duration-200",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ae-primary",
        active
          ? "border-ae-primary/40 bg-ae-primary/15 text-ae-primary shadow-[0_0_24px_-6px_rgb(120_240_188_/_0.45)]"
          : "border-white/[0.1] bg-white/[0.03] text-ae-text-muted hover:border-ae-primary/30 hover:bg-white/[0.06] hover:text-ae-text",
        className,
      ].join(" ")}
      type={type}
      {...props}
    >
      {children}
    </button>
  );
}
