import fs from 'node:fs';
import assert from 'node:assert/strict';
const latest=JSON.parse(fs.readFileSync(new URL('../data/latest.json',import.meta.url)));
const min=s=>{const [h,m]=s.split(':').map(Number);return h*60+m;};
let count=0;
for(const b of latest.beaches)for(const d of b.days){
 assert.equal(d.first_light_adjustment_minutes,-20);
 if(d.civil_dawn==null)assert.equal(d.first_light,null);
 else{assert.equal((min(d.civil_dawn)-min(d.first_light)+1440)%1440,20);count++;}
 assert.match(d.first_light_definition,/not astronomical dawn/);
}
const pipeline=fs.readFileSync(new URL('../pipeline/fetch-data.mjs',import.meta.url),'utf8');
assert.match(pipeline,/const civilDawn = civilTwilight/);
assert.match(pipeline,/first_light: civilDawn==null\?null:minToHhmm\(hhmmToMin\(civilDawn\)-20\)/);
console.log(`PASS ${count} adjusted first-light times, baseline retained and one non-accumulating -20-minute offset`);
