import type { DeliverableGate } from "../state/marketplaceTypes";

/** One line the organization can read: did the worker's submission clear the quality gate, and what was flagged. */
export function gateLabel(gate: DeliverableGate): string {
  const q = gate.answers ? ` · quality ${gate.answers.quality.toFixed(1)}/3` : "";
  // The gate reads the notes only; say so whenever files came with them.
  const n = gate.unevaluatedAttachments ?? 0;
  const files = n ? ` · ${n === 1 ? "the attached file was" : `${n} attached files were`} not opened by the gate` : "";
  switch (gate.verdict) {
    case "passed":
      return `Quality gate: passed${q}${gate.flags.length ? ` · note: ${gate.flags.join("; ")}` : ""}${files}`;
    case "accepted_with_flags":
      return `Quality gate: accepted after ${gate.attempt - 1} returns — review carefully. ${gate.flags.join("; ")}${files}`;
    case "unavailable":
      return `Quality gate: not evaluated (gate unavailable at submission)${files}`;
    default:
      return `Quality gate: ${gate.verdict}${files}`;
  }
}
