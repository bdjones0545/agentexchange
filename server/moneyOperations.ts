import type { SupabaseClient } from '@supabase/supabase-js';
import { serviceClient } from './service.js';

export interface MoneyOperation {
  key: string;
  kind: string;
  profileId?: string;
  contractId?: string;
  request: Record<string, unknown>;
  amountCents?: number;
}
export interface OperationStore {
  begin(op: MoneyOperation): Promise<{ state: 'acquired' | 'done' | 'busy' | 'review'; token?: string; result?: unknown }>;
  finish(key: string, token: string, result: unknown): Promise<void>;
  fail(key: string, token: string, error: string): Promise<void>;
}
export class MoneyOperationError extends Error {
  constructor(public readonly status: number, message: string) { super(message); }
}
export function operationStore(client: SupabaseClient = serviceClient()): OperationStore {
  return {
    async begin(op) {
      const { data, error } = await client.rpc('begin_money_operation', {
        p_key: op.key, p_kind: op.kind, p_profile: op.profileId ?? null, p_contract: op.contractId ?? null,
        p_request: op.request, p_amount: op.amountCents ?? 0,
      });
      if (error) throw new MoneyOperationError(error.message.includes('spend cap') ? 429 : 409, error.message);
      return data;
    },
    async finish(key, token, result) {
      const { error } = await client.rpc('finish_money_operation', { p_key: key, p_token: token, p_result: result });
      if (error) throw new Error('Could not commit payment operation');
    },
    async fail(key, token, errorMessage) {
      const { error } = await client.rpc('fail_money_operation', { p_key: key, p_token: token, p_error: errorMessage });
      if (error) throw new Error('Could not release payment operation');
    },
  };
}
export async function runMoneyOperation<T>(store: OperationStore, op: MoneyOperation, run: () => Promise<T>): Promise<T> {
  const claim = await store.begin(op);
  if (claim.state === 'done') return claim.result as T;
  if (claim.state === 'busy') throw new MoneyOperationError(409, 'Payment operation is in progress; retry later');
  if (claim.state === 'review') throw new MoneyOperationError(409, 'Payment needs reconciliation before another attempt; no new charge was made');
  if (!claim.token) throw new Error('Payment operation did not return a lease');
  try {
    const result = await run();
    await store.finish(op.key, claim.token, result);
    return result;
  } catch (error) {
    // Do not persist provider messages, which may contain personal information.
    await store.fail(op.key, claim.token, error instanceof Error ? error.name : 'operation_failed').catch(() => {});
    throw error;
  }
}
