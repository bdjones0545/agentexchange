// A small, dependency-free markdown parser for the subset agents and people
// actually write in a contract thread: headings, paragraphs, bold/italic/code,
// fenced code, ordered/unordered lists, GFM tables, blockquotes, rules and
// http(s) links. It produces a tree, never HTML, so rendering it with React
// cannot inject markup: every string becomes a text node.

export type Inline =
  | { type: "text"; text: string }
  | { type: "strong"; children: Inline[] }
  | { type: "em"; children: Inline[] }
  | { type: "code"; text: string }
  | { type: "link"; href: string; children: Inline[] };

export type Block =
  | { type: "heading"; level: 1 | 2 | 3 | 4 | 5 | 6; children: Inline[] }
  | { type: "paragraph"; children: Inline[] }
  | { type: "code"; text: string; lang?: string }
  | { type: "list"; ordered: boolean; items: Inline[][] }
  | { type: "table"; header: Inline[][]; rows: Inline[][][] }
  | { type: "quote"; children: Inline[] }
  | { type: "rule" };

const SAFE_HREF = /^https?:\/\/[^\s<>"')]+$/i;

/** Inline markup: `code`, **strong**, *em* / _em_, [text](https://…). */
export function parseInline(source: string): Inline[] {
  const out: Inline[] = [];
  let text = "";
  const flush = () => {
    if (text) {
      out.push({ type: "text", text });
      text = "";
    }
  };
  let i = 0;
  while (i < source.length) {
    const rest = source.slice(i);
    const code = /^`([^`]+)`/.exec(rest);
    if (code) {
      flush();
      out.push({ type: "code", text: code[1] });
      i += code[0].length;
      continue;
    }
    const strong = /^\*\*(.+?)\*\*/.exec(rest) ?? /^__(.+?)__/.exec(rest);
    if (strong) {
      flush();
      out.push({ type: "strong", children: parseInline(strong[1]) });
      i += strong[0].length;
      continue;
    }
    const em = /^\*([^*\n]+?)\*/.exec(rest) ?? /^_([^_\n]+?)_(?![A-Za-z0-9])/.exec(rest);
    if (em && !rest.startsWith("**")) {
      flush();
      out.push({ type: "em", children: parseInline(em[1]) });
      i += em[0].length;
      continue;
    }
    const link = /^\[([^\]]+)\]\(([^)\s]+)\)/.exec(rest);
    if (link) {
      flush();
      if (SAFE_HREF.test(link[2])) {
        out.push({ type: "link", href: link[2], children: parseInline(link[1]) });
      } else {
        // Unsafe scheme (javascript:, data:, relative): keep the words, drop the link.
        out.push(...parseInline(link[1]));
      }
      i += link[0].length;
      continue;
    }
    text += source[i];
    i += 1;
  }
  flush();
  return out;
}

function splitTableRow(line: string): string[] {
  const trimmed = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  return trimmed.split("|").map((cell) => cell.trim());
}

const TABLE_DIVIDER = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/;

export function parseMarkdown(source: string): Block[] {
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  const blocks: Block[] = [];
  let i = 0;
  const paragraph: string[] = [];
  const flushParagraph = () => {
    if (paragraph.length) {
      blocks.push({ type: "paragraph", children: parseInline(paragraph.join(" ").trim()) });
      paragraph.length = 0;
    }
  };

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      flushParagraph();
      i += 1;
      continue;
    }

    const fence = /^```\s*([A-Za-z0-9_-]*)\s*$/.exec(trimmed);
    if (fence) {
      flushParagraph();
      const body: string[] = [];
      i += 1;
      while (i < lines.length && !/^```\s*$/.test(lines[i].trim())) {
        body.push(lines[i]);
        i += 1;
      }
      i += 1; // closing fence (or end of input)
      blocks.push({ type: "code", text: body.join("\n"), ...(fence[1] ? { lang: fence[1] } : {}) });
      continue;
    }

    const heading = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(trimmed);
    if (heading) {
      flushParagraph();
      blocks.push({ type: "heading", level: heading[1].length as Block extends { level: infer L } ? L : never, children: parseInline(heading[2]) });
      i += 1;
      continue;
    }

    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      flushParagraph();
      blocks.push({ type: "rule" });
      i += 1;
      continue;
    }

    if (trimmed.startsWith(">")) {
      flushParagraph();
      const quote: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith(">")) {
        quote.push(lines[i].trim().replace(/^>\s?/, ""));
        i += 1;
      }
      blocks.push({ type: "quote", children: parseInline(quote.join(" ")) });
      continue;
    }

    if (trimmed.includes("|") && i + 1 < lines.length && TABLE_DIVIDER.test(lines[i + 1])) {
      flushParagraph();
      const header = splitTableRow(trimmed).map(parseInline);
      i += 2;
      const rows: Inline[][][] = [];
      while (i < lines.length && lines[i].trim().includes("|")) {
        rows.push(splitTableRow(lines[i]).map(parseInline));
        i += 1;
      }
      blocks.push({ type: "table", header, rows });
      continue;
    }

    const bullet = /^([-*+]|\d+[.)])\s+(.*)$/.exec(trimmed);
    if (bullet) {
      flushParagraph();
      const ordered = /^\d/.test(bullet[1]);
      const items: Inline[][] = [];
      while (i < lines.length) {
        const m = /^([-*+]|\d+[.)])\s+(.*)$/.exec(lines[i].trim());
        if (!m || /^\d/.test(m[1]) !== ordered) break;
        let item = m[2];
        i += 1;
        // Continuation lines (indented, not a new bullet) belong to the item.
        while (i < lines.length && /^\s+\S/.test(lines[i]) && !/^\s*([-*+]|\d+[.)])\s+/.test(lines[i])) {
          item += " " + lines[i].trim();
          i += 1;
        }
        items.push(parseInline(item));
      }
      blocks.push({ type: "list", ordered, items });
      continue;
    }

    paragraph.push(trimmed);
    i += 1;
  }
  flushParagraph();
  return blocks;
}

/** Plain text of a markdown document, for previews and length checks. */
export function markdownToText(source: string): string {
  const walk = (nodes: Inline[]): string =>
    nodes.map((n) => (n.type === "text" || n.type === "code" ? n.text : walk(n.children))).join("");
  return parseMarkdown(source)
    .map((b) => {
      switch (b.type) {
        case "code":
          return b.text;
        case "rule":
          return "";
        case "list":
          return b.items.map(walk).join("\n");
        case "table":
          return [b.header, ...b.rows].map((r) => r.map(walk).join(" | ")).join("\n");
        default:
          return walk(b.children);
      }
    })
    .join("\n")
    .trim();
}
