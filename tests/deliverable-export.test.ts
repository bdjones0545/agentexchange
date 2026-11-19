import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DeliverableActions } from "../src/components/DeliverableActions";
import { deliverableFileContents, deliverableFilename, downloadMarkdown, type DownloadEnv } from "../src/lib/deliverableExport";

describe("deliverable file name", () => {
  it.each([
    ["Q3 pricing scan", "q3-pricing-scan.md"],
    ["  Competitor   pricing — final (v2)!  ", "competitor-pricing-final-v2.md"],
    ["Café résumé naïve", "cafe-resume-naive.md"],
    ["../../etc/passwd", "etc-passwd.md"],
    ['Report: "A/B" <test> | 50% * ?', "report-a-b-test-50.md"],
    ["", "deliverable.md"],
    ["🚀🚀🚀", "deliverable.md"],
  ])("%j -> %s", (title, expected) => {
    expect(deliverableFilename(title)).toBe(expected);
  });

  it("caps long titles without leaving a trailing dash", () => {
    const name = deliverableFilename(`${"word ".repeat(40)}end`);
    expect(name.length).toBeLessThanOrEqual(83);
    expect(name).toMatch(/^[a-z0-9-]+[a-z0-9]\.md$/);
  });
});

describe("deliverable file contents", () => {
  it("is the submitted markdown, unchanged, ending in one newline", () => {
    const notes = "# Findings\n\n| Plan | Price |\n| --- | --- |\n| Pro | $49 |\n\n```ts\nconst x = 1;\n```";
    expect(deliverableFileContents(notes)).toBe(`${notes}\n`);
    expect(deliverableFileContents("Done.\n\n\n")).toBe("Done.\n");
  });
});

describe("downloadMarkdown", () => {
  afterEach(() => vi.useRealTimers());

  function fakeEnv() {
    const link = { href: "", download: "", rel: "", style: { display: "" }, click: vi.fn(), remove: vi.fn() };
    const env = {
      document: { createElement: vi.fn(() => link), body: { appendChild: vi.fn() } },
      URL: { createObjectURL: vi.fn(() => "blob:https://www.agentsexchange.ai/abc"), revokeObjectURL: vi.fn() },
    };
    return { env, link };
  }

  it("saves the text as a .md file through a temporary object URL and cleans up", async () => {
    vi.useFakeTimers();
    const { env, link } = fakeEnv();
    const content = deliverableFileContents("# Pricing memo\n\nThree competitors, priced.");
    const blob = downloadMarkdown("pricing-memo.md", content, env as unknown as DownloadEnv);

    expect(blob.type).toBe("text/markdown;charset=utf-8");
    expect(await blob.text()).toBe(content);
    expect(env.URL.createObjectURL).toHaveBeenCalledWith(blob);
    expect(env.document.createElement).toHaveBeenCalledWith("a");
    expect(link.href).toBe("blob:https://www.agentsexchange.ai/abc");
    expect(link.download).toBe("pricing-memo.md");
    expect(env.document.body.appendChild).toHaveBeenCalledWith(link);
    expect(link.click).toHaveBeenCalledTimes(1);
    expect(link.remove).toHaveBeenCalledTimes(1);

    expect(env.URL.revokeObjectURL).not.toHaveBeenCalled();
    vi.runAllTimers();
    expect(env.URL.revokeObjectURL).toHaveBeenCalledWith("blob:https://www.agentsexchange.ai/abc");
  });

  it("keeps the full text of a 60,000-character deliverable", async () => {
    const { env } = fakeEnv();
    const notes = `# Long\n\n${"x".repeat(59_990)}`;
    const blob = downloadMarkdown("long.md", deliverableFileContents(notes), env as unknown as DownloadEnv);
    expect((await blob.text()).length).toBe(notes.length + 1);
  });
});

describe("DeliverableActions", () => {
  it("offers Copy and Download .md for the deliverable", () => {
    const html = renderToStaticMarkup(createElement(DeliverableActions, { title: "Pricing memo", notes: "# Memo" }));
    expect(html).toContain(">Copy<");
    expect(html).toContain("Download .md");
    expect(html).toContain('aria-label="Copy markdown of Pricing memo"');
    expect(html).toContain('aria-label="Download .md of Pricing memo"');
  });
});
