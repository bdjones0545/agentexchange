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
        "inline-flex items-center justify-center rounded-ae-md bg-ae-primary-action px-5 py-3",
        "font-ae-label text-sm font-semibold tracking-[0.04em] text-white",
        "transition duration-200 ease-out hover:-translate-y-0.5 hover:shadow-ae-glow",
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
