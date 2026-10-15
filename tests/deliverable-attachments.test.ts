import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { gateState, type GateAnswers, type GateInput } from "../server/gate/deliverableGate";
import { TOOLS, type ToolContext } from "../server/mcp/tools";
import { DeliverableAttachments } from "../src/components/DeliverableAttachments";
import {
  ATTACHMENT_BUCKET, ATTACHMENT_TYPES, DOWNLOAD_URL_TTL_SECONDS, MAX_ATTACHMENT_BYTES, MAX_ATTACHMENTS_PER_DELIVERABLE,
  MAX_UPLOADS_PER_CONTRACT, SAFE_FILE_NAME, attachmentPath, formatBytes, isAllowedContentType, normalizeContentType,
  parseAttachmentPath, sanitizeFileName,
} from "../src/lib/attachmentRules";
import { attachmentDownloadUrl, listContractAttachments, type DeliverableAttachment } from "../src/lib/attachments";
import { gateLabel } from "../src/lib/gateLabel";
import { mapDeliverableRow } from "../src/lib/repositories/supabaseStateRepository";
import { fakeDb, type FakeStorage } from "./fakeSupabase";

const PROFILE = "11111111-1111-4111-8111-111111111111";
const AGENT = "33333333-3333-4333-8333-333333333333";
const OTHER_AGENT = "99999999-9999-4999-8999-999999999999";
const CONTRACT = "44444444-4444-4444-8444-444444444444";
const OTHER_CONTRACT = "55555555-5555-4555-8555-555555555555";
const DRAFT = "66666666-6666-4666-8666-666666666666";
const UPLOAD = "77777777-7777-4777-8777-777777777777";
const NOW = "2026-10-15T00:00:00.000Z";
const MIGRATION = readFileSync(new URL("../supabase/migrations/20261015120000_deliverable_attachments.sql", import.meta.url), "utf8");
const SCHEMA = readFileSync(new URL("../supabase/schema.sql", import.meta.url), "utf8");

const good: GateAnswers = { satisfiesBrief: 0.95, complete: 0.92, unsupportedClaims: 0.1, quality: 2.5 };
const path = (name: string, upload = UPLOAD, contract = CONTRACT) => `${contract}/${upload}/${name}`;
const tool = (name: string) => TOOLS.find((t) => t.name === name)!;

type Row = Record<string, unknown>;
type RpcCall = { name: string; args: Row };

function world(opts: { contract?: Row; disputes?: Row[]; storage?: FakeStorage; deliverables?: Row[]; attachments?: Row[]; rpcError?: string } = {}) {
  const calls: RpcCall[] = [];
  const tables: Record<string, Row[]> = {
    profiles: [{ id: PROFILE }],
    agents: [{ id: AGENT, owner_id: PROFILE, name: "Hermes Analyst" }],
    contracts: [{ id: CONTRACT, agent_id: AGENT, title: "Market scan", agent_name: "Hermes Analyst", organization_name: "Acme", status: "Active", amount_cents: null, payment_status: "unfunded", ...opts.contract }],
    disputes: opts.disputes ?? [],
    contract_deliverables: opts.deliverables ?? [],
    contract_deliverable_attachments: opts.attachments ?? [],
    deliverable_gate_events: [],
  };
  const storage: FakeStorage = opts.storage ?? {};
  const db = fakeDb({
    tables,
    storage,
    // Stands in for submit_deliverable_with_attachments(): revise the named draft or add one, then submit it.
    rpc: (name, args) => {
      calls.push({ name, args });
      if (opts.rpcError) return { data: null, error: { message: opts.rpcError } };
      const rows = tables.contract_deliverables;
      let d = args.p_deliverable ? rows.find((r) => r.id === args.p_deliverable && r.status === "draft") : undefined;
      if (args.p_deliverable && !d) return { data: null, error: { message: "Only a draft on this contract can be revised" } };
      if (!d) rows.push((d = { id: "88888888-8888-4888-8888-888888888888", contract_id: args.p_contract, decisions: [] }));
      Object.assign(d, { title: args.p_title, notes: args.p_notes, gate: args.p_gate, status: "submitted", submitted_at: args.p_submitted_at });
      return { data: { id: d.id, title: d.title, status: d.status, submitted_at: d.submitted_at, attachments: (args.p_paths as string[]).map((p) => ({ path: p })) }, error: null };
    },
  });
  return { db, tables, storage, calls };
}

function ctx(db: SupabaseClient, gate: ToolContext["gate"] = null): ToolContext {
  return { open: async () => ({ db, profileId: PROFILE }), worker: "agentexchange", now: () => NOW, paymentsEnabled: false, gate };
}

const uploaded = (...names: string[]): FakeStorage => ({
  objects: Object.fromEntries(names.map((n) => [`${ATTACHMENT_BUCKET}/${path(n)}`, { size: 2048, contentType: n.endsWith(".xlsx") ? ATTACHMENT_TYPE_XLSX : "application/pdf" }])),
});
const ATTACHMENT_TYPE_XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

describe("file names and paths", () => {
  it("sanitises names into safe storage keys whose extension matches the type", () => {
    expect(sanitizeFileName("../../etc/passwd", "text/plain")).toBe("passwd.txt");
    expect(sanitizeFileName("C:\\Users\\me\\Q3 Pricing (final).xlsx", ATTACHMENT_TYPE_XLSX)).toBe("Q3-Pricing-final.xlsx");
    expect(sanitizeFileName("invoice.pdf.exe", "application/pdf")).toBe("invoice-pdf-exe.pdf");
    expect(sanitizeFileName(".env", "text/plain")).toBe("env.txt");
    expect(sanitizeFileName("Résumé.PDF", "application/pdf")).toBe("Resume.pdf");
    expect(sanitizeFileName("photo.JPEG", "image/jpeg")).toBe("photo.jpeg");
    expect(sanitizeFileName("   ", "application/pdf")).toBe("file.pdf");
    expect(sanitizeFileName("报告.pdf", "application/pdf")).toBe("file.pdf");
    expect(sanitizeFileName("a..b....c.csv", "text/csv; charset=utf-8")).toBe("a.b.c.csv");
  });

  it("every sanitised name passes the database's file-name pattern", () => {
    const nasty = ["x".repeat(400) + ".pdf", "<script>alert(1)</script>.pdf", "a/../../b.zip", "--.__.pdf", "\u0000evil.pdf", "name with spaces.docx", "..", "-"];
    for (const raw of nasty) {
      for (const type of Object.keys(ATTACHMENT_TYPES)) {
        const name = sanitizeFileName(raw, type);
        expect(name, `${raw} as ${type}`).toMatch(SAFE_FILE_NAME);
        expect(name).not.toContain("..");
        expect(name.length).toBeLessThanOrEqual(120);
        expect(ATTACHMENT_TYPES[type]).toContain(name.slice(name.lastIndexOf(".") + 1));
        expect(parseAttachmentPath(attachmentPath(CONTRACT, UPLOAD, name))).not.toBeNull();
      }
    }
  });

  it("refuses types a browser would run, and normalises parameters away", () => {
    for (const t of ["text/html", "image/svg+xml", "application/javascript", "application/x-msdownload", "application/octet-stream"]) {
      expect(isAllowedContentType(t)).toBe(false);
      expect(() => sanitizeFileName("x", t)).toThrow();
    }
    expect(normalizeContentType(" Text/CSV; charset=utf-8")).toBe("text/csv");
    expect(isAllowedContentType("APPLICATION/PDF")).toBe(true);
  });

  it("parses only well-formed paths: lowercase ids, one level, safe name", () => {
    expect(parseAttachmentPath(path("memo.pdf"))).toEqual({ contractId: CONTRACT, uploadId: UPLOAD, fileName: "memo.pdf" });
    const hex = "abcdef12-3456-4789-8abc-def012345678";
    expect(parseAttachmentPath(path("memo.pdf", UPLOAD, hex))).not.toBeNull();
    expect(parseAttachmentPath(path("memo.pdf", UPLOAD, hex.toUpperCase()))).toBeNull();
    expect(parseAttachmentPath(`${CONTRACT}/${UPLOAD}/../memo.pdf`)).toBeNull();
    expect(parseAttachmentPath(`${CONTRACT}/${UPLOAD}/a/memo.pdf`)).toBeNull();
    expect(parseAttachmentPath(`${CONTRACT}/memo.pdf`)).toBeNull();
    expect(parseAttachmentPath(`${CONTRACT}/${UPLOAD}/.hidden`)).toBeNull();
  });

  it("formats sizes for people", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(2048)).toBe("2.0 KB");
    expect(formatBytes(MAX_ATTACHMENT_BYTES)).toBe("25.0 MB");
  });
});

describe("the database enforces the same limits", () => {
  it("the bucket and trigger allow exactly the browser's content types", () => {
    const sqlTypes = [...(/deliverable_attachment_types\(\)[\s\S]*?array\[([\s\S]*?)\]::text\[\]/.exec(MIGRATION)?.[1] ?? "").matchAll(/'([^']+)'/g)].map((m) => m[1]);
    expect(sqlTypes.sort()).toEqual(Object.keys(ATTACHMENT_TYPES).sort());
  });
  it("size, count and upload caps and the name pattern match", () => {
    expect(MIGRATION).toContain(`false, ${MAX_ATTACHMENT_BYTES}, public.deliverable_attachment_types()`);
    expect(MIGRATION).toContain(`bytes > ${MAX_ATTACHMENT_BYTES}`);
    expect(MIGRATION).toContain(`a.deliverable_id = new.deliverable_id) >= ${MAX_ATTACHMENTS_PER_DELIVERABLE}`);
    expect(MIGRATION).toContain(`cardinality(v_paths) > ${MAX_ATTACHMENTS_PER_DELIVERABLE}`);
    expect(MIGRATION).toContain(`) < ${MAX_UPLOADS_PER_CONTRACT};`);
    expect(MIGRATION).toContain(`/${SAFE_FILE_NAME.source.slice(1, -1)}$'`);
    expect(MIGRATION).toContain(`'${ATTACHMENT_BUCKET}'`);
  });
  it("schema.sql carries the migration verbatim, so a fresh project gets the same rules", () => {
    const body = MIGRATION.slice(MIGRATION.indexOf("-- 1. Limits"));
    expect(SCHEMA).toContain(body);
  });
});

describe("request_upload_url", () => {
  const request = tool("request_upload_url");
  it("signs a private upload under the contract with a sanitised name", async () => {
    const { db, storage } = world();
    const r = (await request.run({ contractId: CONTRACT, fileName: "Pricing Scan.XLSX", contentType: ATTACHMENT_TYPE_XLSX, sizeBytes: 4096 }, ctx(db))) as Row & { upload: Row };
    expect(r.ok).toBe(true);
    expect(r.fileName).toBe("Pricing-Scan.xlsx");
    expect(parseAttachmentPath(String(r.path))).toMatchObject({ contractId: CONTRACT, fileName: "Pricing-Scan.xlsx" });
    expect(r.upload).toMatchObject({ method: "PUT", headers: { "content-type": ATTACHMENT_TYPE_XLSX } });
    expect(String(r.upload.url)).toContain(`/upload/sign/${ATTACHMENT_BUCKET}/${r.path}`);
    expect(storage.signedUploads).toEqual([`${ATTACHMENT_BUCKET}/${r.path}`]);
  });
  it("mints a fresh path per request, so an upload can never overwrite another", async () => {
    const { db } = world();
    const input = { contractId: CONTRACT, fileName: "memo.pdf", contentType: "application/pdf", sizeBytes: 10 };
    const a = (await request.run(input, ctx(db))) as Row;
    const b = (await request.run(input, ctx(db))) as Row;
    expect(a.path).not.toBe(b.path);
  });
  it("refuses a disallowed type or an oversized file before signing anything", async () => {
    const { db, storage } = world();
    const html = (await request.run({ contractId: CONTRACT, fileName: "page.html", contentType: "text/html", sizeBytes: 10 }, ctx(db))) as Row;
    expect(html).toMatchObject({ ok: false });
    expect(String(html.error)).toMatch(/text\/html is not allowed; allowed: application\/pdf/);
    const big = (await request.run({ contractId: CONTRACT, fileName: "big.zip", contentType: "application/zip", sizeBytes: MAX_ATTACHMENT_BYTES + 1 }, ctx(db))) as Row;
    expect(String(big.error)).toMatch(/at most 25.0 MB/);
    expect(storage.signedUploads ?? []).toEqual([]);
  });
  it("refuses the organization side", async () => {
    const { db, storage } = world({ contract: { agent_id: OTHER_AGENT } });
    const r = (await request.run({ contractId: CONTRACT, fileName: "memo.pdf", contentType: "application/pdf", sizeBytes: 10 }, ctx(db))) as Row;
    expect(r).toEqual({ ok: false, error: "only the agent side of a contract can upload files" });
    expect(storage.signedUploads ?? []).toEqual([]);
  });
  it("refuses while a dispute is open or a priced contract is unfunded, in the database's words", async () => {
    const input = { contractId: CONTRACT, fileName: "memo.pdf", contentType: "application/pdf", sizeBytes: 10 };
    const disputed = world({ disputes: [{ id: "d", contract_id: CONTRACT, status: "Open" }] });
    expect(await request.run(input, ctx(disputed.db))).toEqual({ ok: false, error: "Resolve the contract hold before changing delivery" });
    const unfunded = world({ contract: { amount_cents: 60000, payment_status: "unfunded" } });
    expect(await request.run(input, ctx(unfunded.db))).toEqual({ ok: false, error: "Priced work requires funding authorization" });
    const funded = world({ contract: { amount_cents: 60000, payment_status: "authorized" }, disputes: [{ id: "d", contract_id: CONTRACT, status: "Resolved" }] });
    expect(await request.run(input, ctx(funded.db))).toMatchObject({ ok: true });
  });
  it("passes on Storage's refusal, and names a missing bucket as not enabled", async () => {
    const input = { contractId: CONTRACT, fileName: "memo.pdf", contentType: "application/pdf", sizeBytes: 10 };
    const refused = world({ storage: { refuseSign: () => "new row violates row-level security policy" } });
    expect(await request.run(input, ctx(refused.db))).toEqual({ ok: false, error: "request_upload_url: new row violates row-level security policy" });
    const missing = world({ storage: { refuseSign: () => "Bucket not found" } });
    expect(String(((await request.run(input, ctx(missing.db))) as Row).error)).toMatch(/not enabled on this server yet/);
  });
});

describe("submit_deliverable with attachments", () => {
  const submit = tool("submit_deliverable");
  it("attaches and submits in one database call; the gate is told the files exist and never opens them", async () => {
    const { db, calls } = world({ storage: uploaded("memo.pdf", "scan.xlsx") });
    const seen: GateInput[] = [];
    const r = (await submit.run(
      { contractId: CONTRACT, title: "Scan", notes: "# Findings\nThe spreadsheet lists every price.", attachments: [path("memo.pdf"), path("scan.xlsx")] },
      ctx(db, async (i) => { seen.push(i); return good; }),
    )) as Row & { gate: Row; deliverable: Row };
    expect(r.ok).toBe(true);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      name: "submit_deliverable_with_attachments",
      args: { p_contract: CONTRACT, p_deliverable: null, p_title: "Scan", p_paths: [path("memo.pdf"), path("scan.xlsx")], p_submitted_at: NOW },
    });
    expect(seen[0].attachments).toEqual([
      { path: path("memo.pdf"), fileName: "memo.pdf", contentType: "application/pdf", sizeBytes: 2048 },
      { path: path("scan.xlsx"), fileName: "scan.xlsx", contentType: ATTACHMENT_TYPE_XLSX, sizeBytes: 2048 },
    ]);
    expect(r.gate).toMatchObject({ verdict: "passed", unevaluatedAttachments: 2 });
    expect((calls[0].args.p_gate as Row).unevaluatedAttachments).toBe(2);
    expect(r.deliverable).toMatchObject({ status: "submitted", attachments: [{ path: path("memo.pdf") }, { path: path("scan.xlsx") }] });
  });

  it("the evaluator's state carries names, types and sizes only, and is unchanged when there are no files", () => {
    const brief = { contractTitle: "Scan" };
    const plain = gateState({ brief, title: "t", notes: "n" });
    expect(plain.deliverable).toEqual({ title: "t", body: "n" });
    expect(gateState({ brief, title: "t", notes: "n", attachments: [] })).toEqual(plain);
    const withFiles = gateState({ brief, title: "t", notes: "n", attachments: [{ fileName: "a.pdf", contentType: "application/pdf", sizeBytes: 9 }] });
    expect(withFiles.deliverable).toMatchObject({ attachments: [{ name: "a.pdf", contentType: "application/pdf", sizeBytes: 9 }] });
    expect(JSON.stringify(withFiles)).toMatch(/contents were not evaluated/);
  });

  it("refuses another contract's upload, a malformed path, a duplicate, or a file that never arrived, before the gate runs", async () => {
    const cases: Array<[string[], RegExp]> = [
      [[path("memo.pdf", UPLOAD, OTHER_CONTRACT)], /is not an upload for this contract/],
      [[`${CONTRACT}/../memo.pdf`], /is not an upload for this contract/],
      [[path("memo.pdf"), path("memo.pdf")], /each file can be attached once/],
      [[path("missing.pdf")], /has not been uploaded/],
    ];
    for (const [attachments, error] of cases) {
      const { db, calls } = world({ storage: uploaded("memo.pdf") });
      let gated = false;
      const r = (await submit.run({ contractId: CONTRACT, title: "Scan", notes: "work", attachments }, ctx(db, async () => { gated = true; return good; }))) as Row;
      expect(r.ok).toBe(false);
      expect(String(r.error)).toMatch(error);
      expect(String(r.error)).toMatch(/Nothing was submitted/);
      expect(gated).toBe(false);
      expect(calls).toEqual([]);
    }
  });

  it("refuses a stored file whose real type or size breaks the rules", async () => {
    const { db } = world({ storage: { objects: { [`${ATTACHMENT_BUCKET}/${path("page.pdf")}`]: { size: 10, contentType: "text/html" }, [`${ATTACHMENT_BUCKET}/${path("big.pdf")}`]: { size: MAX_ATTACHMENT_BYTES + 1, contentType: "application/pdf" } } } });
    expect(String(((await submit.run({ contractId: CONTRACT, title: "Scan", notes: "work", attachments: [path("page.pdf")] }, ctx(db))) as Row).error)).toMatch(/text\/html is not allowed/);
    expect(String(((await submit.run({ contractId: CONTRACT, title: "Scan", notes: "work", attachments: [path("big.pdf")] }, ctx(db))) as Row).error)).toMatch(/between 1 byte and 25.0 MB/);
  });

  it("revises the rejected draft with its new file set", async () => {
    const { db, calls, tables } = world({ storage: uploaded("v2.pdf"), deliverables: [{ id: DRAFT, contract_id: CONTRACT, status: "draft", decisions: [{ status: "rejected" }] }] });
    const r = (await submit.run({ contractId: CONTRACT, title: "Scan v2", notes: "work", attachments: [path("v2.pdf")] }, ctx(db, async () => good))) as Row;
    expect(r.ok).toBe(true);
    expect(calls[0].args).toMatchObject({ p_deliverable: DRAFT, p_paths: [path("v2.pdf")] });
    expect(tables.contract_deliverables).toHaveLength(1);
    expect(tables.contract_deliverables[0]).toMatchObject({ id: DRAFT, status: "submitted" });
  });

  it("[] clears a draft's files through the same transaction", async () => {
    const { db, calls } = world({ deliverables: [{ id: DRAFT, contract_id: CONTRACT, status: "draft", decisions: [] }] });
    const r = (await submit.run({ contractId: CONTRACT, title: "Scan v2", notes: "work", attachments: [] }, ctx(db, async () => good))) as Row & { gate: Row };
    expect(r.ok).toBe(true);
    expect(calls[0].args).toMatchObject({ p_deliverable: DRAFT, p_paths: [] });
    expect(r.gate.unevaluatedAttachments).toBeUndefined();
  });

  it("without attachments a revision keeps its files, and the gate is still told about them", async () => {
    const { db, calls } = world({
      deliverables: [{ id: DRAFT, contract_id: CONTRACT, status: "draft", decisions: [] }],
      attachments: [{ deliverable_id: DRAFT, file_name: "memo.pdf", content_type: "application/pdf", size_bytes: 2048 }],
    });
    const seen: GateInput[] = [];
    const r = (await submit.run({ contractId: CONTRACT, title: "Scan v2", notes: "work" }, ctx(db, async (i) => { seen.push(i); return good; }))) as Row & { gate: Row };
    expect(r.ok).toBe(true);
    expect(calls).toEqual([]);
    expect(seen[0].attachments).toEqual([{ fileName: "memo.pdf", contentType: "application/pdf", sizeBytes: 2048 }]);
    expect(r.gate.unevaluatedAttachments).toBe(1);
  });

  it("a returned deliverable writes nothing and leaves the uploads usable", async () => {
    const thin: GateAnswers = { satisfiesBrief: 0.2, complete: 0.2, unsupportedClaims: 0.1, quality: 1 };
    const { db, calls, tables } = world({ storage: uploaded("memo.pdf") });
    const r = (await submit.run({ contractId: CONTRACT, title: "Scan", notes: "plan", attachments: [path("memo.pdf")] }, ctx(db, async () => thin))) as Row & { gate: Row };
    expect(r.ok).toBe(false);
    expect(r.gate.verdict).toBe("returned");
    expect(calls).toEqual([]);
    expect(tables.contract_deliverables).toEqual([]);
  });

  it("explains when the server does not have the attachments migration yet", async () => {
    const { db } = world({ storage: uploaded("memo.pdf"), rpcError: "Could not find the function public.submit_deliverable_with_attachments in the schema cache" });
    const r = (await submit.run({ contractId: CONTRACT, title: "Scan", notes: "work", attachments: [path("memo.pdf")] }, ctx(db, async () => good))) as Row;
    expect(r).toEqual({ ok: false, error: "submit_deliverable: file attachments are not enabled on this server yet; submit without attachments" });
  });
});

describe("get_contract lists each deliverable's files", () => {
  it("groups attachment metadata under its deliverable", async () => {
    const { db } = world({
      deliverables: [{ id: DRAFT, contract_id: CONTRACT, status: "submitted", title: "Scan", created_at: NOW }],
      attachments: [{ deliverable_id: DRAFT, contract_id: CONTRACT, storage_path: path("memo.pdf"), file_name: "memo.pdf", content_type: "application/pdf", size_bytes: 2048 }],
    });
    const r = (await tool("get_contract").run({ contractId: CONTRACT }, ctx(db))) as { deliverables: Array<Row & { attachments: Row[] }> };
    expect(r.deliverables[0].attachments).toEqual([{ path: path("memo.pdf"), fileName: "memo.pdf", contentType: "application/pdf", sizeBytes: 2048 }]);
  });
});

describe("buyer view", () => {
  const files: DeliverableAttachment[] = [
    { id: "a1", deliverableId: DRAFT, path: path("memo.pdf"), fileName: "memo.pdf", contentType: "application/pdf", sizeBytes: 2048, createdAt: NOW },
    { id: "a2", deliverableId: DRAFT, path: path("scan.xlsx"), fileName: "scan.xlsx", contentType: ATTACHMENT_TYPE_XLSX, sizeBytes: 3 * 1024 * 1024, createdAt: NOW },
  ];

  it("lists each file with its size and a labelled download button", () => {
    const html = renderToStaticMarkup(createElement(DeliverableAttachments, { attachments: files }));
    expect(html).toContain("2 files");
    expect(html).toContain("memo.pdf");
    expect(html).toContain("PDF · 2.0 KB");
    expect(html).toContain("XLSX · 3.0 MB");
    expect(html).toContain('aria-label="Download scan.xlsx"');
    // No URL is ever rendered: links are signed on click.
    expect(html).not.toContain("http");
  });
  it("renders nothing when a deliverable has no files", () => {
    expect(renderToStaticMarkup(createElement(DeliverableAttachments, { attachments: [] }))).toBe("");
  });

  it("tells the organization the gate did not open the files", () => {
    const gate = { verdict: "passed" as const, attempt: 1, flags: [], answers: null, unevaluatedAttachments: 2 };
    expect(gateLabel(gate)).toBe("Quality gate: passed · 2 attached files were not opened by the gate");
    expect(gateLabel({ ...gate, unevaluatedAttachments: 1 })).toMatch(/the attached file was not opened by the gate$/);
    expect(gateLabel({ ...gate, unevaluatedAttachments: undefined })).toBe("Quality gate: passed");
    expect(mapDeliverableRow({ id: DRAFT, gate: { verdict: "passed", attempt: 1, flags: [], answers: null, unevaluatedAttachments: 2 } }).gate).toMatchObject({ unevaluatedAttachments: 2 });
  });

  it("reads the contract's files and signs a one-minute download under the file's own name", async () => {
    const signed: unknown[] = [];
    const client = {
      from: () => {
        const q = { select: () => q, eq: () => q, order: async () => ({ data: [{ id: "a1", deliverable_id: DRAFT, storage_path: path("memo.pdf"), file_name: "memo.pdf", content_type: "application/pdf", size_bytes: 2048, created_at: NOW }], error: null }) };
        return q;
      },
      storage: { from: (bucket: string) => ({ createSignedUrl: async (...args: unknown[]) => { signed.push([bucket, ...args]); return { data: { signedUrl: "https://storage.test/signed" }, error: null }; } }) },
    } as unknown as SupabaseClient;
    expect(await listContractAttachments(CONTRACT, client)).toEqual([files[0]]);
    expect(await attachmentDownloadUrl(files[0], client)).toBe("https://storage.test/signed");
    expect(signed).toEqual([[ATTACHMENT_BUCKET, path("memo.pdf"), DOWNLOAD_URL_TTL_SECONDS, { download: "memo.pdf" }]]);
    expect(DOWNLOAD_URL_TTL_SECONDS).toBeLessThanOrEqual(60);
  });
  it("shows no files rather than failing when the table is not there yet", async () => {
    const client = { from: () => { const q = { select: () => q, eq: () => q, order: async () => ({ data: null, error: { message: "relation does not exist" } }) }; return q; } } as unknown as SupabaseClient;
    expect(await listContractAttachments(CONTRACT, client)).toEqual([]);
    expect(await listContractAttachments(CONTRACT, null)).toEqual([]);
  });
});
