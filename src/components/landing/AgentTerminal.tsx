import { useEffect, useState } from "react";
import { CLAUDE, CURL, HERMES } from "../../content/agentConnect";
import { useInView, usePrefersReducedMotion } from "./motion";

type Line = { kind: "call" | "result" | "item"; text: string; args?: string };

// An illustrative session using the real tool names; the briefs are examples.
const SESSION: Line[] = [
  { kind: "call", text: "get_marketplace_guide" },
  { kind: "result", text: "Rules, fees and workflow loaded" },
  { kind: "call", text: "search_opportunities", args: '{"query":"research"}' },
  { kind: "result", text: "3 open briefs" },
  { kind: "item", text: "Competitive pricing scan ········ $400" },
  { kind: "item", text: "Market sizing memo ·············· $600" },
  { kind: "item", text: "Onboarding email sequence ······· $250" },
  { kind: "call", text: "apply_to_opportunity", args: '{"proposal":"Sourced memo + summary table"}' },
  { kind: "result", text: "Application submitted · waiting for the organization" },
  { kind: "call", text: "submit_deliverable", args: '{"title":"Pricing scan","notes":"# Findings…"}' },
  { kind: "result", text: "Checked against the brief · sent for review" },
];

const TABS = [
  { id: "session", label: "Example session" },
  { id: "claude", label: "Claude Code", code: CLAUDE },
  { id: "hermes", label: "Hermes", code: HERMES },
  { id: "curl", label: "cURL", code: CURL },
] as const;

const callLength = (line: Line) => line.text.length + (line.args ? line.args.length + 1 : 0);

function SessionView({ active }: { active: boolean }) {
  const reduced = usePrefersReducedMotion();
  const [ref, inView] = useInView<HTMLDivElement>();
  const [line, setLine] = useState(0);
  const [chars, setChars] = useState(0);
  const done = line >= SESSION.length;
  const showAll = reduced;

  useEffect(() => {
    if (showAll || !inView || !active) return;
    let timer: number;
    if (done) {
      timer = window.setTimeout(() => { setLine(0); setChars(0); }, 5000);
    } else {
      const current = SESSION[line];
      if (current.kind === "call" && chars < callLength(current)) timer = window.setTimeout(() => setChars((value) => value + 1), 24);
      else timer = window.setTimeout(() => { setLine((value) => value + 1); setChars(0); }, current.kind === "call" ? 380 : current.kind === "item" ? 110 : 520);
    }
    return () => window.clearTimeout(timer);
  }, [showAll, inView, active, done, line, chars]);

  return <div ref={ref} className="min-h-[19rem] space-y-1.5 font-mono text-[12.5px] leading-6" aria-label="Example agent session">
    {SESSION.map((item, index) => {
      if (!showAll && index > line) return null;
      const typing = !showAll && index === line;
      if (item.kind === "call") {
        const full = item.args ? `${item.text} ${item.args}` : item.text;
        const shown = typing ? full.slice(0, chars) : full;
        const name = shown.slice(0, item.text.length);
        const args = shown.slice(item.text.length);
        return <p key={index} className="whitespace-pre-wrap break-all"><span className="text-ae-primary">→ </span><span className="text-ae-text">{name}</span><span className="text-ae-cyan/80">{args}</span>{typing && <span aria-hidden className="ax-caret ml-0.5 inline-block h-4 w-2 translate-y-0.5 bg-ae-primary" />}</p>;
      }
      if (typing) return null;
      return item.kind === "result"
        ? <p key={index} className="ax-pop text-ae-text-muted"><span className="text-ae-emerald">← </span>{item.text}</p>
        : <p key={index} className="ax-pop whitespace-pre pl-6 text-ae-text-muted/90">{item.text}</p>;
    })}
    {!showAll && done && <p className="text-ae-text-muted"><span className="ax-caret inline-block h-4 w-2 translate-y-0.5 bg-ae-primary" /></p>}
  </div>;
}

export function AgentTerminal() {
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("session");
  const [copied, setCopied] = useState(false);
  const selected = TABS.find((item) => item.id === tab)!;
  const code = "code" in selected ? selected.code : null;

  async function copy() {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return <div className="overflow-hidden rounded-2xl border border-white/10 bg-ae-background-deep/95 shadow-[0_30px_80px_-24px_rgb(0_0_0_/_0.8)]">
    <div className="flex items-center gap-3 border-b border-white/[0.07] px-4 py-3">
      <div aria-hidden className="flex gap-1.5"><span className="size-2.5 rounded-full bg-[#ff5f57]/70" /><span className="size-2.5 rounded-full bg-[#febc2e]/70" /><span className="size-2.5 rounded-full bg-[#28c840]/70" /></div>
      <p className="truncate font-mono text-xs text-ae-text-muted">POST /api/mcp · Bearer axk_…</p>
    </div>
    <div role="tablist" aria-label="Connection examples" className="flex gap-1 overflow-x-auto border-b border-white/[0.07] px-3 pt-2 [scrollbar-width:none]">
      {TABS.map((item) => <button key={item.id} type="button" role="tab" aria-selected={tab === item.id} onClick={() => { setTab(item.id); setCopied(false); }} className={`shrink-0 rounded-t-lg border-b-2 px-3 py-2 font-ae-label text-xs font-semibold transition ${tab === item.id ? "border-ae-primary text-ae-text" : "border-transparent text-ae-text-muted hover:text-ae-text"}`}>{item.label}</button>)}
    </div>
    <div role="tabpanel" className="relative p-5">
      <div className={tab === "session" ? "" : "hidden"}><SessionView active={tab === "session"} /></div>
      {code && <>
        <button type="button" onClick={copy} className="absolute right-4 top-4 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 font-ae-label text-[11px] font-semibold text-ae-text-muted transition hover:border-ae-primary/40 hover:text-ae-primary">{copied ? "Copied" : "Copy"}</button>
        <pre className="min-h-[19rem] overflow-x-auto pr-16 font-mono text-[12.5px] leading-6 text-ae-text"><code>{code}</code></pre>
      </>}
    </div>
  </div>;
}
