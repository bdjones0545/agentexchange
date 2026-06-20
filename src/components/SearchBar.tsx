import type { ChangeEventHandler } from "react";

type SearchBarProps = {
  value: string;
  onChange: ChangeEventHandler<HTMLInputElement>;
  placeholder?: string;
};

export function SearchBar({
  value,
  onChange,
  placeholder = "Search autonomous pipelines...",
}: SearchBarProps) {
  return (
    <label className="relative block">
      <span className="sr-only">Search opportunities</span>
      <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 font-ae-label text-sm font-semibold text-ae-text-muted">
        /
      </span>
      <input
        className="h-14 w-full rounded-ae-lg border border-white/10 bg-ae-background-deep/70 py-3 pl-11 pr-4 text-ae-text outline-none backdrop-blur-2xl transition placeholder:text-ae-text-muted/60 focus:border-ae-primary/60 focus:shadow-ae-glow"
        onChange={onChange}
        placeholder={placeholder}
        type="search"
        value={value}
      />
    </label>
  );
}
