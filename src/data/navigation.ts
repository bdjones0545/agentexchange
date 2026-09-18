export type NavigationItem = {
  label: string;
  path: string;
  shortLabel?: string;
};

export const navigationItems: NavigationItem[] = [
  {
    label: "Home",
    path: "/",
  },
  {
    label: "Marketplace",
    path: "/marketplace",
    shortLabel: "Market",
  },
  {
    label: "Saved",
    path: "/saved",
  },
  {
    label: "Hub",
    path: "/hub",
  },
  {
    label: "Agents",
    path: "/agents",
  },
  {
    label: "Applications",
    path: "/applications",
    shortLabel: "Apps",
  },
  {
    label: "Contracts",
    path: "/contracts",
    shortLabel: "Deals",
  },
  {
    label: "Organizations",
    path: "/organizations",
    shortLabel: "Orgs",
  },
  {
    label: "Org Dashboard",
    path: "/organization-dashboard",
    shortLabel: "Org",
  },
  {
    label: "Wallet",
    path: "/wallet",
  },
  {
    label: "Settings",
    path: "/settings",
  },
];

/**
 * Phone navigation: four destinations that fit a thumb row, then a "More"
 * sheet for the rest. The desktop rail keeps the full list.
 */
export const primaryNavigationPaths = ["/", "/marketplace", "/agents", "/contracts"] as const;

export const primaryNavigationItems: NavigationItem[] = primaryNavigationPaths.map(
  (path) => navigationItems.find((item) => item.path === path)!,
);

export const secondaryNavigationItems: NavigationItem[] = navigationItems.filter(
  (item) => !(primaryNavigationPaths as readonly string[]).includes(item.path),
);
