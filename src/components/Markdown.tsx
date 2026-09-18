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
          <code className="rounded bg-white/[0.08] px-1 py-0.5 font-mono text-[0.9em] text-ae-text" key={key}>
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
          <a className="text-ae-primary underline decoration-ae-primary/40 underline-offset-2" href={node.href} key={key} rel="noopener noreferrer nofollow" target="_blank">
            {renderInline(node.children, key)}
          </a>
        );
    }
  });
}

const HEADING_CLASS: Record<number, string> = {
  1: "font-ae-display text-xl font-semibold text-ae-text",
  2: "font-ae-display text-lg font-semibold text-ae-text",
  3: "font-ae-display text-base font-semibold text-ae-text",
  4: "text-sm font-semibold uppercase tracking-[0.08em] text-ae-text",
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
        <p className="text-sm leading-6 text-ae-text-muted" key={key}>
          {renderInline(block.children, key)}
        </p>
      );
    case "code":
      return (
        <pre className="overflow-x-auto rounded-ae-md border border-white/[0.06] bg-black/30 p-3 font-mono text-xs leading-5 text-ae-text" key={key}>
          <code>{block.text}</code>
        </pre>
      );
    case "list": {
      const Tag = block.ordered ? "ol" : "ul";
      return (
        <Tag className={`space-y-1 pl-5 text-sm leading-6 text-ae-text-muted ${block.ordered ? "list-decimal" : "list-disc"}`} key={key}>
          {block.items.map((item, itemIndex) => (
            <li key={`${key}-${itemIndex}`}>{renderInline(item, `${key}-${itemIndex}`)}</li>
          ))}
        </Tag>
      );
    }
    case "table":
      return (
        <div className="-mx-1 overflow-x-auto" key={key}>
          <table className="min-w-full border-collapse text-left text-sm">
            <thead>
              <tr>
                {block.header.map((cell, cellIndex) => (
                  <th className="border-b border-white/[0.1] px-2 py-2 align-top font-semibold text-ae-text" key={`${key}-h-${cellIndex}`}>
                    {renderInline(cell, `${key}-h-${cellIndex}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, rowIndex) => (
                <tr key={`${key}-r-${rowIndex}`}>
                  {row.map((cell, cellIndex) => (
                    <td className="border-b border-white/[0.06] px-2 py-2 align-top leading-6 text-ae-text-muted" key={`${key}-r-${rowIndex}-${cellIndex}`}>
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
        <blockquote className="border-l-2 border-ae-primary/40 pl-3 text-sm italic leading-6 text-ae-text-muted" key={key}>
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
  const shown = foldable && !expanded ? source.slice(0, collapseAfter) : source;
  const blocks = parseMarkdown(shown);

  return (
    <div className={`space-y-3 ${className}`}>
      {blocks.map(renderBlock)}
      {foldable ? (
        <button
          className="font-ae-label text-xs font-semibold uppercase tracking-[0.12em] text-ae-primary transition hover:text-ae-text"
          onClick={() => setExpanded((value) => !value)}
          type="button"
        >
          {expanded ? "Show less" : `Read the full text (${Math.round(source.length / 1000)}k characters)`}
        </button>
      ) : null}
    </div>
  );
}
