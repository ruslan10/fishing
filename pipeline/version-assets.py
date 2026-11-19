#!/usr/bin/env python3
"""Content-address local browser assets. Keep historical output for cached HTML."""
from pathlib import Path
import hashlib,json,re
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'static';OUT.mkdir(exist_ok=True)
MAN=ROOT/'asset-manifest.json'
old=json.loads(MAN.read_text()) if MAN.exists() else {'assets':{}}
reverse={v:k for k,v in old['assets'].items()}
assets={};visiting=set()
# Browser asset references only. Never version/modify forecast JSON or archives.
SUFFIX={'.mjs','.js','.css','.png','.jpg','.jpeg','.webp','.gif','.svg','.ico','.woff','.woff2'}
def resolve(value,owner):
    if value.startswith('https://ruslan10.github.io/fishing/'):
        value=value.removeprefix('https://ruslan10.github.io/fishing/')
    if value.startswith(('http:','https:','data:','#','//','/')):return None
    raw=value.split('?',1)[0].split('#',1)[0]
    if raw in reverse:raw=reverse[raw]
    path=(ROOT/owner).parent/raw
    try:key=path.resolve().relative_to(ROOT.resolve()).as_posix()
    except ValueError:raise RuntimeError('Asset escapes root')
    if key.startswith(('data/','node_modules/','mockups/','qa/','pipeline/')):return None
    if Path(key).suffix.lower() not in SUFFIX:return None
    if not (ROOT/key).is_file():raise RuntimeError('Missing browser asset: '+key)
    return key
# Match imports/exports, dynamic import(), HTML src/href/content and CSS url().
PATTERNS=[re.compile(r'(?P<lead>\b(?:from\s*|import\s*\(\s*|import\s*)[\"\x27])(?P<value>[^\"\x27]+)(?P<tail>[\"\x27])'),re.compile(r'(?P<lead>\b(?:src|href|content)=[\"\x27])(?P<value>[^\"\x27]+)(?P<tail>[\"\x27])'),re.compile(r'(?P<lead>url\(\s*[\"\x27]?)(?P<value>[^)\"\x27]+)(?P<tail>[\"\x27]?\s*\))')]
def rewrite(text,owner,output_owner):
    import posixpath
    for pattern in PATTERNS:
        def sub(m):
            key=resolve(m['value'],owner)
            if not key:return m.group(0)
            target=emit(key)
            # OG image URLs stay absolute and therefore are not rewritten here.
            relative=posixpath.relpath(target,posixpath.dirname(output_owner) or '.')
            if not relative.startswith('.'):relative='./'+relative
            if m['value'].startswith('https://ruslan10.github.io/fishing/'):
                relative='https://ruslan10.github.io/fishing/'+target
            if '#' in m['value']:relative+='#'+m['value'].split('#',1)[1]
            return m['lead']+relative+m['tail']
        text=pattern.sub(sub,text)
    return text

def emit(key):
    if key in assets:return assets[key]
    if key in visiting:raise RuntimeError('Circular asset dependency requires bundling: '+key)
    visiting.add(key);raw=(ROOT/key).read_bytes()
    if Path(key).suffix in {'.mjs','.js','.css'}:raw=rewrite(raw.decode(),key,'static/output').encode()
    digest=hashlib.sha256(raw).hexdigest()[:16]
    target='static/'+Path(key).stem+'.'+digest+Path(key).suffix
    path=ROOT/target
    if path.exists() and path.read_bytes()!=raw:raise RuntimeError('Hash collision')
    path.write_bytes(raw);assets[key]=target;visiting.remove(key);return target

p=ROOT/'index.html';html=p.read_text()
# Normalize prior output references so repeated builds read current source files.
for target,key in reverse.items():html=html.replace('./'+target,key).replace(target,key)
html=re.sub(r'\n<script id="release-check">[\s\S]*?</script>\n','\n',html)
html=rewrite(html,'index.html','index.html')
html=html.split('</head>',1)[0].rstrip()+'\n</head>'+html.split('</head>',1)[1]
# Build id covers inline application code, original asset graph and release checker.
checker="""
<script id="release-check">
(()=>{
 const current='__RELEASE__';let checking=false;
 async function check(){
  if(checking||document.hidden||document.querySelector('dialog[open]')||!navigator.onLine)return;
  checking=true;
  try{
   const r=await fetch('release.json?t='+Date.now(),{cache:'no-store'});
   if(!r.ok)return;
   const next=await r.json();
   if(next.version&&next.version!==current){
    // A distinct entry URL bypasses a cached HTML response while preserving selection/archive params.
    const u=new URL(location.href);if(u.searchParams.get('_release')===next.version)return;try{sessionStorage.setItem('fishing.releaseView',JSON.stringify({date:document.querySelector('.day.sel')?.dataset.date,scroll:scrollY}));}catch(e){}u.searchParams.set('_release',next.version);location.replace(u);
   }
  }catch(e){}finally{checking=false;}
 }
 addEventListener('focus',check);document.addEventListener('visibilitychange',check);
 setInterval(check,300000);check();
})();
</script>
"""
# Ignore the internal cache-bypass query: it never affects content or share canonical URL.
version=hashlib.sha256((html+checker).encode()).hexdigest()[:20]
html=html.replace('</head>',checker.replace('__RELEASE__',version)+'</head>')
p.write_text(html)
MAN.write_text(json.dumps({'version':version,'assets':dict(sorted(assets.items()))},indent=2)+'\n')
(ROOT/'release.json').write_text(json.dumps({'version':version})+'\n')
print(json.dumps({'version':version,'assets':assets,'historical_files_retained':True}))
