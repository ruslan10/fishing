#!/usr/bin/env python3
"""Quote a small, monthly-cached set of published astronomical predictions.
No website polling: only missing locality/month combinations are requested.
Source terms permit quotation with a backlink, not volume scraping.
"""
import calendar,datetime,json,pathlib,re,time,urllib.request,sys
ROOT=pathlib.Path(__file__).resolve().parents[1]
DATA=ROOT/'data';CACHE=DATA/'tide-cache';CACHE.mkdir(exist_ok=True)
TZ='Asia/Jerusalem'
from zoneinfo import ZoneInfo
now=datetime.datetime.now(datetime.timezone.utc);today=now.astimezone(ZoneInfo(TZ)).date()
months=sorted({(today+datetime.timedelta(days=i)).strftime('%Y-%m') for i in range(7)})
config=json.loads((DATA/'tide-places.json').read_text())
for beach,place in config.items():
 for month in months:
  file=CACHE/(beach+'-'+month+'.json')
  if file.exists():continue
  url=place['source_url']
  try:
   # The ordinary page contains its current month. The public month selector
   # uses the same source URL plus /month/YYYY-MM?v=3 for adjacent months.
   endpoint=url if month==today.strftime('%Y-%m') else url+'/month/'+month+'?v=3'
   req=urllib.request.Request(endpoint,headers={'User-Agent':'FishingForecast/1.0 (monthly tide quotation; no periodic polling)','Accept':'application/json' if '/month/' in endpoint else 'text/html'})
   with urllib.request.urlopen(req,timeout=30) as response:raw=response.read().decode()
   if '/month/' in endpoint:payload=json.loads(raw)
   else:
    match=re.search(r'<script\b[^>]*\bid=[\"\x27]tc-data[\"\x27][^>]*>(.*?)</script>',raw,re.S)
    if not match:raise ValueError('public calendar payload missing')
    payload=json.loads(match.group(1))
    if payload.get('tz')!=TZ or not payload.get('hasTides'):raise ValueError('timezone or tide coverage mismatch')
   rows={}
   for day in payload.get('days',[]):
    date=day['date']
    if not date.startswith(month+'-'):continue
    datetime.date.fromisoformat(date)
    if date in rows:raise ValueError('duplicate date')
    events=[]
    for e in day.get('tides',[]):
     if e['type'] not in ('high','low') or not re.fullmatch(r'(?:[01]\d|2[0-3]):[0-5]\d',e['t']):raise ValueError('invalid event')
     events.append({'type':e['type'],'time':e['t']})
    rows[date]=events
   y,m=map(int,month.split('-'))
   if len(rows)!=calendar.monthrange(y,m)[1]:raise ValueError('incomplete month')
   result={**place,'timezone':TZ,'model':'FES2022','kind':'astronomical_prediction','retrieved_at':now.isoformat(),'acquisition_url':endpoint,'month':month,'days':rows}
   file.write_text(json.dumps(result,ensure_ascii=False,indent=1)+'\n');print('tides cached',beach,month);time.sleep(1)
  except Exception as e:print('Tide source unavailable:',beach,month,str(e),file=sys.stderr)
# No stale cross-date fallback. Missing dates remain explicit in each issue.
