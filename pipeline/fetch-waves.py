#!/usr/bin/env python3
"""Copernicus MED-WAV hourly significant wave forecast, nearest valid sea cell.
No shoreline transformation or cross-model averaging. Writes a fresh cache atomically;
consumer rejects caches older than 3h. Source time is valid time, not model run time.
"""
import json, os, sys, math
from datetime import datetime, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo
import numpy as np

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / 'data'
TZ = ZoneInfo('Asia/Jerusalem')
DATASET = 'cmems_mod_med_wav_anfc_4.2km_PT1H-i'
FIELDS = {'height': 'VHM0', 'direction': 'VMDR', 'period_tm02': 'VTM02'}

def main():
    import copernicusmarine as cm
    u = os.environ.get('COPERNICUSMARINE_SERVICE_USERNAME')
    p = os.environ.get('COPERNICUSMARINE_SERVICE_PASSWORD')
    if not u or not p:
        raise ValueError('missing Copernicus credentials')
    now = datetime.now(TZ)
    start = datetime.combine(now.date(), datetime.min.time(), TZ).astimezone(timezone.utc)
    end = start + timedelta(days=7, hours=-1)
    ds = cm.open_dataset(username=u, password=p, dataset_id=DATASET,
        minimum_longitude=34.2, maximum_longitude=35.4,
        minimum_latitude=31.3, maximum_latitude=33.3,
        start_datetime=start.isoformat(), end_datetime=end.isoformat())
    cube = ds[list(FIELDS.values())].load()
    vals = cube.VHM0.values
    good = np.isfinite(vals).mean(axis=0) >= .9
    lon, lat = np.meshgrid(ds.longitude.values, ds.latitude.values)
    times = [datetime.fromtimestamp(t.astype('datetime64[s]').astype(int), timezone.utc)
             .astimezone(TZ).isoformat(timespec='minutes')[:16] for t in ds.time.values]
    out = {'generated_at': now.isoformat(timespec='seconds'), 'source': {
        'dataset_id': DATASET, 'product_id': 'MEDSEA_ANALYSISFORECAST_WAV_006_017',
        'product_doi': '10.48670/mds-00373', 'model': 'Mediterranean WAM Cycle 6',
        'resolution_deg': 1/24, 'height': 'VHM0: spectral significant wave height Hm0, metres',
        'direction': 'VMDR: direction FROM, degrees clockwise from north',
        'period': 'VTM02: mean period Tm02, seconds; not peak period',
        'selection': 'nearest sea cell with >=90% valid fetched heights; great-circle distance',
        'time_note': 'hourly valid times; retrieval time is not an asserted model initialization time',
        'attribution': 'Generated using E.U. Copernicus Marine Service Information'}, 'beaches': {}}
    for b in json.loads((DATA/'beaches.json').read_text())['beaches']:
        # Haversine distances account for longitude contraction at Israeli latitudes.
        a = np.sin(np.radians(lat-b['lat'])/2)**2 + math.cos(math.radians(b['lat']))*np.cos(np.radians(lat))*np.sin(np.radians(lon-b['lon'])/2)**2
        distances = 6371*2*np.arcsin(np.sqrt(np.clip(a,0,1)))
        masked = np.where(good, distances, np.inf)
        i,j = np.unravel_index(int(np.argmin(masked)), masked.shape)
        if not np.isfinite(masked[i,j]):
            continue
        hourly = []
        for ti,t in enumerate(times):
            r = {'time': t}
            for name,var in FIELDS.items():
                v = float(cube[var].values[ti,i,j])
                r[name] = round(v,3) if math.isfinite(v) else None
            hourly.append(r)
        out['beaches'][b['id']] = {'cell_lat': round(float(lat[i,j]),6),
            'cell_lon': round(float(lon[i,j]),6), 'dist_km': round(float(distances[i,j]),1),
            'hourly': hourly}
    if not out['beaches']:
        raise ValueError('no valid sea cells')
    temp = DATA/'copernicus-waves.json.tmp'
    temp.write_text(json.dumps(out,ensure_ascii=False,indent=1)+'\n')
    temp.replace(DATA/'copernicus-waves.json')
    print(f"Copernicus waves: {len(out['beaches'])} beaches, {len(times)} valid-time slots")

if __name__ == '__main__':
    try:
        main()
    except Exception as e:
        print(f'Copernicus waves failed: {e}',file=sys.stderr)
        sys.exit(1)
