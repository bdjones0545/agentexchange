import { useEffect, useState, type ReactNode } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";

import {
  primaryNavigationItems,
  secondaryNavigationItems,
  type NavigationItem,
} from "../data/navigation";
import { useAuth } from "../state/AuthContext";

/** Small, distinct glyphs: letters were ambiguous (Home/Hub, Agents/Apps, Orgs/Org). */
const ICONS: Record<string, ReactNode> = {
  "/": <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />,
  "/marketplace": <path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z" />,
  "/agents": <path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4zm-7 8a7 7 0 0 1 14 0z" />,
  "/contracts": <path d="M6 3h8l4 4v14H6zM14 3v4h4M9 12h6M9 16h6" />,
  more: <path d="M5 12h.01M12 12h.01M19 12h.01" />,
};

function Icon({ path }: { path: string }) {
  return (
    <svg aria-hidden className="size-5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24">
      {ICONS[path]}
    </svg>
  );
}

function isItemActive(item: NavigationItem, pathname: string) {
  if (item.path === "/") return pathname === "/";
  if (item.path === "/agents") return pathname.startsWith("/agents") || pathname.startsWith("/agent/");
  if (item.path === "/organizations") return pathname === "/organizations" || pathname.startsWith("/organization/");
  return pathname === item.path || pathname.startsWith(`${item.path}/`);
}

const tabClass = (active: boolean) =>
  [
    "flex min-h-14 flex-1 flex-col items-center justify-center gap-1 rounded-ae-md px-1 py-2 text-center transition",
    active ? "bg-ae-primary/15 text-ae-primary shadow-ae-glow" : "text-ae-text-muted hover:bg-white/[0.05] hover:text-ae-text",
  ].join(" ");

export function BottomNavigation() {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [moreOpen, setMoreOpen] = useState(false);

  // Navigating closes the sheet; so does Escape.
  useEffect(() => {
    setMoreOpen(false);
  }, [location.pathname]);
  useEffect(() => {
    if (!moreOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMoreOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [moreOpen]);

  const accountItem: NavigationItem = isAuthenticated
    ? { label: "Account", path: "/account" }
    : { label: "Sign in", path: "/sign-in" };
  const sheetItems = [...secondaryNavigationItems, accountItem];
  const moreActive = sheetItems.some((item) => isItemActive(item, location.pathname));

  return (
    <>
      {moreOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden" role="presentation">
          <button
            aria-label="Close menu"
            className="absolute inset-0 bg-black/50"
            onClick={() => setMoreOpen(false)}
            type="button"
          />
          <div
            aria-label="More destinations"
            className="absolute inset-x-0 bottom-0 rounded-t-ae-xl border-t border-white/[0.08] bg-ae-surface p-4 pb-28 shadow-ae-glow"
            role="dialog"
          >
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/20" />
            <ul className="grid grid-cols-2 gap-2">
              {sheetItems.map((item) => {
                const active = isItemActive(item, location.pathname);
                return (
                  <li key={item.path}>
                    <button
                      className={[
                        "w-full rounded-ae-md border px-4 py-3 text-left font-ae-label text-sm font-semibold transition",
                        active
                          ? "border-ae-primary/30 bg-ae-primary/15 text-ae-primary"
                          : "border-white/[0.06] bg-white/[0.04] text-ae-text hover:bg-white/[0.08]",
                      ].join(" ")}
                      onClick={() => navigate(item.path)}
                      type="button"
                    >
                      {item.label}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      ) : null}

      <nav
        aria-label="Bottom navigation"
        className="fixed inset-x-0 bottom-0 z-50 border-t border-white/[0.08] bg-ae-surface/90 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur-2xl lg:hidden"
      >
        <div className="mx-auto flex max-w-md gap-1 rounded-ae-xl border border-white/[0.06] bg-white/[0.03] p-1">
          {primaryNavigationItems.map((item) => (
            <NavLink
              className={() => tabClass(isItemActive(item, location.pathname))}
              end={item.path === "/"}
              key={item.path}
              to={item.path}
            >
              <Icon path={item.path} />
              <span className="font-ae-label text-xs font-semibold tracking-[0.04em]">
                {item.shortLabel ?? item.label}
              </span>
            </NavLink>
          ))}
          <button
            aria-expanded={moreOpen}
            className={tabClass(moreActive || moreOpen)}
            onClick={() => setMoreOpen((open) => !open)}
            type="button"
          >
            <Icon path="more" />
            <span className="font-ae-label text-xs font-semibold tracking-[0.04em]">More</span>
          </button>
        </div>
      </nav>
    </>
  );
}
