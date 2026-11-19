/* No forecast or HTML caches: never show an old forecast as an offline result. */
const OFFLINE=`<!doctype html><html lang="he" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#071827"><title>תחזית דייג</title><style>body{margin:0;background:#071827;color:#e2e8f0;font:16px/1.8 system-ui,sans-serif;min-height:100dvh;display:grid;place-items:center}main{max-width:300px;padding:28px;text-align:center}h1{font-size:25px}p{color:#a7b8c6}a{display:inline-block;margin-top:15px;border-radius:10px;background:#26bfd0;color:#071827;text-decoration:none;padding:10px 22px;font-weight:700}</style><main><h1>אין חיבור לאינטרנט</h1><p>כדי להציג תחזית עדכנית, צריך להתחבר לרשת.</p><a href="" onclick="location.reload();return false">ניסיון נוסף</a></main></html>`;
self.addEventListener('install',event=>event.waitUntil(self.skipWaiting()));
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('fetch',event=>{
 const url=new URL(event.request.url);
 if(url.origin!==self.location.origin||event.request.method!=='GET')return;
 const base=new URL('./',self.location.href).pathname;
 if(event.request.mode==='navigate'){
  event.respondWith(fetch(event.request,{cache:'no-store'}).catch(()=>new Response(OFFLINE,{status:503,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'}})));
 }else if(url.pathname.startsWith(base+'data/')||url.pathname===base+'release.json'||url.pathname.endsWith('.webmanifest')){
  event.respondWith(fetch(event.request,{cache:'no-store'}));
 }
});
