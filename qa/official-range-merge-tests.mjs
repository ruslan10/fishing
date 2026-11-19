import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const start=html.indexOf('function officialWindow('),end=html.indexOf('\n  let archive',start);
const base={wave_from_cm:50,wave_to_cm:80,wind_speed_to:10,sea_state_he:'גלי'};
const slot=(a,b,more={})=>({...base,valid_from:'2026-11-20 '+a+':00',valid_to:'2026-11-20 '+b+':00',...more});
function run(slots){const ctx={issueParam:null,nowIL:()=>({date:'2026-11-19',hour:19}),officialIMS:{regions:{center:{slots}}}};vm.createContext(ctx);vm.runInContext(html.slice(start,end),ctx);return ctx.officialWindow('center',{date:'2026-11-20'},{from:'06:00',to:'09:00'});}
let r=run([slot('00:00','08:00'),slot('08:00','20:00')]);assert.equal(r.parts,null);assert.equal(r.wave_from_cm,50);assert.equal(r.wave_to_cm,80);
r=run([slot('00:00','08:00'),slot('08:00','20:00',{wave_to_cm:100})]);assert.equal(r.parts.length,2);assert.equal(r.parts[0].overlap_to,'2026-11-20 08:00:00');assert.equal(r.parts[1].wave_to_cm,100);
assert.equal(run([slot('06:00','07:00'),slot('08:00','09:00')]),null);
r=run([slot('06:00','07:00'),slot('07:00','08:00'),slot('08:00','09:00',{wave_from_cm:60})]);assert.equal(r.parts.length,2);assert.equal(r.parts[0].overlap_to,'2026-11-20 08:00:00');
console.log('PASS identical consecutive ranges merge; different values/gaps/partial merges retain meaning');
