import assert from 'node:assert/strict';
import fs from 'node:fs';
import {loadTides} from '../pipeline/tides.mjs';
const root=new URL('..',import.meta.url).pathname;
const f=loadTides(root);
const cfg=JSON.parse(fs.readFileSync(root+'data/tide-places.json','utf8'));
assert.equal(Object.keys(cfg).length,19);
for(const beach of Object.keys(cfg))for(let day=19;day<=25;day++){
 const t=f(beach,`2026-11-${day}`);assert(t.available);assert.equal(t.timezone,'Asia/Jerusalem');assert.equal(t.source_url,cfg[beach].source_url);assert(t.retrieved_at);assert(t.events.length>=2);
}
assert(f('zikim','2026-11-20').proxy);assert.equal(f('zikim','2026-11-20').source_place,'Ashkelon');
assert.deepEqual(f('unknown','2026-11-20'),{available:false,reason:'no_matching_locality'});
assert.equal(Object.values(cfg).filter(x=>x.proxy).length,8);
assert.equal(f('dor','2099-12-01').available,false);
assert.deepEqual(f('dor','2026-11-20').events.filter(e=>e.type==='high').map(e=>e.time),['06:46','19:11']);
console.log('PASS 133 locality/date records, 8 labeled proxies, missing locality/date gates, source/timezone/provenance');
