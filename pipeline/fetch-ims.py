#!/usr/bin/env python3
"""Refresh separate current IMS regional forecast. Never edit dated issues."""
import json,urllib.request,pathlib,datetime
ROOT=pathlib.Path(__file__).resolve().parent.parent
def get(url):
 with urllib.request.urlopen(url,timeout=30) as r:return json.load(r)['data']
f=get('https://ims.gov.il/he/coasts_forecasts/');t=get('https://ims.gov.il/he/sea_tools/coasts');regions={};issued=[]
for name,lid in [('north','212'),('center','210'),('south','213')]:
 slots=[]
 for row in f.get(lid,{}).values():
  d=row['data'];issued.append(d['issue_date'])
  n=lambda k:float(str(d[k]).strip()) if str(d.get(k,'')).strip() else None
  slots.append(dict(valid_from=d['valid_from'],valid_to=d['valid_to'],wave_from_cm=n('wave_height_from'),wave_to_cm=n('wave_height_to'),wind_speed_from=n('wind_speed_from'),wind_speed_to=n('wind_speed_to'),wind_dir_from=n('wind_dir_from'),wind_dir_to=n('wind_dir_to'),sea_temp=n('sea_temp'),sea_state_he=t['sea_state'].get(d['sea_state'].strip())))
 if slots:regions[name]={'name_he':t['sea_locations'][lid]['name'].strip(),'slots':sorted(slots,key=lambda x:x['valid_from'])}
if len(regions)!=3:raise RuntimeError('IMS incomplete, previous snapshot retained')
content={'available':True,'issued_at':max(issued),'checked_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'source_url':'https://ims.gov.il/he/coasts','regions':regions}
p=ROOT/'data/ims-latest.json';tmp=p.with_suffix('.tmp');tmp.write_text(json.dumps(content,ensure_ascii=False,indent=1)+'\n');tmp.replace(p)
print('IMS updated:',content['issued_at'],len(regions),'regions')
# Separate map manifest: retained independently if a coastal refresh later replaces its file.
m=get('https://ims.gov.il/he/model_maps/S');runs=m['model_map']['waves'];run=max(runs)
frames=runs[run]['dom1']['Waves Height & Direction']['totalHgt']['Z-2']
legend=get('https://ims.gov.il/he/color_bars/1')['totalHgt']
if not frames:raise RuntimeError('IMS maps missing, prior map snapshot retained')
mapdata={'available':True,'checked_at':content['checked_at'],'run_utc':run,'source_url':'https://ims.gov.il/he/SeaModelMaps','model':'IFS - ECMWF','domain_he':m['areas']['dom1'],'legend':sorted([{'mark':float(v['mark']),'color':v['color']} for v in legend['items'].values()],key=lambda v:v['mark']),'frames':[{'valid_utc':t,'url':'https://ims.gov.il'+u} for t,u in sorted(frames.items())]}
p=ROOT/'data/ims-maps.json';tmp=p.with_suffix('.tmp');tmp.write_text(json.dumps(mapdata,ensure_ascii=False,indent=1)+'\n');tmp.replace(p)
print('IMS maps updated:',run,len(frames),'frames through',max(frames),'UTC')
