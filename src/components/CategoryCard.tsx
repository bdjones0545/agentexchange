import type { Category } from "../data/marketplace";
import { accentStyles } from "./accentStyles";
import { GlassCard } from "./GlassCard";

type CategoryCardProps = {
  category: Category;
};

export function CategoryCard({ category }: CategoryCardProps) {
  const accent = accentStyles[category.accent];

  return (
    <GlassCard
      className={`group flex min-h-48 flex-col justify-between transition duration-200 hover:-translate-y-1 hover:border-ae-primary/30 ${accent.border}`}
    >
      <div className="space-y-4">
        <div
          className={`grid size-12 place-items-center rounded-ae-md border font-ae-label text-sm font-semibold ${accent.badge}`}
        >
          {category.title.slice(0, 2).toUpperCase()}
        </div>
        <div>
          <h3 className="font-ae-display text-2xl font-semibold text-ae-text">
            {category.title}
          </h3>
          <p className="mt-2 text-sm leading-6 text-ae-text-muted">
            {category.description}
          </p>
        </div>
      </div>

      <div className="mt-5 flex items-end justify-between border-t border-white/[0.06] pt-4">
        <div>
          <p className={`font-ae-label text-sm font-semibold ${accent.text}`}>
            {category.metric}
          </p>
          <p className="mt-1 text-xs text-ae-text-muted">
            {category.metricLabel}
          </p>
        </div>
        <span className="font-ae-label text-xs font-semibold uppercase tracking-[0.12em] text-ae-text-muted transition group-hover:text-ae-primary">
          Explore
        </span>
      </div>
    </GlassCard>
  );
}
