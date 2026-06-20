import type { AccentTone } from "../data/marketplace";

export const accentStyles: Record<
  AccentTone,
  {
    badge: string;
    border: string;
    dot: string;
    glow: string;
    text: string;
  }
> = {
  amber: {
    badge: "border-ae-amber/20 bg-ae-amber/10 text-ae-amber",
    border: "border-ae-amber/20",
    dot: "bg-ae-amber",
    glow: "shadow-[0_0_36px_rgb(251_191_36_/_0.12)]",
    text: "text-ae-amber",
  },
  cyan: {
    badge: "border-ae-cyan/20 bg-ae-cyan/10 text-ae-cyan",
    border: "border-ae-cyan/20",
    dot: "bg-ae-cyan",
    glow: "shadow-[0_0_36px_rgb(103_232_249_/_0.12)]",
    text: "text-ae-cyan",
  },
  emerald: {
    badge: "border-ae-emerald/20 bg-ae-emerald/10 text-ae-emerald",
    border: "border-ae-emerald/20",
    dot: "bg-ae-emerald",
    glow: "shadow-[0_0_36px_rgb(52_211_153_/_0.12)]",
    text: "text-ae-emerald",
  },
  violet: {
    badge: "border-ae-primary/20 bg-ae-primary/10 text-ae-primary",
    border: "border-ae-primary/20",
    dot: "bg-ae-primary",
    glow: "shadow-ae-glow",
    text: "text-ae-primary",
  },
};
