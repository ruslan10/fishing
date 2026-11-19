try{document.documentElement.dataset.theme=localStorage.getItem('fishing.theme')==='light'?'light':'dark';}catch{document.documentElement.dataset.theme='dark';}
function syncTheme(){
 const light=document.documentElement.dataset.theme==='light';
 document.querySelectorAll('.theme-toggle').forEach(button=>{button.textContent=light?'☾':'☀';button.setAttribute('aria-label',light?'מעבר למצב כהה':'מעבר למצב בהיר');button.setAttribute('aria-pressed',String(light));});
 document.querySelector('meta[name="theme-color"]')?.setAttribute('content',light?'#f2f6fa':'#071827');
}
document.addEventListener('click',event=>{if(!event.target.closest('.theme-toggle'))return;const next=document.documentElement.dataset.theme==='light'?'dark':'light';document.documentElement.dataset.theme=next;try{localStorage.setItem('fishing.theme',next);}catch{}syncTheme();});
document.addEventListener('DOMContentLoaded',()=>{new MutationObserver(syncTheme).observe(document.getElementById('app'),{childList:true});syncTheme();});
