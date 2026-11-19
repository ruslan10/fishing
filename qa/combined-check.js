const {chromium}=require('playwright-core');
const {spawn}=require('child_process');
(async()=>{
const live=process.env.LIVE==='1';
const server=live?null:spawn('python3',['-m','http.server','8734'],{stdio:'ignore'});
const base=live?'https://ruslan10.github.io/fishing/':'http://127.0.0.1:8734/';
const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});
try{
const page=await browser.newPage({viewport:{width:360,height:820},deviceScaleFactor:1});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto(base,{waitUntil:'networkidle'});
await page.waitForSelector('.model-compare');
await page.locator('.tab[data-region=north]').click();await page.selectOption('.beachsel','dor');
const result=[];
for(const width of [360,390,768,1280]){
 await page.setViewportSize({width,height:900});
 await page.locator('.day[data-day="6"]').click();
 result.push({width,overflow:await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth),days:await page.locator('.day').count(),models:await page.locator('.model-compare').innerText(),weekly:await page.locator('.weekly-wave-scroll').evaluate(e=>({width:e.clientWidth,scrollWidth:e.scrollWidth,curves:e.querySelectorAll('.model-curve').length})),rows:await page.locator('.win tr').count()});
 if(width<=390){await page.screenshot({path:`/downloads/qa-combined-${live?'live':'local'}-${width}-top.png`});await page.locator('.weekly-wavechart').scrollIntoViewIfNeeded();await page.screenshot({path:`/downloads/qa-weekly-${live?'live':'local'}-${width}-start.png`});await page.locator('.weekly-wave-scroll').evaluate(e=>e.scrollLeft=-e.scrollWidth);await page.screenshot({path:`/downloads/qa-weekly-${live?'live':'local'}-${width}-end.png`});await page.locator('.model-compare').scrollIntoViewIfNeeded();await page.screenshot({path:`/downloads/qa-combined-${live?'live':'local'}-${width}-models.png`});await page.locator('.win').scrollIntoViewIfNeeded();await page.screenshot({path:`/downloads/qa-combined-${live?'live':'local'}-${width}-table.png`});}
}
await page.goto(base+'?issue=2026-11-19T11-54-49-a80565',{waitUntil:'networkidle'});
const archive={oldMessage:(await page.locator('body').innerText()).includes('מוצגת הפקה מהארכיון'),comparisons:await page.locator('.model-compare').count(),days:await page.locator('.day').count()};
console.log(JSON.stringify({result,archive,errors},null,2));
}finally{await browser.close();if(server)server.kill();}
})();
