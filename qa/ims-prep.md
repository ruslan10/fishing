# IMS integration prep (LOCAL ONLY — not wired into pipeline, pending reuse-scope decision)

## Endpoints (verified live 2026-11-18 ~21:35 IST)
- https://ims.gov.il/he/coasts_forecasts/ → per-region forecast, 2 slots/day (08:00→20:00, 20:00→08:00)
- https://ims.gov.il/he/sea_tools/coasts → metadata: sea_state code table (10 דומם … 160 זועף מאד, incl. compound 40 נוח עד גלי, 55 גלי עד גבה גלים), weather codes, region names
- Fields per slot: sea_temp, wind_dir_from/to, wind_speed_from/to (km/h), wave_height_from/to (cm), sea_state code, extra: weather_code, heat_stress_level, u_v_level. issue_date ~13:50/15:50.

## Region mapping proposal (OUR approximation — IMS publishes only one representative point per region, no boundary)
- חוף צפון (lid 212): achziv, nahariya, akko-argaman, haifa-batgalim
- חוף מרכז (lid 210): atlit, dor, caesarea, olga, michmoret, netanya, herzliya, telaviv-frishman, jaffa, rishon-lezion, palmachim
- חוף דרום (lid 213): ashdod, nitzanim, ashkelon, zikim
Verify against IMS coasts page presentation before production use.

## Attribution (required by IMS terms clause 3)
IMS strip labeled "תחזית השירות המטאורולוגי הישראלי" + footer: השמ״ט אינו נושא באחריות למידע ואינו צד לפרסומו.

## Operational
- 24h horizon only; display next to (never instead of) the 7-day Open-Meteo forecast.
- Stale/outage handling per terms clause 10: reuse existing stale-beach detection; if IMS fetch fails, omit strip, mark in issue JSON.
