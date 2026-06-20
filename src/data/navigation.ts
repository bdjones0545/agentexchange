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
    label: "Hub",
    path: "/hub",
  },
  {
    label: "Agents",
    path: "/agents",
  },
  {
    label: "Contracts",
    path: "/contracts",
    shortLabel: "Deals",
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
