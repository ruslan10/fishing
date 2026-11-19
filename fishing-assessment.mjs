// Descriptive morning assessment, not catch probability or safety advice.
function assessment({day,series={},official=[],stale=false}){
 if(stale)return 'הערכת הבוקר אינה עדכנית, נתוני החוף נשענים על הפקה קודמת.';
 const w=day?.windows?.find(x=>x.fromHour===6);
 const complete=Object.values(series).map(s=>(s.hourly||[]).filter(r=>r.time>=day.date+'T06:00'&&r.time<day.date+'T09:00'&&Number.isFinite(r.height))).filter(rows=>rows.length===3&&new Set(rows.map(r=>r.time)).size===3);
 const heights=complete.flatMap(rows=>rows.map(r=>r.height));
 if(!w||!Number.isFinite(w.wind_min_kmh)||!Number.isFinite(w.wind_max_kmh)||heights.length<3)return 'אין די נתוני בוקר להערכת דיג ליום זה.';
 const lo=Math.round(Math.min(...heights)*100),hi=Math.round(Math.max(...heights)*100),wind=Math.round(w.wind_max_kmh);
 const fmt=(a,b)=>a===b?`${a}`:`${a}–${b}`;
 const slots=official.filter(s=>s.valid_from<day.date+' 09:00:00'&&s.valid_to>day.date+' 06:00:00');
 const nums=`ב־06:00–09:00 ${complete.length>1?'המודלים מציגים':'המודל הזמין מציג'} גלים ${fmt(lo,hi)} ס״מ ורוח עד ${wind} קמ״ש`;
 const officialHi=slots.length?Math.max(...slots.map(s=>s.wind_speed_to).filter(Number.isFinite)):null;
 if(Number.isFinite(officialHi)&&officialHi>Math.max(w.wind_max_kmh*1.5,w.wind_max_kmh+5))return nums+`, אך IMS האזורי צופה רוח עד ${Math.round(officialHi)} קמ״ש. לז׳ירז׳ור, להיערך לרוח חזקה יותר ולא לבנות על ים חלק.`;
 if(hi>150||wind>=29)return nums+'. התנאים עלולים להקשות על הטלה ושליטה בדמוי, ואין מכך תחזית לפעילות הדגים.';
 if(hi<=100&&wind<20)return nums+'. תנאים מתונים יחסית להטלה ולעבודה עם דמוי, אך לא סימן מוכח לאכילה מוגברת.';
 return nums+'. להתאים את משקל הדמוי והעבודה לרוח ולגלים בפועל, בלי להסיק מכך סיכויי תפיסה.';
}

export function fishingAssessment(input){return assessment(input).replace(/[0-9][0-9:–.,]*/g,n=>"\u2066"+n+"\u2069");}
