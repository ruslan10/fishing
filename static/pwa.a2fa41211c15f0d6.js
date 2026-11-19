let installPrompt=null;
const standalone=()=>matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();installPrompt=event;});
window.addEventListener('appinstalled',()=>{installPrompt=null;document.querySelectorAll('.pwa-install').forEach(b=>b.hidden=true);});
document.addEventListener('click',async event=>{
 if(!event.target.closest('.pwa-install'))return;
 if(installPrompt){const prompt=installPrompt;installPrompt=null;await prompt.prompt();await prompt.userChoice;return;}
 let dialog=document.querySelector('#pwa-help');
 if(!dialog){
  dialog=document.createElement('dialog');dialog.id='pwa-help';dialog.className='wind-dialog';dialog.setAttribute('aria-labelledby','pwa-title');
  const ios=/iPhone|iPad|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
  dialog.innerHTML=`<h2 id="pwa-title">התקנה למסך הבית</h2><p>${ios?'ב־Safari, פתח את תפריט השיתוף, בחר ״הוספה למסך הבית״ ואשר.':'פתח את תפריט הדפדפן ובחר ״התקנת אפליקציה״ או ״הוספה למסך הבית״, אם האפשרות זמינה.'}</p><p style="font-size:12px;opacity:.7">אם האפשרות לא מופיעה, פתח את הקישור ב־Safari באייפון או ב־Chrome באנדרואיד. להצגת תחזית עדכנית נדרש חיבור לאינטרנט.</p><form method="dialog"><button>סגירה</button></form>`;document.body.append(dialog);
 }
 dialog.showModal();
});
function status(){
 document.querySelectorAll('.pwa-install').forEach(b=>b.hidden=standalone());
 let banner=document.getElementById('pwa-offline');
 if(!navigator.onLine&&!banner){banner=document.createElement('div');banner.id='pwa-offline';banner.setAttribute('role','status');banner.textContent='אין חיבור לרשת. הנתונים שעל המסך לא מתעדכנים.';document.body.prepend(banner);}
 if(navigator.onLine&&banner)banner.remove();
}
new MutationObserver(status).observe(document.getElementById('app'),{childList:true});
addEventListener('offline',status);addEventListener('online',status);status();
if('serviceWorker' in navigator){
 navigator.serviceWorker.register('./sw.js',{scope:'./',updateViaCache:'none'}).then(reg=>{
  reg.update().catch(()=>{});
  addEventListener('focus',()=>{if(navigator.onLine)reg.update().catch(()=>{});});
 }).catch(error=>console.warn('Home-screen support unavailable:',error.message));
}
