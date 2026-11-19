#!/usr/bin/env python3
"""Freeze daily 00:00 Israel cutoff pressure/SST descriptive model statistics.
Daily files are exclusive-create and never revised. Future valid times are excluded.
A failed fetch leaves prior daily records intact; absence is never called normal.
"""
import json,sys,urllib.request,urllib.parse,importlib.util,time
from pathlib import Path
from datetime import datetime,timedelta,timezone
from zoneinfo import ZoneInfo
ROOT=Path(__file__).resolve().parent.parent;DATA=ROOT/'data';TZ=ZoneInfo('Asia/Jerusalem')
spec=importlib.util.spec_from_file_location('stats',Path(__file__).with_name('change-statistics.py'));stats=importlib.util.module_from_spec(spec);spec.loader.exec_module(stats)
def retrieve(base,beaches,field):
 params={'latitude':','.join(str(b['lat']) for b in beaches),'longitude':','.join(str(b['lon']) for b in beaches),'hourly':field,'past_days':36,'forecast_days':1,'timezone':'GMT'}
 url=base+'?'+urllib.parse.urlencode(params)
 for attempt in range(3):
  try:
   with urllib.request.urlopen(url,timeout=90) as f: rows=json.load(f)
   if not isinstance(rows,list):rows=[rows]
   if len(rows)!=len(beaches):raise ValueError('incomplete beach responses')
   for row in rows:row['hourly']['time']=[t+'+00:00' for t in row['hourly']['time']]
   return rows
  except Exception:
   if attempt==2:raise
   time.sleep(3)
def run():
 now=datetime.now(TZ);day=now.date().isoformat();cutoff=datetime.combine(now.date(),datetime.min.time(),TZ);folder=DATA/'change48';folder.mkdir(exist_ok=True);dest=folder/(day+'.json')
 # Recover immutable daily records from the last issue in fresh CI checkouts.
 try:
  prior=json.loads((DATA/'latest.json').read_text()).get('change48',{}).get('days',{})
  for oldday,record in prior.items():
   old=folder/(oldday+'.json')
   if not old.exists():
    with old.open('x') as f:json.dump(record,f,ensure_ascii=False,indent=1);f.write('\n')
 except (OSError,ValueError):pass
 if not dest.exists():
  beaches=json.loads((DATA/'beaches.json').read_text())['beaches']
  wx=retrieve('https://api.open-meteo.com/v1/forecast',beaches,'pressure_msl');sea=retrieve('https://marine-api.open-meteo.com/v1/marine',beaches,'sea_surface_temperature')
  out={'version':1,'date':day,'cutoff':cutoff.isoformat(),'history_start':(cutoff.astimezone(timezone.utc)-timedelta(hours=48)).astimezone(TZ).isoformat(),'retrieved_at':now.isoformat(),'source_kind':'modeled_recent_past_not_shore_observations','definition':'max absolute signed24h change within preceding48physical hours; unusual strictly above95th interpolated percentile of30prior complete daily-window statistics; not a fish-response threshold','sources':['https://open-meteo.com/en/docs','https://open-meteo.com/en/docs/marine-weather-api'],'beaches':{}}
  for i,b in enumerate(beaches):out['beaches'][b['id']]={key:stats.evaluate(rows[i]['hourly'],field,cutoff.isoformat()) for key,rows,field in [('pressure',wx,'pressure_msl'),('sst',sea,'sea_surface_temperature')]}
  with dest.open('x') as f:json.dump(out,f,ensure_ascii=False,indent=1);f.write('\n')
  print('Frozen daily48h:',day,len(out['beaches']),'beaches')
 else:print('Existing daily48h retained:',day)
 dates={p.stem:json.loads(p.read_text()) for p in sorted(folder.glob('*.json'))[-14:]};temp=DATA/'change48-latest.json.tmp';temp.write_text(json.dumps({'version':1,'days':dates},ensure_ascii=False,indent=1)+'\n');temp.replace(DATA/'change48-latest.json')
if __name__=='__main__':
 try:run()
 except Exception as e:print('daily48h fetch failed; previous records retained:',str(e),file=sys.stderr);sys.exit(1)
