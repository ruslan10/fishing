# תחזית דייג (Fishing Forecast) - candidate package

Static Hebrew site + daily data pipeline for Israeli Mediterranean shore fishing forecasts.

## Structure

- Repo root IS the static site (GitHub Pages serves root of `main`, no build step)
  - `index.html` - single-page app; renders latest issue or `?issue=<issue_id>` from archive
  - `theme.css` - all styling via CSS variables (theme A "night sea", the user's pick)
  - `data/beaches.json` - static mapping: 19 beaches, 3 regions (north/center/south), coordinates, terrain
  - `data/species.json` - static mapping: 12 named fish plus a legal-only grouper warning card; provenance fields kept internally, not rendered (user request)
  - `data/latest.json` - newest generated issue
  - `data/issues/<YYYY-MM-DDTHH-MM-SS>-<rand>.json` - every issue kept; reruns never overwrite (unique suffix + exclusive create); each issue embeds a frozen `snapshot` of the species/beach config used, so archived views never mutate when live config changes
  - `data/archive-index.json` - all issues, newest first
- `pipeline/fetch-data.mjs` - the daily job (Node 22, no deps; uses global fetch)
- `qa/site-check.js` - Playwright QA (uses playwright-core + system Chrome)
- `qa/extra-check.js` - desktop layout proof, numeric-precision leak checks, direction-label checks, 503 failure-state check, legacy archive render
- `qa/past-check.js` - past-window dimming + live best-window recommendation
- `qa/focused-check.js` - in-progress window label, day-click sentinel behavior, per-card provenance lines, confidence labels
- `qa/expired-check.js` - expired issue shows historical label, no upcoming recommendation
- `mockups/` - the three design directions shown to the user

## Run the pipeline

```
node pipeline/fetch-data.mjs
```

Fetches Open-Meteo marine + atmospheric forecast and two named wave cross-checks for all beaches (4 batched requests; multi-location quota accounting applies), consumes fresh Copernicus caches, computes experimental wave/wind scores, and writes a new immutable issue. Species cards remain qualitative, without numeric suitability. Behavior contract:
- Total fetch failure: exits non-zero, previous files untouched (last good data preserved).
- Per-beach failure: that beach carries forward previous data, marked `stale` with the original issue time.
- Issue files are immutable and uniquely timestamped (random suffix, `wx` exclusive write); same-day reruns add new files. `latest.json` is the only mutable file and is promoted atomically (tmp + rename).
- Per-beach validation gate: empty/all-null series, or data not covering the issue date, count as failure for that beach (carries forward last-good marked stale). The promotion gate counts only beaches scored fresh in this run (stale carry-forwards keep old days but do not count): zero fresh beaches = exit non-zero, everything untouched, no new issue. Verified by fault injection (fetch failure and all-null arrays both leave latest.json byte-identical).
- `issued_at` (when the forecast was made) and valid dates are kept separate.
- The page recomputes past windows, best remaining window and issue-age warnings at view time and re-renders every minute, so an open page never recommends an expired window. A window in progress reads 'מתאים עכשיו - נותר עד HH:00'; wholly past days show 'החלון הטוב באותו יום היה' in neutral styling marked 'הצגה היסטורית - לא המלצה', never an upcoming recommendation. Day selection uses an uninitialized sentinel, so clicking the first historical day never jumps back to today.
- Directions use circular (vector) means; cancelling vectors yield "unavailable" rather than a bogus mean. Wind/wave directions are where they come FROM; current direction is where it flows TO (labeled in the UI).
- Missing essential factor (waves or wind) withholds inference: no window score, no species suitability ("אין מספיק מידע") - never a partial score presented as full.

## Daily refresh

`.github/workflows/daily-refresh.yml` has 17:00/18:00 UTC candidates gated to 20:xx Asia/Jerusalem, once per evening cycle. Copernicus stages use repository secrets COPERNICUS_USERNAME and COPERNICUS_PASSWORD; other sources require no keys. It commits new issue/latest/index/IMS snapshot using GITHUB_TOKEN and explicitly requests a Pages build. Manual workflow_dispatch bypasses the time gate.

## Run QA locally

```
npm install playwright-core
python3 -m http.server 8734 &  # from the repo root
node qa/site-check.js   # writes screenshots to /downloads, prints checks + console errors
```

QA asserts: no page/console errors, no horizontal overflow at 390px and 1280px, region/beach/day interactions work, archive-issue view works (including pre-snapshot legacy issues), no bare numeric condition scores anywhere in the UI, readable failure state with retry when latest.json fails, content sections present.

## Data sources and licenses

- Open-Meteo Marine + Forecast APIs (CC BY 4.0) - attribution in site footer and issue meta, including the underlying model providers per Open-Meteo requirements: Météo-France MFWAM/SMOC (Copernicus Marine Service), ECMWF WAM, NOAA NCEP GFS Wave, DWD EWAM/GWAM.
- Model sea-level field (`sea_level_height_msl`) is displayed with an explicit "model, not a coastal measurement" caveat; tide times are listed as not validated, not as absent from the API.
- Species season/hours: local fishing guides (riptide.co.il, babajig.co.il) + he.wikipedia biology - labeled per field, confidence reflects source agreement.
- Names/taxonomy: he.wikipedia (Academy dictionary based) + FishBase Hebrew vernacular.

## Scoring model (experimental, transparent)

- Window condition score (0-100): waves 55% + wind 45%, labeled "ציון תנאים", used only to rank hours within a day.
- Species suitability: factor-level display (עונה/שעות/גלים/רוח/מים) + qualitative band (גבוהה/בינונית/נמוכה/אין מספיק מידע), never a percentage. Season gate: off-season caps at נמוכה, edge-of-season caps at בינונית. Weights: season 0.4, time 0.2, conditions 0.4.
- Today's recommendations consider only future windows; past windows are shown dimmed.
- No catch probability is claimed anywhere. The site has no catch statistics feature; trip reports are kept privately outside the site for now, and any future calibration would be announced separately.

## Known limitations

- Calm weeks saturate day bands at "גבוהה" - honest but not very discriminating; calibration pending trip logs.
- Currents near shore are small and their fishing usefulness is unverified (shown with caveat).
- Responsive layout: mobile-first, with deliberate tablet (640px+) and desktop (900px+) grids (4-up hero, 3-up species cards, 7-up week strip).
- No tide times validated for shore level, chlorophyll/turbidity, dissolved oxygen, salinity, pH, or baitfish data - listed explicitly in the site's availability section.

## Integrated free wave forecast (schema v5, 19 Nov 2026)

- IMS coastal ranges stay separate and are used in the hourly table only for fully
  covered, current official intervals. The official graph is never extended with
  numerical-model values. No map viewer.
- Primary weekly significant wave height: Copernicus Mediterranean MED-WAV,
  `cmems_mod_med_wav_anfc_4.2km_PT1H-i` / `MEDSEA_ANALYSISFORECAST_WAV_006_017`,
  WAM Cycle 6, hourly output, 1/24 degree grid. Nearest sea cell with >=90% valid
  fetched heights, selected by great-circle distance. Not breaking-wave height,
  a beach observation, or a shoreline-calibrated prediction.
- `VHM0` is spectral significant height in metres, `VMDR` is direction FROM,
  `VTM02` is mean period Tm02, not peak period. Open-Meteo still supplies wind,
  atmospheric weather, sea temperature, currents and swell. Salinity remains
  Copernicus MEDSEA PHY. Field provenance is frozen in each new issue.
- Two separately queried named height cross-checks via Open-Meteo:
  `ecmwf_wam` and `ncep_gfswave025`. Per-day ranges are temporal hourly extrema.
  The displayed difference is the largest simultaneous hourly height spread
  among at least two available models. It is NOT an uncertainty interval,
  accuracy estimate, probability or independent ensemble. Model cells differ.
- No cross-model averaging or hidden calibration. A missing comparison is
  displayed as missing. If the fresh Copernicus cache/first-day coverage is not
  usable, the whole beach's primary is explicitly Open-Meteo best-match fallback;
  missing later Copernicus hours are NOT silently filled from another source.
- `fetch-waves.py` writes the cache atomically. The issue builder accepts it only
  within 3h of retrieval. A model initialization time is not inferred from retrieval
  time. All selected cells, hourly model comparisons, coverage, primary/fallback,
  retrieval timestamps and product identity are frozen in the immutable issue.
- Evening workflow uses existing Copernicus repository secrets. Its existing
  fetch-salinity.py entry point runs the independent wave fetch first, then salinity,
  then the workflow builds the Open-Meteo/IMS issue. No workflow permission change. A soft wave failure does not falsely
  present stale Copernicus as current. Only new issue files may be added.
- Free usage is for this noncommercial site with no ads/subscriptions. Open-Meteo
  has service limits; browser views use the published cache, not API calls.
  Copernicus credit and DOI 10.48670/mds-00373 (waves) and 10.48670/mds-00359
  (salinity) remain visible. No Stormglass dependency or paid service.

Sources: https://data.marine.copernicus.eu/product/MEDSEA_ANALYSISFORECAST_WAV_006_017/description
and https://marine.copernicus.eu/user-corner/service-commitments-and-licence ;
https://open-meteo.com/en/docs/marine-weather-api and https://open-meteo.com/en/terms .

### Presentation correction, 19 Nov 2026
IMS official range graph/card leads. Offshore models are equal-status trends and
comparison, not a chosen shore-height answer. The weekly graph plots Copernicus,
ECMWF WAM and GFS separately, without averaging. Model-only wave headline/day-tile
numbers and model-based condition scores are withheld in schema-v5 views; beyond
IMS coverage the hourly wave cell directs readers to the comparison rather than
pretending to have a validated coastal forecast. Raw source provenance and dated
issue files remain unchanged. GoSurf is not ingested or republished.

### Hourly wave values restored, 19 Nov 2026
Beyond official IMS coverage, each hourly-table row now directly lists the actual
Copernicus, ECMWF and GFS height range over that row's hours, source by source.
This avoids both an empty wave column and a falsely chosen shore-height answer.
Partial-hour coverage is shown; no values are averaged across models. Official
fully covered IMS rows keep their official ranges. Conditions scores stay withheld.

## Rights and third-party materials

Copyright (c) 2026 Ruslan Medov. All rights reserved in the original project code
and site layout, to the extent rights are held by Ruslan Medov. No general reuse
permission is granted. See [LICENSE](LICENSE) for the reserved-rights notice and
its exclusions. This project is not offered under an open-source license.

Third-party data, dependencies, fonts and assets retain their own terms. Existing
source credits and bundled license/notice files remain applicable. The generated
share illustration is not covered by an assertion of exclusive copyright.
