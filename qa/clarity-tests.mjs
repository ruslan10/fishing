import {clarityAssessment as f} from '../fishing-assessment.mjs';import fs from 'node:fs';import assert from 'node:assert/strict';
const j=JSON.parse(fs.readFileSync(new URL('../data/latest.json',import.meta.url)));for(const b of j.beaches)for(const day of b.days){const x=f({day,history:j.environment_history.beaches[b.id],retrievedAt:j.environment_history.retrieved_at});assert(x.includes('הערכת צלילות')||x.includes('אין די'));}
assert(f({day:{date:'2026-11-20'}}).includes('אין די'));
const h=j.environment_history.beaches.dor,day={date:'2026-11-20'};
assert(f({day,history:h,retrievedAt:j.environment_history.retrieved_at}).includes('חזויות'));
assert(f({day,history:h,retrievedAt:j.environment_history.retrieved_at,official:j.ims.regions.north.slots}).includes('לא חד־משמעית'));
const rainy={hourly:h.hourly.map(r=>({...r,rain:1}))};assert(f({day,history:rainy,retrievedAt:j.environment_history.retrieved_at}).includes('אין בסיס לקבוע'));
const wave={hourly:h.hourly.map(r=>({...r,wave:1.1,rain:0}))};assert(f({day,history:wave,retrievedAt:j.environment_history.retrieved_at}).includes('לא חד־משמעית'));
console.log('133clarity cases; missing, forecast, official conflict and non-binary checks pass');
