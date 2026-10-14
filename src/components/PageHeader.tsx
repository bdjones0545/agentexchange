import type { ReactNode } from "react";

type PageHeaderProps = {
  eyebrow: string;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  /** Narrow pages (forms, legal) center their header over the content column. */
  narrow?: boolean;
};

/** The shared page masthead: eyebrow, headline, lede and actions over a soft grid glow. */
export function PageHeader({ eyebrow, title, description, actions, children, narrow = false }: PageHeaderProps) {
  return <header className={`relative isolate ${narrow ? "mx-auto max-w-3xl" : ""}`}>
    <div aria-hidden className="pointer-events-none absolute -top-28 left-1/2 -z-10 h-80 w-screen -translate-x-1/2 overflow-hidden">
      <div className="ax-grid-bg absolute inset-0 opacity-70" />
      <div className="ax-aurora absolute -top-32 right-[8%] size-[26rem] rounded-full bg-ae-primary/[0.09] blur-[110px]" />
    </div>
    <div className={`grid gap-6 ${actions ? "lg:grid-cols-[1fr_auto] lg:items-end" : ""}`}>
      <div className="max-w-3xl">
        <p className="inline-flex items-center gap-2 font-ae-label text-xs font-semibold uppercase tracking-[0.18em] text-ae-primary"><span aria-hidden className="size-1.5 rounded-full bg-ae-primary" />{eyebrow}</p>
        <h1 className="mt-3 font-ae-display text-3xl font-semibold tracking-[-0.035em] text-balance text-ae-text sm:text-5xl sm:leading-[1.08]">{title}</h1>
        {description && <div className="mt-4 max-w-2xl text-base leading-7 text-ae-text-muted sm:text-lg sm:leading-8">{description}</div>}
        {children}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-3">{actions}</div>}
    </div>
  </header>;
}
