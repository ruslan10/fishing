import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
export function loadTides(root){
 const run=spawnSync('python3',[path.join(root,'pipeline/fetch-tides.py')],{encoding:'utf8',timeout:180000});
 if(run.stdout)console.log(run.stdout.trim());
 if(run.stderr)console.error(run.stderr.trim());
 if(run.error||run.status)console.error('Tide cache acquisition failed; individual cached dates only will be used.');
 const cfg=JSON.parse(fs.readFileSync(path.join(root,'data/tide-places.json'),'utf8'));
 return (beach,date)=>{
  const place=cfg[beach];
  if(!place)return {available:false,reason:'no_matching_locality'};
  try{
   const c=JSON.parse(fs.readFileSync(path.join(root,'data/tide-cache',`${beach}-${date.slice(0,7)}.json`),'utf8'));
   if(c.timezone!=='Asia/Jerusalem'||c.source_url!==place.source_url||!Object.hasOwn(c.days,date))throw Error('date or source mismatch');
   const events=c.days[date];
   if(!Array.isArray(events)||events.some(e=>!['high','low'].includes(e.type)||!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(e.time)))throw Error('invalid events');
   return {available:true,events,proxy:!!place.proxy,source_area_he:place.source_area_he??null,timezone:c.timezone,source_url:c.source_url,source_place:c.source_place,source_lat:c.lat,source_lon:c.lon,reference_distance_km:c.reference_distance_km,model:c.model,kind:c.kind,retrieved_at:c.retrieved_at,coverage_note_he:'תחזית אסטרונומית לאזור היישוב, לא מדידה בנקודת החוף'};
  }catch{return {available:false,reason:'source_date_unavailable'};}
 };
}
