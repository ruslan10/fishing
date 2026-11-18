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

Fetches Open-Meteo marine + forecast for all beaches (2 batched API calls), computes window condition scores and factor-level species suitability, writes a new issue file. Behavior contract:
- Total fetch failure: exits non-zero, previous files untouched (last good data preserved).
- Per-beach failure: that beach carries forward previous data, marked `stale` with the original issue time.
- Issue files are immutable and uniquely timestamped (random suffix, `wx` exclusive write); same-day reruns add new files. `latest.json` is the only mutable file and is promoted atomically (tmp + rename).
- Per-beach validation gate: empty/all-null series, or data not covering the issue date, count as failure for that beach (carries forward last-good marked stale). The promotion gate counts only beaches scored fresh in this run (stale carry-forwards keep old days but do not count): zero fresh beaches = exit non-zero, everything untouched, no new issue. Verified by fault injection (fetch failure and all-null arrays both leave latest.json byte-identical).
- `issued_at` (when the forecast was made) and valid dates are kept separate.
- The page recomputes past windows, best remaining window and issue-age warnings at view time and re-renders every minute, so an open page never recommends an expired window. A window in progress reads 'מתאים עכשיו - נותר עד HH:00'; wholly past days show 'החלון הטוב באותו יום היה' in neutral styling marked 'הצגה היסטורית - לא המלצה', never an upcoming recommendation. Day selection uses an uninitialized sentinel, so clicking the first historical day never jumps back to today.
- Directions use circular (vector) means; cancelling vectors yield "unavailable" rather than a bogus mean. Wind/wave directions are where they come FROM; current direction is where it flows TO (labeled in the UI).
- Missing essential factor (waves or wind) withholds inference: no window score, no species suitability ("אין מספיק מידע") - never a partial score presented as full.

## Daily refresh

`.github/workflows/daily-refresh.yml` runs the pipeline every day at 03:30 UTC (05:30/06:30 Israel) via GitHub Actions and commits the new issue + updated latest/archive index using the automatic `GITHUB_TOKEN`. No secrets needed. It can also be triggered manually (`workflow_dispatch`).

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
