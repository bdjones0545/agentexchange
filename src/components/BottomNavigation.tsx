import { NavLink } from "react-router-dom";

import { navigationItems } from "../data/navigation";

export function BottomNavigation() {
  return (
    <nav
      aria-label="Bottom navigation"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-white/[0.08] bg-ae-surface/90 px-3 py-3 backdrop-blur-2xl md:hidden"
    >
      <div className="mx-auto grid max-w-md grid-cols-5 gap-1 rounded-ae-xl border border-white/[0.06] bg-white/[0.03] p-1">
        {navigationItems.map((item) => (
          <NavLink
            className={({ isActive }) =>
              [
                "flex flex-col items-center gap-1 rounded-ae-md px-2 py-2 text-center transition",
                isActive
                  ? "bg-ae-primary/15 text-ae-primary shadow-ae-glow"
                  : "text-ae-text-muted hover:bg-white/[0.05] hover:text-ae-text",
              ].join(" ")
            }
            end={item.path === "/"}
            key={item.path}
            to={item.path}
          >
            <span className="grid size-6 place-items-center rounded-md border border-current/25 font-ae-label text-[10px] font-semibold">
              {item.label.slice(0, 1)}
            </span>
            <span className="font-ae-label text-[11px] font-semibold tracking-[0.04em]">
              {item.shortLabel ?? item.label}
            </span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
