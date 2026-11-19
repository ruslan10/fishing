"""Descriptive change statistics, not fish-response model. No site writes."""
import json,math
from datetime import datetime,timedelta,timezone
from pathlib import Path
from zoneinfo import ZoneInfo
TZ=ZoneInfo('Asia/Jerusalem')
def utc(t):
 d=datetime.fromisoformat(t)
 return (d.replace(tzinfo=TZ) if d.tzinfo is None else d).astimezone(timezone.utc)
def quantile(x,q):
 x=sorted(x);i=(len(x)-1)*q;a=int(i);return x[a]+(x[min(a+1,len(x)-1)]-x[a])*(i-a)
def stat(h,key,end):
 end=utc(end);start=end-timedelta(hours=48);points={utc(t):v for t,v in zip(h['time'],h[key])}
 times=[start+timedelta(hours=i) for i in range(48)];vals=[points.get(t) for t in times]
 if any(v is None or not math.isfinite(v) for v in vals):return {'available':False,'valid':sum(v is not None for v in vals),'expected':48}
 pairs=[(round(vals[i]-vals[i-24],6),times[i-24],times[i]) for i in range(24,48)]
 delta,frm,to=max(pairs,key=lambda x:abs(x[0]))
 return {'available':True,'valid':48,'expected':48,'max_abs_change_24h':abs(delta),'signed_change_24h':delta,'from':frm.astimezone(TZ).isoformat(),'to':to.astimezone(TZ).isoformat(),'range48':max(vals)-min(vals)}
def evaluate(h,key,end):
 r=stat(h,key,end)
 if not r['available']:return r
 cutoff=utc(end)
 # 30 historical statistics, ending no later than the recent window starts.
 # UTC24h steps maintain physical intervals; DST-aware time comparisons avoid duplicate-hours.
 refs=[stat(h,key,(cutoff-timedelta(days=i)).isoformat()) for i in range(2,37)]
 refs=[x['max_abs_change_24h'] for x in refs if x['available']][:30]
 r.update(reference_n=len(refs),reference_description='30 prior complete daily 48h windows, searched2..36days before cutoff; same UTC hour; incomplete windows skipped')
 if len(refs)==30:
  q=quantile(refs,.95);r.update(q95=q,unusual_relative_to_month=r['max_abs_change_24h']>q+1e-6,reference_percentile=100*sum(v<r['max_abs_change_24h'] for v in refs)/30)
 else:r.update(q95=None,unusual_relative_to_month=None)
 return r
