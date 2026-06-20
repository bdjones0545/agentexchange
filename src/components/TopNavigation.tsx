import { NavLink } from "react-router-dom";

import { navigationItems } from "../data/navigation";

export function TopNavigation() {
  return (
    <header className="sticky top-0 z-30 border-b border-white/[0.06] bg-ae-background/80 backdrop-blur-2xl">
      <nav
        aria-label="Primary navigation"
        className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6 lg:px-12"
      >
        <NavLink
          className="group inline-flex items-center gap-3"
          end
          to="/"
        >
          <span className="grid size-9 place-items-center rounded-full border border-ae-primary/40 bg-ae-primary/10 font-ae-label text-sm font-semibold text-ae-primary transition group-hover:shadow-ae-glow">
            AE
          </span>
          <span className="font-ae-display text-xl font-semibold tracking-[-0.02em] text-ae-text">
            AgentExchange
          </span>
        </NavLink>

        <div className="hidden items-center gap-2 rounded-full border border-white/[0.06] bg-white/[0.03] p-1 md:flex">
          {navigationItems.map((item) => (
            <NavLink
              className={({ isActive }) =>
                [
                  "rounded-full px-4 py-2 font-ae-label text-xs font-semibold uppercase tracking-[0.08em] transition",
                  isActive
                    ? "bg-ae-primary text-ae-primary-ink shadow-ae-glow"
                    : "text-ae-text-muted hover:bg-white/[0.06] hover:text-ae-text",
                ].join(" ")
              }
              end={item.path === "/"}
              key={item.path}
              to={item.path}
            >
              {item.label}
            </NavLink>
          ))}
        </div>

        <div
          aria-label="Demo account status"
          className="grid size-10 place-items-center rounded-full border border-ae-cyan/30 bg-ae-cyan/10 text-ae-cyan shadow-[0_0_24px_rgb(103_232_249_/_0.14)]"
        >
          <span className="size-2 rounded-full bg-ae-emerald" />
        </div>
      </nav>
    </header>
  );
}
