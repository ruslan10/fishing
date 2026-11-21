import assert from 'node:assert/strict';
import {fetchJsonWithRetry} from '../pipeline/http-retry.mjs';
const ok = {ok: true, json: async () => ({value: 1})};
for (const mode of ['success','recover','exhaust','http','invalid-json']) {
  let calls=0, waits=0;
  const fetchImpl=async (_url, options)=>{
    calls++; assert.ok(options.signal);
    if (mode==='exhaust' || (mode==='recover' && calls===1)) throw new TypeError('connection failed');
    if (mode==='http') return {ok:false,status:429};
    if (mode==='invalid-json') return {ok:true,json:async()=>{throw new SyntaxError('bad json');}};
    return ok;
  };
  const work=fetchJsonWithRetry('https://example.invalid','test',{fetchImpl,sleep:async ms=>{assert.equal(ms,2000);waits++;}});
  if (['exhaust','http','invalid-json'].includes(mode)) await assert.rejects(work);
  else assert.deepEqual(await work,{value:1});
  assert.equal(calls,['recover','exhaust'].includes(mode)?2:1);
  assert.equal(waits,['recover','exhaust'].includes(mode)?1:0);
}
console.log('PASS: success once, transport recovery, bounded exhaustion, no HTTP/parse retry');
