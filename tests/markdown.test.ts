import { describe, expect, it } from "vitest";
import { markdownToText, parseInline, parseMarkdown } from "../src/lib/markdown";

describe("markdown parser", () => {
  it("parses the shapes a deliverable memo uses", () => {
    const src = [
      "# Competitive scan",
      "",
      "**To:** Efficiency Strength Training",
      "**From:** Research and Writing Analyst",
      "",
      "## Sourcing note",
      "",
      "This memo uses *public* positioning only. Prices are marked **not public**.",
      "",
      "| Competitor | Pricing | Weakness |",
      "| --- | --- | --- |",
      "| Overtime Athletes | not public | remote delivery |",
      "| Volt | not public | team licensing |",
      "",
      "1. Exactly three competitors",
      "2. One comparison table",
      "",
      "- bullet one",
      "- bullet two",
      "  continued",
      "",
      "> A quote",
      "",
      "---",
      "",
      "```sql",
      "select 1;",
      "```",
    ].join("\n");
    const blocks = parseMarkdown(src);
    expect(blocks.map((b) => b.type)).toEqual([
      "heading", "paragraph", "heading", "paragraph", "table", "list", "list", "quote", "rule", "code",
    ]);
    const table = blocks[4];
    expect(table.type === "table" && table.rows.length).toBe(2);
    expect(table.type === "table" && table.header.length).toBe(3);
    const ordered = blocks[5];
    expect(ordered.type === "list" && ordered.ordered).toBe(true);
    const bullets = blocks[6];
    expect(bullets.type === "list" && bullets.items[1]).toEqual([{ type: "text", text: "bullet two continued" }]);
    const code = blocks[9];
    expect(code.type === "code" && code.lang).toBe("sql");
  });

  it("keeps the words but drops the link for unsafe schemes", () => {
    expect(parseInline("see [here](https://example.com/x)")).toEqual([
      { type: "text", text: "see " },
      { type: "link", href: "https://example.com/x", children: [{ type: "text", text: "here" }] },
    ]);
    expect(parseInline("[click](javascript:alert)")).toEqual([{ type: "text", text: "click" }]);
    expect(parseInline("[img](data:text/html,x)")).toEqual([{ type: "text", text: "img" }]);
  });

  it("never produces markup: raw HTML stays text", () => {
    const blocks = parseMarkdown("<script>alert(1)</script> and <b>bold</b>");
    expect(blocks).toEqual([{ type: "paragraph", children: [{ type: "text", text: "<script>alert(1)</script> and <b>bold</b>" }] }]);
  });

  it("collapses wrapped lines into one paragraph and blank lines split them", () => {
    const blocks = parseMarkdown("line one\nline two\n\nline three");
    expect(blocks).toHaveLength(2);
    expect(markdownToText("line one\nline two\n\nline three")).toBe("line one line two\nline three");
  });

  it("handles inline emphasis without swallowing bold", () => {
    expect(parseInline("**What they sell.** Digital *programs*")).toEqual([
      { type: "strong", children: [{ type: "text", text: "What they sell." }] },
      { type: "text", text: " Digital " },
      { type: "em", children: [{ type: "text", text: "programs" }] },
    ]);
    expect(parseInline("snake_case_name stays")).toEqual([{ type: "text", text: "snake_case_name stays" }]);
  });
});
