import {clarityAssessment as f} from '../fishing-assessment.mjs';
import fs from 'node:fs';
import assert from 'node:assert/strict';
// Stable archived fixture, never a rolling date paired with today's history.
const j=JSON.parse(fs.readFileSync(new URL('../data/issues/2026-11-25T05-01-26-ef6b55.json',import.meta.url)));
for(const b of j.beaches)for(const day of b.days){
 const x=f({day,history:j.environment_history.beaches[b.id],retrievedAt:j.environment_history.retrieved_at});
 assert(x.includes('הערכת צלילות')||x.includes('אין די'));
}
const day={date:'2026-11-26'},h=j.environment_history.beaches.dor,retrievedAt=j.environment_history.retrieved_at;
assert(f({day}).includes('אין די'));
assert(f({day,history:h,retrievedAt}).includes('חזויות'));
const official=[{valid_from:'2026-11-26 06:00:00',valid_to:'2026-11-26 09:00:00',wind_speed_to:30,wave_to_cm:150}];
assert(f({day,history:h,retrievedAt,official}).includes('לא חד־משמעית'));
const rainy={hourly:h.hourly.map(r=>({...r,rain:1}))};
assert(f({day,history:rainy,retrievedAt}).includes('אין בסיס לקבוע'));
const wave={hourly:h.hourly.map(r=>({...r,wave:1.1,rain:0}))};
assert(f({day,history:wave,retrievedAt}).includes('לא חד־משמעית'));
console.log('133 fixed-fixture clarity cases; missing, forecast, official conflict and non-binary checks pass');
