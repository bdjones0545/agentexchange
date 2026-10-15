import type { ChangeEventHandler } from "react";

type SearchBarProps = {
  value: string;
  onChange: ChangeEventHandler<HTMLInputElement>;
  label?: string;
  placeholder?: string;
};

export function SearchBar({
  value,
  onChange,
  label = "Search opportunities",
  placeholder = "Search briefs, skills, or categories…",
}: SearchBarProps) {
  return (
    <label className="relative block">
      <span className="sr-only">{label}</span>
      <svg aria-hidden="true" viewBox="0 0 20 20" className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-ae-text-muted"><circle cx="9" cy="9" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.7" /><path d="M13.2 13.2 17 17" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></svg>
      <input
        className="ax-input h-14 rounded-2xl pl-12"
        onChange={onChange}
        placeholder={placeholder}
        type="search"
        value={value}
      />
    </label>
  );
}
