const {chromium}=require('playwright-core'),{spawn}=require('child_process');
(async()=>{
const s=process.env.LIVE?null:spawn('python3',['-m','http.server','8736'],{stdio:'ignore'});
const b=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});
try{
 const p=await b.newPage({viewport:{width:390,height:900}});
 await p.goto(process.env.LIVE?'https://ruslan10.github.io/fishing/':'http://127.0.0.1:8736/',{waitUntil:'networkidle'});
 await p.locator('.tab[data-region=north]').click();await p.selectOption('.beachsel','dor');await p.locator('.day[data-day="1"]').click();
 const result=await p.evaluate(()=>[document.querySelector('.day.sel .day-wind-arrow'),document.querySelector('.hero .v svg')].map(e=>{
  const svg=e.tagName.toLowerCase()==='svg'?e:e.querySelector('svg'),g=svg.querySelector('g'),m=g.transform.baseVal.consolidate().matrix,tip=new DOMPoint(12,4.5).matrixTransform(m),dx=tip.x-12,dy=tip.y-12;
  return {title:e.title,rotation:g.getAttribute('transform'),tip:{dx,dy},compassDegrees:(Math.atan2(dx,-dy)*180/Math.PI+360)%360};
 }));
 console.log(JSON.stringify(result,null,2));
 await p.screenshot({path:`/downloads/qa-selected-arrow-${process.env.LIVE?'live':'local'}.png`});
}finally{await b.close();if(s)s.kill()}
})();
