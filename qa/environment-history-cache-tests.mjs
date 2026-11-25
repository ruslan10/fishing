import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {chooseHistory,validHistory,loadHistory} from '../pipeline/environment-history-cache.mjs';
import {clarityAssessment} from '../fishing-assessment.mjs';
const root=new URL('..',import.meta.url).pathname;
const donor=JSON.parse(fs.readFileSync(root+'data/issues/2026-11-25T05-01-26-ef6b55.json'));
const missing=JSON.parse(fs.readFileSync(root+'data/issues/2026-11-25T06-53-21-a03832.json'));
const h=donor.environment_history,beaches=missing.snapshot.beaches,now=Date.parse(missing.meta.issued_at_utc),ctx={now,beaches};
const copy=x=>JSON.parse(JSON.stringify(x));let tests=0;
function check(name,fn){fn();tests++;console.log('PASS '+name);}
const candidate={history:h,beaches,source:'donor'};
check('real archived05:01 payload eligible at06:53, exact object retained',()=>assert.equal(chooseHistory([candidate],ctx).history,h));
check('exact3h boundary rejected',()=>assert.equal(validHistory(h,{...ctx,now:Date.parse(h.retrieved_at)+10800000}),false));
check('expired rejected',()=>assert.equal(validHistory(h,{...ctx,now:Date.parse(h.retrieved_at)+10800001}),false));
for(const [name,mutate] of [
 ['future timestamp',x=>x.retrieved_at=new Date(now+1).toISOString()],
 ['invalid timestamp',x=>x.retrieved_at='bad'],
 ['wrong date',x=>x.date='2026-11-24'],
 ['wrong cutoff',x=>x.cutoff='2026-11-25T00:00:00Z'],
 ['wrong source',x=>x.source_kind='observations'],
 ['missing beach',x=>delete x.beaches[beaches[0].id]],
 ['missing field',x=>delete x.beaches[beaches[0].id].hourly[0].wind],
 ['duplicate hour',x=>x.beaches[beaches[0].id].hourly[1].time=x.beaches[beaches[0].id].hourly[0].time],
 ['invalid count',x=>x.beaches[beaches[0].id].wave.valid=49],
 ['malformed hourly',x=>x.beaches[beaches[0].id].hourly={}]
])check(name+' rejected',()=>{const x=copy(h);mutate(x);assert.equal(validHistory(x,ctx),false);});
check('changed coordinates rejected despite same IDs',()=>{const b=copy(beaches);b[0].lat+=.01;assert.equal(chooseHistory([{...candidate,beaches:b}],ctx),null);});
check('null newest issue does not hide valid older donor',()=>assert.equal(chooseHistory([{...candidate,history:null},candidate],ctx).history,h));
check('newest retrieval wins, fresh fetch wins ties',()=>{const newer=copy(h);newer.retrieved_at=new Date(now-1000).toISOString();const fresh={history:newer,beaches,fresh:true};assert.equal(chooseHistory([candidate,fresh],ctx),fresh);assert.equal(chooseHistory([{...fresh,fresh:false},fresh],ctx),fresh);});
check('partial/missing values stay missing, never combined',()=>{const x=copy(h);x.beaches[beaches[0].id].hourly[0].wave=null;assert.equal(chooseHistory([{...candidate,history:x}],ctx).history,x);assert.equal(x.beaches[beaches[0].id].hourly[0].wave,null);});
check('Jerusalem DST midnight accepted, incorrect offset rejected',()=>{const x=copy(h);x.date='2026-06-01';x.cutoff='2026-06-01T00:00:00+03:00';x.retrieved_at='2026-06-01T05:00:00+03:00';const c={beaches,now:Date.parse('2026-06-01T06:00:00+03:00')};assert(validHistory(x,c));x.cutoff='2026-06-01T00:00:00+02:00';assert.equal(validHistory(x,c),false);});
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'history-cache-'));fs.mkdirSync(path.join(dir,'issues'));
try{
 const file='issues/'+donor.meta.issue_id+'.json';const issuePath=path.join(dir,file);fs.writeFileSync(issuePath,JSON.stringify(donor));fs.writeFileSync(path.join(dir,'archive-index.json'),JSON.stringify({issues:[{issue_id:missing.meta.issue_id,file:'issues/'+missing.meta.issue_id+'.json'},{issue_id:donor.meta.issue_id,file}]}));fs.writeFileSync(path.join(dir,'issues',missing.meta.issue_id+'.json'),JSON.stringify(missing));
 const before=fs.readFileSync(issuePath);const args={dataDir:dir,beaches,now,log:()=>{}};
 check('synthetic failed-fetch replay falls back to immutable donor without writes',()=>{assert.deepEqual(loadHistory(args),h);assert.deepEqual(fs.readFileSync(issuePath),before);assert.equal(fs.existsSync(path.join(dir,'environment-history.json')),false);});
 check('unproven failed cache coordinates rejected',()=>{const x=copy(h);x.retrieved_at=new Date(now-1000).toISOString();fs.writeFileSync(path.join(dir,'environment-history.json'),JSON.stringify(x));assert.deepEqual(loadHistory(args),h);assert.deepEqual(loadHistory({...args,freshFetch:true}),x);});
 check('bounded32-entry scan, unsafe path ignored',()=>{fs.writeFileSync(path.join(dir,'archive-index.json'),JSON.stringify({issues:[{file:'../escape.json'},...Array(32).fill({file:'issues/missing.json'}),{file,issue_id:donor.meta.issue_id}]}));assert.equal(loadHistory(args),null);});
}finally{fs.rmSync(dir,{recursive:true,force:true});}
check('clarity calculations identical after fallback, including future hours and conflicts',()=>{
 const day={date:'2026-11-26'},history=h.beaches.dor,selected=chooseHistory([candidate],ctx).history;
 const a=clarityAssessment({day,history,retrievedAt:h.retrieved_at});
 assert.equal(clarityAssessment({day,history:selected.beaches.dor,retrievedAt:selected.retrieved_at}),a);
 assert(a.includes('חזויות'));
 const official=[{valid_from:'2026-11-26 06:00:00',valid_to:'2026-11-26 09:00:00',wave_to_cm:150,wind_speed_to:30}];
 assert(clarityAssessment({day,history,retrievedAt:h.retrieved_at,official}).includes('לא חד־משמעית'));
 assert(clarityAssessment({day}).includes('אין די'));
 const rainy={hourly:history.hourly.map(r=>({...r,rain:1}))};
 assert(clarityAssessment({day,history:rainy,retrievedAt:h.retrieved_at}).includes('אין בסיס לקבוע'));
});
console.log('PASS '+tests+' history-cache regression cases; all fallback invocations are synthetic, no source requests');
