// Historical experimental wave/wind comparison, not probability or safety.
function waveScore(h) {
  if (h == null) return null;
  if (h < 0.2) return 45;
  if (h < 0.5) return 75;
  if (h <= 1.2) return 100;
  if (h <= 1.8) return 60;
  if (h <= 2.5) return 25;
  return 5;
}
function windScore(kmh, gust) {
  if (kmh == null) return null;
  let s = kmh < 8 ? 95 : kmh < 14 ? 85 : kmh < 20 ? 65 : kmh < 28 ? 40 : 15;
  if (gust != null && gust > 35) s = Math.min(s, 30);
  return s;
}
export function windowScore(waveH, windKmh, gust) {
  const w = waveScore(waveH), v = windScore(windKmh, gust);
  // Withhold inference when an essential factor is missing: a score built from wind alone
  // (or waves alone) looks identical to a full score and would be false confidence.
  if (w == null || v == null) return null;
  return Math.round(0.55 * w + 0.45 * v);
}

// Descriptive equal-weight mean of the historical scores, not model validation.
// Require every hour within each interval; do not fill gaps or select a primary model.
export function modelWindowScore(series, date, w) {
  const from=w.fromHour, to=w.to==='00:00'?24:Number(w.to.slice(0,2));
  const models=[];
  if(!Number.isFinite(w.wind_kmh)||!Number.isFinite(w.gust_kmh))
    return {score:null,models,total:Object.keys(series||{}).length,reason:'wind'};
  for(const [id,s] of Object.entries(series||{})) {
    const byTime=new Map((s.hourly||[]).map(r=>[r.time,r.height]));
    const values=Array.from({length:to-from},(_,i)=>byTime.get(`${date}T${String(from+i).padStart(2,'0')}:00`));
    if(!values.length||values.some(v=>!Number.isFinite(v)))continue;
    const height=values.reduce((a,b)=>a+b,0)/values.length;
    const score=windowScore(height,w.wind_kmh,w.gust_kmh);
    if(score!=null)models.push({id,height,score,hours:values.length});
  }
  return {score:models.length?Math.round(models.reduce((sum,m)=>sum+m.score,0)/models.length):null,
    models,total:Object.keys(series||{}).length,reason:models.length?null:'waves'};
}
