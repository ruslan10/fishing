// Pure time-aligned model comparison. Values never averaged across sources.
export const MODEL_LABELS = {
  copernicus_med: 'Copernicus MED-WAV',
  ecmwf_wam: 'ECMWF WAM',
  ncep_gfswave025: 'GFS Wave',
  open_meteo_best_match: 'Open-Meteo best match'
};
export function readFreshCache(fs, file, now=Date.now()) {
  try {
    const x=JSON.parse(fs.readFileSync(file,'utf8'));
    const age=(now-Date.parse(x.generated_at))/3600000;
    return age>=0 && age<3 && x.beaches ? x : null;
  } catch { return null; }
}
export function modelSummary(series, date) {
  const models=Object.entries(series).map(([id,s])=>{
    const rows=s.hourly.filter(r=>r.time.slice(0,10)===date && Number.isFinite(r.height));
    const v=rows.map(r=>r.height);
    return {id,label:MODEL_LABELS[id]||id,cell_lat:s.cell_lat,cell_lon:s.cell_lon,
      dist_km:s.dist_km??null, hours_valid:v.length, min:v.length?Math.min(...v):null,
      max:v.length?Math.max(...v):null};
  });
  const hours={};
  for(const [id,s] of Object.entries(series)) for(const r of s.hourly) {
    if(r.time.slice(0,10)===date && Number.isFinite(r.height)) (hours[r.time]||={})[id]=r.height;
  }
  const matched=Object.values(hours).filter(r=>Object.keys(r).length>=2);
  const spreads=matched.map(r=>Math.max(...Object.values(r))-Math.min(...Object.values(r)));
  return {models,matched_hours:matched.length,max_spread:spreads.length?+Math.max(...spreads).toFixed(3):null,
    meaning:'largest same-hour height spread among available models; not accuracy, probability or calibrated uncertainty'};
}
export function omSeries(response) {
  return {cell_lat:response?.latitude??null,cell_lon:response?.longitude??null,
    hourly:(response?.hourly?.time||[]).map((time,i)=>({time,height:response.hourly.wave_height?.[i]??null}))};
}
export function choosePrimary(copernicus, fallback, date) {
  const rows=(copernicus?.hourly||[]).filter(r=>r.time.startsWith(date));
  return rows.length>=24 && rows.filter(r=>Number.isFinite(r.height)).length>=22
    ? {id:'copernicus_med',series:copernicus}
    : {id:'open_meteo_best_match',series:fallback};
}
