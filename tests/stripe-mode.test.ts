import { describe, expect, it } from 'vitest';
import { stripeMode } from '../server/stripeMode';
import { reconcileMoney } from '../server/reconcile';

describe('stripe mode tagging', () => {
  it('reads the mode from the secret key prefix', () => {
    expect(stripeMode('sk_live_abc')).toBe('live');
    expect(stripeMode('rk_live_abc')).toBe('live');
    expect(stripeMode('sk_test_abc')).toBe('test');
    expect(stripeMode(undefined)).toBe('test');
  });

  it('reconciles only payments and payouts written in the current mode', async () => {
    const filters: Array<{ table: string; calls: string[] }> = [];
    const client = {
      from(table: string) {
        const entry = { table, calls: [] as string[] };
        filters.push(entry);
        const builder: Record<string, unknown> = {};
        for (const method of ['select', 'is', 'in', 'lte', 'order', 'limit', 'eq', 'update', 'or']) {
          builder[method] = (...args: unknown[]) => { entry.calls.push(`${method}(${args.map((a) => JSON.stringify(a)).join(',')})`); return builder; };
        }
        builder.then = (resolve: (v: unknown) => unknown) => resolve({ data: [], error: null });
        return builder;
      },
    };
    await reconcileMoney(client as never, {} as never, {} as never, () => Date.now(), 'live');
    const payments = filters.find((f) => f.table === 'payments')!;
    const payouts = filters.find((f) => f.table === 'payouts')!;
    expect(payments.calls).toContain('eq("provider_mode","live")');
    expect(payouts.calls).toContain('eq("provider_mode","live")');
  });
});
