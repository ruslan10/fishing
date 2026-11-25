import fs from 'node:fs';
import path from 'node:path';

const TTL=3*3600000;
const TZ='Asia/Jerusalem';
export function sameLocations(a,b){
 return Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&new Set(a.map(x=>x.id)).size===a.length&&a.every(x=>b.some(y=>y.id===x.id&&y.lat===x.lat&&y.lon===x.lon));
}
function localDate(ms){return new Intl.DateTimeFormat('sv-SE',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(ms));}
export function validHistory(h,{now,beaches}){
 if(!h||h.source_kind!=='modeled_recent_past_not_observations')return false;
 const retrieved=Date.parse(h.retrieved_at),cutoff=Date.parse(h.cutoff),date=localDate(now);
 if(!Number.isFinite(retrieved)||now-retrieved<0||now-retrieved>=TTL||h.date!==date||!Number.isFinite(cutoff))return false;
 // Check the exact Jerusalem midnight instant, including offset changes.
 const midnight=new Intl.DateTimeFormat('sv-SE',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).format(new Date(cutoff));
 if(midnight!==date+' 00:00:00'||!h.beaches||Object.keys(h.beaches).length!==beaches.length)return false;
 return beaches.every(b=>{
  const row=h.beaches[b.id];
  if(!row||!Array.isArray(row.hourly)||!row.hourly.length)return false;
  let previous=-Infinity;
  for(const r of row.hourly){const t=Date.parse(r.time);if(!Number.isFinite(t)||t<=previous||![r.wave,r.wind,r.rain].every(v=>v===null||Number.isFinite(v)))return false;previous=t;}
  return ['wave','wind'].every(k=>{const s=row[k];return s&&s.expected===48&&Number.isInteger(s.valid)&&s.valid>=0&&s.valid<=48&&(s.max===null||Number.isFinite(s.max));});
 });
}
export function chooseHistory(candidates,context){
 const valid=candidates.filter(c=>sameLocations(c.beaches,context.beaches)&&validHistory(c.history,context));
 valid.sort((a,b)=>Date.parse(b.history.retrieved_at)-Date.parse(a.history.retrieved_at)||Number(b.fresh)-Number(a.fresh));
 return valid[0]??null;
}
function read(file){try{return JSON.parse(fs.readFileSync(file,'utf8'));}catch{return null;}}
export function loadHistory({dataDir,beaches,now=Date.now(),freshFetch=false,log=console.log}){
 const cache=read(path.join(dataDir,'environment-history.json'));
 const candidates=[];
 if(freshFetch)candidates.push({history:cache,beaches,fresh:true,source:'fresh cache'});
 const index=read(path.join(dataDir,'archive-index.json'));
 // Bounded local reads only. Never fetch a source or modify an archived issue.
 for(const item of (index?.issues??[]).slice(0,32)){
  if(!/^issues\/[0-9T-]+-[a-f0-9]+\.json$/.test(item.file??''))continue;
  const issue=read(path.join(dataDir,item.file));
  if(!issue||!sameLocations(issue.snapshot?.beaches,beaches))continue;
  candidates.push({history:issue.environment_history,beaches:issue.snapshot.beaches,source:item.issue_id});
  // A failed-fetch local cache has no coordinate metadata of its own. Require
  // a matching archived copy to establish its configuration provenance.
  if(cache&&JSON.stringify(cache)===JSON.stringify(issue.environment_history))candidates.push({history:cache,beaches:issue.snapshot.beaches,source:'validated cache via '+item.issue_id});
 }
 const selected=chooseHistory(candidates,{now,beaches});
 if(selected)log('environment history selected: '+selected.source+'; original retrieval '+selected.history.retrieved_at);
 else log('environment history unavailable: no eligible fresh cache or local issue');
 return selected?.history??null;
}
