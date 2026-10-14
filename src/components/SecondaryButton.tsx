import type { ButtonHTMLAttributes, PropsWithChildren } from "react";

type SecondaryButtonProps = PropsWithChildren<
  ButtonHTMLAttributes<HTMLButtonElement>
>;

export function SecondaryButton({
  children,
  className = "",
  type = "button",
  ...props
}: SecondaryButtonProps) {
  return (
    <button
      className={[
        "inline-flex items-center justify-center gap-2 rounded-xl border border-white/[0.12] bg-white/[0.04] px-5 py-3",
        "font-ae-label text-sm font-semibold text-ae-text",
        "transition duration-200 ease-out enabled:hover:-translate-y-0.5 enabled:hover:border-ae-primary/40 enabled:hover:bg-white/[0.07]",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ae-primary",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      ].join(" ")}
      type={type}
      {...props}
    >
      {children}
    </button>
  );
}
