import { useState, type ReactNode } from "react";

import { parseMarkdown, type Block, type Inline } from "../lib/markdown";

function renderInline(nodes: Inline[], keyPrefix = "i"): ReactNode[] {
  return nodes.map((node, index) => {
    const key = `${keyPrefix}-${index}`;
    switch (node.type) {
      case "text":
        return node.text;
      case "code":
        return (
          <code className="rounded-md border border-white/[0.06] bg-white/[0.06] px-1.5 py-0.5 font-mono text-[0.85em] text-ae-text" key={key}>
            {node.text}
          </code>
        );
      case "strong":
        return (
          <strong className="font-semibold text-ae-text" key={key}>
            {renderInline(node.children, key)}
          </strong>
        );
      case "em":
        return <em key={key}>{renderInline(node.children, key)}</em>;
      case "link":
        return (
          <a className="break-words text-ae-primary underline decoration-ae-primary/40 underline-offset-2 transition hover:decoration-ae-primary" href={node.href} key={key} rel="noopener noreferrer nofollow" target="_blank">
            {renderInline(node.children, key)}
          </a>
        );
    }
  });
}

const HEADING_CLASS: Record<number, string> = {
  1: "pt-2 font-ae-display text-xl font-semibold tracking-tight text-ae-text first:pt-0",
  2: "pt-2 font-ae-display text-lg font-semibold tracking-tight text-ae-text first:pt-0",
  3: "pt-1 font-ae-display text-base font-semibold text-ae-text first:pt-0",
  4: "pt-1 font-ae-label text-xs font-semibold uppercase tracking-[0.12em] text-ae-text first:pt-0",
  5: "text-sm font-semibold text-ae-text",
  6: "text-sm font-semibold text-ae-text-muted",
};

function renderBlock(block: Block, index: number): ReactNode {
  const key = `b-${index}`;
  switch (block.type) {
    case "heading": {
      const Tag = `h${Math.min(6, block.level + 2)}` as "h3" | "h4" | "h5" | "h6";
      return (
        <Tag className={HEADING_CLASS[block.level]} key={key}>
          {renderInline(block.children, key)}
        </Tag>
      );
    }
    case "paragraph":
      return (
        <p className="break-words text-sm leading-7 text-ae-text/85" key={key}>
          {renderInline(block.children, key)}
        </p>
      );
    case "code":
      return (
        <pre className="overflow-x-auto rounded-xl border border-white/[0.08] bg-ae-background-deep/90 p-4 font-mono text-xs leading-5 text-ae-text" key={key}>
          <code>{block.text}</code>
        </pre>
      );
    case "list": {
      const Tag = block.ordered ? "ol" : "ul";
      return (
        <Tag className={`space-y-1.5 pl-5 text-sm leading-7 text-ae-text/85 marker:text-ae-primary/70 ${block.ordered ? "list-decimal" : "list-disc"}`} key={key}>
          {block.items.map((item, itemIndex) => (
            <li className="break-words pl-1" key={`${key}-${itemIndex}`}>{renderInline(item, `${key}-${itemIndex}`)}</li>
          ))}
        </Tag>
      );
    }
    case "table":
      return (
        <div className="overflow-x-auto rounded-xl border border-white/[0.08]" key={key}>
          <table className="min-w-full border-collapse text-left text-sm">
            <thead className="bg-white/[0.04]">
              <tr>
                {block.header.map((cell, cellIndex) => (
                  <th className="border-b border-white/[0.08] px-3 py-2.5 align-top font-ae-label text-xs font-semibold uppercase tracking-[0.08em] text-ae-text" key={`${key}-h-${cellIndex}`}>
                    {renderInline(cell, `${key}-h-${cellIndex}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06]">
              {block.rows.map((row, rowIndex) => (
                <tr className="transition hover:bg-white/[0.02]" key={`${key}-r-${rowIndex}`}>
                  {row.map((cell, cellIndex) => (
                    <td className="px-3 py-2.5 align-top leading-6 text-ae-text/80" key={`${key}-r-${rowIndex}-${cellIndex}`}>
                      {renderInline(cell, `${key}-r-${rowIndex}-${cellIndex}`)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case "quote":
      return (
        <blockquote className="rounded-r-xl border-l-2 border-ae-primary/50 bg-ae-primary/[0.04] py-2 pl-4 pr-3 text-sm italic leading-7 text-ae-text-muted" key={key}>
          {renderInline(block.children, key)}
        </blockquote>
      );
    case "rule":
      return <hr className="border-white/[0.08]" key={key} />;
  }
}

type MarkdownProps = {
  source: string;
  /**
   * Characters shown before the content is folded behind "Read more".
   * Omit to never fold. Folding is by source length, so a long memo on a
   * phone opens as a short preview instead of a five-screen scroll.
   */
  collapseAfter?: number;
  className?: string;
};

/** Renders markdown as React elements. No HTML is ever injected. */
export function Markdown({ source, collapseAfter, className = "" }: MarkdownProps) {
  const [expanded, setExpanded] = useState(false);
  const foldable = typeof collapseAfter === "number" && source.length > collapseAfter;
  const folded = foldable && !expanded;
  const shown = folded ? source.slice(0, collapseAfter) : source;
  const blocks = parseMarkdown(shown);

  return (
    <div className={`min-w-0 space-y-3 ${className}`}>
      <div className={`space-y-3 ${folded ? "[mask-image:linear-gradient(to_bottom,#000_65%,transparent)]" : ""}`}>
        {blocks.map(renderBlock)}
      </div>
      {foldable ? (
        <button
          className="inline-flex items-center gap-1.5 rounded-lg border border-ae-primary/25 bg-ae-primary/[0.06] px-3 py-1.5 font-ae-label text-xs font-semibold uppercase tracking-[0.12em] text-ae-primary transition hover:border-ae-primary/50 hover:bg-ae-primary/10"
          onClick={() => setExpanded((value) => !value)}
          type="button"
        >
          {expanded ? "Show less" : `Read the full text (${Math.round(source.length / 1000)}k characters)`}
          <svg aria-hidden className={`size-3.5 transition ${expanded ? "rotate-180" : ""}`} viewBox="0 0 16 16">
            <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
          </svg>
        </button>
      ) : null}
    </div>
  );
}
