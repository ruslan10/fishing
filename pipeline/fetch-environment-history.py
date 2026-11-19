#!/usr/bin/env python3
"""48h recent model wave/wind evidence, not official storm classification."""
import importlib.util,json,urllib.request,urllib.parse
from pathlib import Path
from datetime import datetime,timedelta,timezone
from zoneinfo import ZoneInfo
R=Path(__file__).resolve().parent.parent;TZ=ZoneInfo('Asia/Jerusalem');b=json.loads((R/'data/beaches.json').read_text())['beaches'];now=datetime.now(TZ);end=datetime.combine(now.date(),datetime.min.time(),TZ).astimezone(timezone.utc)
def get(base,field):
 q={'latitude':','.join(str(x['lat']) for x in b),'longitude':','.join(str(x['lon']) for x in b),'hourly':field,'past_days':3,'forecast_days':1,'timezone':'GMT'}
 with urllib.request.urlopen(base+'?'+urllib.parse.urlencode(q),timeout=90) as f:return json.load(f)
w=get('https://api.open-meteo.com/v1/forecast','wind_speed_10m');m=get('https://marine-api.open-meteo.com/v1/marine','wave_height');out={'retrieved_at':now.isoformat(),'date':now.date().isoformat(),'cutoff':end.astimezone(TZ).isoformat(),'source_kind':'modeled_recent_past_not_observations','beaches':{}}
for i,x in enumerate(b):
 row={}
 for key,rows,field in [('wave',m,'wave_height'),('wind',w,'wind_speed_10m')]:
  h=rows[i]['hourly'];v=[v for t,v in zip(h['time'],h[field]) if end-timedelta(hours=48)<=datetime.fromisoformat(t).replace(tzinfo=timezone.utc)<end];valid=[v for v in v if v is not None];row[key]={'valid':len(valid),'expected':48,'max':max(valid) if len(valid)==48 else None}
 out['beaches'][x['id']]=row
p=R/'data/environment-history.json';p.write_text(json.dumps(out,ensure_ascii=False,indent=1)+'\n');print('environment history',out['date'],len(b),'beaches')
