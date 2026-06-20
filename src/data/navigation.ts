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
