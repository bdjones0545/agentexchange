import { timingSafeEqual } from 'node:crypto';
import { readServerEnv } from '../server/config.js';
import { sellerGateway } from '../server/connect.js';
import { dispatch } from '../server/dispatch.js';
import { supabaseLedger } from '../server/ledger.js';
import { operationStore } from '../server/moneyOperations.js';
import { reconcileMoney } from '../server/reconcile.js';
import { serviceClient } from '../server/service.js';
import { realStripe } from '../server/stripe.js';
export async function GET(request:Request) {
  const expected=process.env.CRON_SECRET;
  const supplied=request.headers.get('authorization') ?? '';
  if(!expected || Buffer.byteLength(supplied)!==Buffer.byteLength(`Bearer ${expected}`) || !timingSafeEqual(Buffer.from(supplied),Buffer.from(`Bearer ${expected}`))) return Response.json({error:'Unauthorized'},{status:401});
  const env=readServerEnv();
  if(!env?.paymentsEnabled) return Response.json({error:'Payments disabled'},{status:503});
  const client=serviceClient();
  try {
    const result=await reconcileMoney(client,{ledger:supabaseLedger(client),operations:operationStore(client),stripe:realStripe(process.env.STRIPE_SECRET_KEY!),
      appUrl:env.appUrl,notify:e=>dispatch(env,e)},sellerGateway(process.env.STRIPE_SECRET_KEY!));
    return Response.json({ok:result.failed===0 && result.needsReview===0,...result},{headers:{'cache-control':'no-store'}});
  } catch { return Response.json({ok:false,error:'Payment reconciliation failed'},{status:500}); }
}
