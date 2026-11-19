// Site-defined experimental wave/wind strength scale. Not a safety rating or catch probability.
// Wave endpoints: 100cm belongs to yellow; 200cm belongs to red; 300cm belongs to red.
export const LEVELS = [
 {id:'green',name:'נמוכים',color:'#4fe3a5',ink:'#06251b'},
 {id:'yellow',name:'מתונים',color:'#facc15',ink:'#211b00'},
 {id:'orange',name:'מוגברים',color:'#fb923c',ink:'#281302'},
 {id:'red',name:'חזקים',color:'#f87171',ink:'#280909'},
 {id:'black',name:'חזקים מאוד',color:'#111111',ink:'#ffffff'}
];
export function waveLevel(m){
 if(m==null||!Number.isFinite(m))return null;
 // Classification follows the same rounded cm displayed in the interface.
 const cm=Math.round(m*100);
 return cm<50?0:cm<=100?1:cm<200?2:cm<=300?3:4;
}
export function windLevel(k){
 if(k==null||!Number.isFinite(k))return null;
 k=Math.round(k);
 return k<12?0:k<20?1:k<29?2:k<50?3:4;
}
export function combinedLevel(wave,wind){
 const a=waveLevel(wave),b=windLevel(wind);
 return a==null||b==null?null:Math.max(a,b);
}
export function windowLevel(w){return combinedLevel(w.wave_max??w.wave_height,w.wind_max_kmh??w.wind_kmh);}
export function dayLevel(d){
 const waves=d.windows?.map(w=>w.wave_max??w.wave_height).filter(x=>x!=null)||[];
 const winds=d.windows?.map(w=>w.wind_max_kmh??w.wind_kmh).filter(x=>x!=null)||[];
 return combinedLevel(d.wave_max??(waves.length?Math.max(...waves):null),d.wind_max_kmh??(winds.length?Math.max(...winds):null));
}
