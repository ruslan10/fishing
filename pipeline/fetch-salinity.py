#!/usr/bin/env python3
"""תחזית דייג - שלב מליחות (Copernicus Marine).

Fetches hourly sea-surface salinity (dataset cmems_mod_med_phy-sal_anfc_4.2km-2D_PT1H-m,
product MEDSEA_ANALYSISFORECAST_PHY_006_013, NEMO 4.2, 1/24 degree ~ 4 km) for the
Israeli coast bounding box and writes data/salinity.json.

Per beach we use the NEAREST VALID SEA CELL (a cell non-NaN for >= 90% of the fetched
hours). The grid is ~4 km, so the representative cell sits 1.6-5 km offshore: every
value is a MODELED NEAR-SHORE value, never an in-situ beach measurement. The cell
coordinates and its distance from the beach are written per beach and shown on the site.

Per local day (Asia/Jerusalem) we compute true hourly extrema (min/max) plus the mean
and the actual valid-time coverage (hours_valid out of hours in that day's slice that
fall inside the fetched axis). Nothing is invented: days or beaches without coverage
are simply absent, and the node pipeline renders them as missing.

Credentials come from COPERNICUSMARINE_SERVICE_USERNAME / COPERNICUSMARINE_SERVICE_PASSWORD
(GitHub Actions secrets in CI, local vault files in manual runs). On any failure the
script exits non-zero and writes nothing; the main pipeline then keeps salinity as
missing rather than failing the whole refresh.

License: Copernicus Marine Service licence (free of charge until at least 30 Jun 2028)
permits derivative works + redistribution with clearly visible credit. The site footer
carries "Generated using E.U. Copernicus Marine Service Information" and the product DOI.
"""
import json
import os
import sys
import subprocess
from datetime import datetime, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
TZ = ZoneInfo("Asia/Jerusalem")
DATASET_ID = "cmems_mod_med_phy-sal_anfc_4.2km-2D_PT1H-m"
PRODUCT_ID = "MEDSEA_ANALYSISFORECAST_PHY_006_013"
PRODUCT_DOI = "10.48670/mds-00359"
MIN_VALID_FRACTION = 0.90  # cell must hold data for this share of fetched hours


def main() -> int:
    if not os.environ.get("COPERNICUSMARINE_SERVICE_USERNAME") or not os.environ.get(
        "COPERNICUSMARINE_SERVICE_PASSWORD"
    ):
        print("salinity: missing Copernicus credentials in env", file=sys.stderr)
        return 1

    import copernicusmarine as cm

    beaches = json.loads((DATA / "beaches.json").read_text(encoding="utf8"))
    items = beaches if isinstance(beaches, list) else beaches.get("beaches", beaches)

    now_local = datetime.now(TZ)
    day0 = now_local.date()
    days = [(day0 + timedelta(days=i)).isoformat() for i in range(7)]
    start_utc = datetime.combine(day0, datetime.min.time(), TZ).astimezone(timezone.utc)
    end_utc = start_utc + timedelta(days=7)

    ds = cm.open_dataset(
        username=os.environ["COPERNICUSMARINE_SERVICE_USERNAME"],
        password=os.environ["COPERNICUSMARINE_SERVICE_PASSWORD"],
        dataset_id=DATASET_ID,
        minimum_longitude=34.2,
        maximum_longitude=35.4,
        minimum_latitude=31.3,
        maximum_latitude=33.3,
        start_datetime=start_utc.isoformat(),
        end_datetime=end_utc.isoformat(),
    )
    lat = ds.latitude.values
    lon = ds.longitude.values
    LON, LAT = np.meshgrid(lon, lat)
    cube = ds["so"].load()
    times = cube.time.values  # UTC, hourly

    # Local day index for each fetched hour (-1 when outside the 7 display days).
    t_local = [
        datetime.fromtimestamp(t.astype("datetime64[s]").astype(int), timezone.utc).astimezone(TZ)
        for t in times
    ]
    day_index = {d: i for i, d in enumerate(days)}
    t_day = np.array([day_index.get(t.date().isoformat(), -1) for t in t_local])

    vals = cube.values  # (time, lat, lon)
    valid_frac = (~np.isnan(vals)).mean(axis=0)
    good = valid_frac >= MIN_VALID_FRACTION

    out = {"generated_at": now_local.isoformat(timespec="seconds"), "beaches": {}}
    for b in items:
        d2 = (LAT - b["lat"]) ** 2 + (LON - b["lon"]) ** 2
        d2m = np.where(good, d2, np.inf)
        i, j = np.unravel_index(int(np.argmin(d2m)), d2m.shape)
        if not np.isfinite(d2m[i, j]):
            continue  # no valid cell in the whole bbox: beach stays missing
        dist_km = round(float(np.sqrt(d2m[i, j])) * 111, 1)
        series = vals[:, i, j]
        beach_days = {}
        for di, dstr in enumerate(days):
            sel = series[t_day == di]
            ok = sel[~np.isnan(sel)]
            if ok.size == 0:
                continue  # day without coverage stays absent -> rendered missing
            beach_days[dstr] = {
                "min": round(float(ok.min()), 2),
                "max": round(float(ok.max()), 2),
                "mean": round(float(ok.mean()), 2),
                "hours_valid": int(ok.size),
                "hours_in_axis": int(sel.size),
            }
        if beach_days:
            out["beaches"][b["id"]] = {
                "cell_lat": round(float(LAT[i, j]), 3),
                "cell_lon": round(float(LON[i, j]), 3),
                "dist_km": dist_km,
                "days": beach_days,
            }

    out["source"] = {
        "dataset_id": DATASET_ID,
        "product_id": PRODUCT_ID,
        "product_doi": PRODUCT_DOI,
        "attribution": "Generated using E.U. Copernicus Marine Service Information",
        "model": "NEMO 4.2 analysis+forecast, 1/24 deg (~4 km); nearest valid sea cell per beach, values are modeled near-shore, not in-situ",
        "aggregation": "per local day (Asia/Jerusalem): min/max = true hourly extrema of the day's fetched hours; mean = hourly mean; hours_valid/hours_in_axis = actual valid-time coverage",
    }
    if not out["beaches"]:
        print("salinity: no beach got a valid cell - writing nothing", file=sys.stderr)
        return 1

    tmp = DATA / "salinity.json.tmp"
    tmp.write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf8")
    tmp.replace(DATA / "salinity.json")
    print(f"salinity: {len(out['beaches'])}/19 beaches, days {days[0]}..{days[-1]}")
    return 0


if __name__ == "__main__":
    # Existing CI entry point already has Copernicus credentials. Fetch the
    # independent wave cache here without changing the workflow's permission scope.
    # Wave failure must not block salinity, or the reverse. The node consumer
    # applies its own freshness/coverage gates for each source independently.
    wave_result = subprocess.run([sys.executable, str(ROOT / "pipeline" / "fetch-waves.py")])
    if wave_result.returncode:
        print("Copernicus waves unavailable; issue builder will label fallback", file=sys.stderr)
    try:
        sys.exit(main())
    except Exception as e:  # noqa: BLE001 - failure must not kill the main refresh
        print(f"salinity: fetch failed: {e!r}", file=sys.stderr)
        sys.exit(1)
