import {fishingAssessment as f} from '../fishing-assessment.mjs';import fs from 'node:fs';import assert from 'node:assert/strict';
const j=JSON.parse(fs.readFileSync(new URL('../data/latest.json',import.meta.url)));
for(const b of j.beaches)for(const day of b.days){const x=f({day,series:b.wave_provenance.model_series});assert(x.length<310);assert(!/8\.5|צלול|סיכוי גבוה|אכילה בשעה/.test(x));}
assert(f({day:{windows:[]}}).includes('אין די'));assert(f({stale:true}).includes('אינה עדכנית'));
const b=j.beaches.find(b=>b.id==='dor'),day=b.days[1];const x=f({day,series:b.wave_provenance.model_series,official:j.ims.regions.north.slots});assert(x.includes('IMS'));assert(x.includes('25'));assert(x.includes('\u2066'));
console.log('133beach-day assessments; missing, stale, source conflict and RTL isolation passed');
