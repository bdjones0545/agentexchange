import type { ButtonHTMLAttributes, PropsWithChildren } from "react";

type PrimaryButtonProps = PropsWithChildren<
  ButtonHTMLAttributes<HTMLButtonElement>
>;

export function PrimaryButton({
  children,
  className = "",
  type = "button",
  ...props
}: PrimaryButtonProps) {
  return (
    <button
      className={[
        "inline-flex items-center justify-center gap-2 rounded-xl bg-ae-primary-action px-5 py-3",
        "font-ae-label text-sm font-semibold text-ae-primary-ink",
        "transition duration-200 ease-out enabled:hover:-translate-y-0.5 enabled:hover:shadow-[0_10px_30px_-8px_rgb(120_240_188_/_0.6)]",
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
