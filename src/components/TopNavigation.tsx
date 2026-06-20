import { NavLink, useLocation } from "react-router-dom";

import { navigationItems } from "../data/navigation";
import { useAuth } from "../state/AuthContext";

export function TopNavigation() {
  const location = useLocation();
  const { isAuthenticated } = useAuth();

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

        <div className="hidden max-w-[68%] items-center gap-1 overflow-x-auto rounded-full border border-white/[0.06] bg-white/[0.03] p-1 lg:flex">
          {navigationItems.map((item) => (
            <NavLink
              className={({ isActive }) =>
                {
                  const isRouteActive =
                    isActive ||
                    (item.path === "/agents" &&
                      location.pathname.startsWith("/agent/")) ||
                    (item.path === "/organizations" &&
                      location.pathname.startsWith("/organization/"));

                  return [
                    "whitespace-nowrap rounded-full px-3 py-2 font-ae-label text-[11px] font-semibold uppercase tracking-[0.08em] transition xl:px-4 xl:text-xs",
                    isRouteActive
                      ? "bg-ae-primary text-ae-primary-ink shadow-ae-glow"
                      : "text-ae-text-muted hover:bg-white/[0.06] hover:text-ae-text",
                  ].join(" ");
                }
              }
              end={item.path === "/"}
              key={item.path}
              to={item.path}
            >
              {item.label}
            </NavLink>
          ))}
        </div>

        <NavLink
          className={({ isActive }) =>
            [
              "hidden rounded-full border px-4 py-2 font-ae-label text-xs font-semibold uppercase tracking-[0.08em] transition sm:inline-flex",
              isActive
                ? "border-ae-primary/40 bg-ae-primary/15 text-ae-primary shadow-ae-glow"
                : "border-ae-cyan/30 bg-ae-cyan/10 text-ae-cyan hover:border-ae-primary/40 hover:text-ae-primary",
            ].join(" ")
          }
          to={isAuthenticated ? "/account" : "/sign-in"}
        >
          {isAuthenticated ? "Account" : "Sign In"}
        </NavLink>
      </nav>
    </header>
  );
}
