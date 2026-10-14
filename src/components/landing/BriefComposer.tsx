import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { usePrefersReducedMotion } from "./motion";

const EXAMPLES = [
  "A competitive scan of five rivals’ pricing",
  "Landing page copy for our new product",
  "A script that cleans up our CRM export",
  "A 30-day onboarding playbook",
  "A market sizing memo for the board",
];

const STARTERS = ["Research memo", "Copy pack", "Code & scripts", "Strategy doc"];

/** Hero brief box: what the visitor types is carried into the post-a-brief form. */
export function BriefComposer() {
  const navigate = useNavigate();
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const reduced = usePrefersReducedMotion();
  const [value, setValue] = useState("");
  const [focused, setFocused] = useState(false);
  const [placeholder, setPlaceholder] = useState("Describe the work you need done…");

  // Types example briefs into the placeholder while the box is empty and idle.
  useEffect(() => {
    if (reduced || focused || value) return;
    let example = 0;
    let length = 0;
    let deleting = false;
    let timer = 0;
    const tick = () => {
      const text = EXAMPLES[example];
      length += deleting ? -1 : 1;
      setPlaceholder(text.slice(0, length) || " ");
      let wait = deleting ? 22 : 48;
      if (!deleting && length === text.length) { deleting = true; wait = 1800; }
      else if (deleting && length === 0) { deleting = false; example = (example + 1) % EXAMPLES.length; wait = 350; }
      timer = window.setTimeout(tick, wait);
    };
    timer = window.setTimeout(tick, 900);
    return () => window.clearTimeout(timer);
  }, [reduced, focused, value]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = value.trim().slice(0, 160);
    navigate(title ? `/post-opportunity?title=${encodeURIComponent(title)}` : "/post-opportunity");
  }

  return <div className="space-y-3">
    <form onSubmit={submit} className="group relative">
      <div aria-hidden className="absolute -inset-px rounded-2xl bg-gradient-to-r from-ae-primary/50 via-ae-cyan/40 to-ae-primary/50 opacity-40 blur-sm transition duration-500 group-focus-within:opacity-90" />
      <div className="relative flex flex-col gap-2 rounded-2xl border border-white/10 bg-ae-background-deep/90 p-2 sm:flex-row sm:items-center">
        <label htmlFor={inputId} className="sr-only">Describe the work you need done</label>
        <span aria-hidden className="hidden pl-3 text-ae-primary sm:block">
          <svg viewBox="0 0 20 20" className="size-5"><path d="M4 5.5h12M4 10h8M4 14.5h5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
        </span>
        <input
          ref={inputRef}
          id={inputId}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={focused ? "Describe the work you need done…" : placeholder}
          maxLength={160}
          autoComplete="off"
          className="min-w-0 flex-1 bg-transparent px-3 py-3 text-base text-ae-text outline-none placeholder:text-ae-text-muted/80"
        />
        <button type="submit" className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-ae-primary px-5 py-3 font-ae-label text-sm font-semibold text-ae-primary-ink transition hover:-translate-y-0.5 hover:shadow-[0_10px_30px_-8px_rgb(120_240_188_/_0.6)] focus-visible:outline-offset-2">
          Post a brief — free <span aria-hidden>→</span>
        </button>
      </div>
    </form>
    <div className="flex flex-wrap items-center gap-2 text-xs text-ae-text-muted">
      <span>Try:</span>
      {STARTERS.map((starter) => <button key={starter} type="button" onClick={() => { setValue(`${starter}: `); inputRef.current?.focus(); }} className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 transition hover:border-ae-primary/40 hover:text-ae-primary">{starter}</button>)}
    </div>
  </div>;
}
