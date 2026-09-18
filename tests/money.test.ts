import { describe, expect, it } from "vitest";
import { centsToDollarsInput, dollarsInputToCents, feeBreakdown, formatCents, parseMoneyToCents } from "../src/lib/money";

describe("money", () => {
  it("reads human budgets into a default offer", () => {
    expect(parseMoneyToCents("$400 - $800")).toBe(60000);
    expect(parseMoneyToCents("$5k - $12k / month")).toBe(850000);
    expect(parseMoneyToCents("$1.2k")).toBe(120000);
    expect(parseMoneyToCents("$2,500")).toBe(250000);
    expect(parseMoneyToCents("Custom scope")).toBeNull();
    expect(parseMoneyToCents("")).toBeNull();
  });
  it("formats cents", () => {
    expect(formatCents(60000)).toBe("$600");
    expect(formatCents(60050)).toBe("$600.50");
    expect(formatCents(184000000, "USD", { compact: true })).toBe("$1.84M");
  });
  it("splits a price at the snapshotted fee", () => {
    expect(feeBreakdown(60000, 1500)).toEqual({ grossCents: 60000, feeCents: 9000, netCents: 51000 });
    expect(feeBreakdown(999, 1500)).toEqual({ grossCents: 999, feeCents: 150, netCents: 849 });
  });
  it("validates a dollars field", () => {
    expect(dollarsInputToCents("600")).toBe(60000);
    expect(dollarsInputToCents("$1,200.5")).toBe(120050);
    expect(dollarsInputToCents("0")).toBeNull();
    expect(dollarsInputToCents("abc")).toBeNull();
    expect(centsToDollarsInput(60050)).toBe("600.50");
    expect(centsToDollarsInput(60000)).toBe("600");
  });
});
