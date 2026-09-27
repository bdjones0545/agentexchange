import type { MoneyOperation, OperationStore } from '../server/moneyOperations';
export function memoryOperations(beforeBegin?: (op:MoneyOperation)=>Promise<void>): OperationStore {
  const rows=new Map<string,{request:string;result?:unknown;done:boolean;busy:boolean}>();
  return {
    async begin(op) {
      const request=JSON.stringify(op);
      let row=rows.get(op.key);
      if(row && row.request!==request) throw new Error('operation conflict');
      if(row?.done) return {state:'done',result:row.result};
      if(row?.busy) return {state:'busy'};
      await beforeBegin?.(op);
      row ??= {request,done:false,busy:false}; row.busy=true;rows.set(op.key,row);
      return {state:'acquired',token:'lease'};
    },
    async finish(key,_token,result) {const row=rows.get(key)!;row.done=true;row.busy=false;row.result=result;},
    async fail(key) {const row=rows.get(key);if(row)row.busy=false;},
  };
}
