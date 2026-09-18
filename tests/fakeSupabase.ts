// A tiny in-memory stand-in for the supabase-js query builder, enough for the
// worker tools: from().select/insert/update, eq/in/order, single/maybeSingle,
// rpc. Rows are plain objects; "policies" can refuse a write to imitate RLS.
import type { SupabaseClient } from "@supabase/supabase-js";

type Row = Record<string, unknown>;
type Result = { data: unknown; error: { message: string } | null };

export interface FakeDbOptions {
  tables: Record<string, Row[]>;
  refuseInsert?: (table: string, row: Row) => string | null;
  refuseUpdate?: (table: string, row: Row, patch: Row) => string | null;
  rpc?: (name: string, args: Row) => Result;
}

let seq = 0;
const nextId = () => `00000000-0000-4000-8000-${String(++seq).padStart(12, "0")}`;

class Builder implements PromiseLike<Result> {
  private filters: Array<(r: Row) => boolean> = [];
  private orderKey: { col: string; asc: boolean } | null = null;
  private mode: "select" | "insert" | "update" = "select";
  private payload: Row | null = null;
  private wantSingle: "single" | "maybe" | null = null;

  constructor(private opts: FakeDbOptions, private table: string) {}

  select(_cols?: string) { return this; }
  insert(row: Row) { this.mode = "insert"; this.payload = row; return this; }
  update(patch: Row) { this.mode = "update"; this.payload = patch; return this; }
  eq(col: string, v: unknown) { this.filters.push((r) => r[col] === v); return this; }
  in(col: string, vs: unknown[]) { this.filters.push((r) => vs.includes(r[col])); return this; }
  ilike(col: string, v: string) { const needle = v.replace(/%/g, "").toLowerCase(); this.filters.push((r) => String(r[col] ?? "").toLowerCase().includes(needle)); return this; }
  is(col: string, v: unknown) { this.filters.push((r) => (r[col] ?? null) === v); return this; }
  limit(_n: number) { return this; }
  order(col: string, o?: { ascending?: boolean }) { this.orderKey = { col, asc: o?.ascending !== false }; return this; }
  single() { this.wantSingle = "single"; return this; }
  maybeSingle() { this.wantSingle = "maybe"; return this; }

  private run(): Result {
    const rows = this.opts.tables[this.table] ?? (this.opts.tables[this.table] = []);
    let out: Row[];
    if (this.mode === "insert") {
      const reason = this.opts.refuseInsert?.(this.table, this.payload!);
      if (reason) return { data: null, error: { message: reason } };
      const row = { id: nextId(), created_at: new Date().toISOString(), ...this.payload! };
      rows.push(row);
      out = [row];
    } else if (this.mode === "update") {
      out = [];
      for (const r of rows) {
        if (!this.filters.every((f) => f(r))) continue;
        const reason = this.opts.refuseUpdate?.(this.table, r, this.payload!);
        if (reason) return { data: null, error: { message: reason } };
        Object.assign(r, this.payload!);
        out.push(r);
      }
    } else {
      out = rows.filter((r) => this.filters.every((f) => f(r)));
      if (this.orderKey) {
        const { col, asc } = this.orderKey;
        out = [...out].sort((a, b) => (String(a[col]) < String(b[col]) ? -1 : 1) * (asc ? 1 : -1));
      }
    }
    if (this.wantSingle === "single") {
      return out.length === 1 ? { data: out[0], error: null } : { data: null, error: { message: `expected one row, got ${out.length}` } };
    }
    if (this.wantSingle === "maybe") return { data: out[0] ?? null, error: null };
    return { data: out, error: null };
  }

  then<T1 = Result, T2 = never>(onfulfilled?: ((v: Result) => T1 | PromiseLike<T1>) | null, onrejected?: ((e: unknown) => T2 | PromiseLike<T2>) | null): PromiseLike<T1 | T2> {
    return Promise.resolve(this.run()).then(onfulfilled ?? undefined, onrejected ?? undefined);
  }
}

export function fakeDb(opts: FakeDbOptions): SupabaseClient {
  const client = {
    from: (table: string) => new Builder(opts, table),
    rpc: async (name: string, args: Row) => opts.rpc?.(name, args) ?? { data: null, error: { message: `no rpc ${name}` } },
  };
  return client as unknown as SupabaseClient;
}
