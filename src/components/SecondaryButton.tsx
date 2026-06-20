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
        "inline-flex items-center justify-center rounded-ae-md border border-white/10 bg-white/[0.04] px-5 py-3",
        "font-ae-label text-sm font-semibold tracking-[0.04em] text-ae-text",
        "backdrop-blur-xl transition duration-200 ease-out hover:-translate-y-0.5 hover:border-ae-primary/40 hover:bg-white/[0.07] hover:shadow-ae-glow",
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
