#!/usr/bin/env node
/**
 * תחזית דייג - צינור נתונים יומי
 * Fetches Open-Meteo marine + weather for all mapped beaches, computes an
 * EXPERIMENTAL transparent suitability score per fishing window and per
 * species, and writes a new dated issue file without overwriting history.
 *
 * Scoring is a documented heuristic (see docs/methodology in site footer),
 * not a catch probability. Missing data is reported as missing, never invented.
 * On total fetch failure the run exits non-zero and previous files stay untouched.
 * On per-beach failure, that beach carries forward its last good data, marked stale.
 */
import fs from 'node:fs';
import {fetchJsonWithRetry as fetchJson} from './http-retry.mjs';
import {loadTides} from './tides.mjs';
import {spawnSync} from 'node:child_process';
import {MODEL_LABELS,readFreshCache,modelSummary,omSeries,choosePrimary} from './multi-model.mjs';
import {windowScore} from '../experimental-score.mjs';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = ROOT; // site lives at repo root (GitHub Pages serves root of main)
const DATA = path.join(SITE, 'data');
const TZ = 'Asia/Jerusalem';
const VERSION = 5;

const beaches = JSON.parse(fs.readFileSync(path.join(DATA, 'beaches.json'), 'utf8'));
const speciesCfg = JSON.parse(fs.readFileSync(path.join(DATA, 'species.json'), 'utf8'));

const MARINE_HOURLY = 'wave_height,wave_direction,wave_period,swell_wave_height,swell_wave_direction,swell_wave_period,wind_wave_height,sea_surface_temperature,ocean_current_velocity,ocean_current_direction,sea_level_height_msl';
const WX_HOURLY = 'wind_speed_10m,wind_direction_10m,wind_gusts_10m,temperature_2m,pressure_msl,relative_humidity_2m,precipitation,weather_code,is_day';
const WX_DAILY = 'sunrise,sunset';

const DATA_AVAILABILITY = {
  available_he: [
    'גובה גלים', 'טמפרטורת מי הים',
    'מהירות וכיוון זרם (ערכים קטנים ליד החוף; שימושיות לדיג לא אומתה)',
    'זמני גאות ושפל אסטרונומיים: תחזית לאזור, לא מדידה בנקודת החוף. באין יישוב תואם נעשה שימוש באזור סמוך המסומן בתצוגה',
    'רוח וכיוון רוח',
    'מזג אוויר: טמפרטורת אוויר, לחות, משקעים ומצב שמיים לכל חלון',
    'זריחה/שקיעה ואור ראשון/אחרון (מחושב)', 'מלוא ירח (מחושב)'
  ],
  collected_he: [
    'כיוון ומחזור גלים', 'גלי שטפה (swell) וגלי רוח (גובה ומחזור)',
    'משבי רוח', 'לחץ אוויר',
    'מליחות פני ים (מודל Copernicus MEDSEA 006_013; תא הים התקף הקרוב ביותר, ~1.6-5 ק"מ מהחוף - ערך ממודל, לא מדידה בחוף)',
    'גובה פני ים ממודל (מוצג כהערה בלבד, לא כהמלצת דיג)'
  ],
  missing_he: [
    'גאות ושפל מדויקים ברמת חוף (קטנים מאוד בישראל; קיים שדה גובה פני ים ממודל ב-Open-Meteo אך לא אומת מול מדידות חוף ישראליות, ולכן אינו מוצג כהמלצת דיג)',
    'עכירות/טורבידיות וכלורופיל (Copernicus - דורש הרשמה, טרם נבדק)',
    'חמצן מומס במים', 'pH',
    'נוכחות דגי פתיון ליד החוף',
    'אימות דיוק התחזית ברמת חוף בודד',
    'הסתברות תפיסה מכוילת - לא קיימת כרגע; דיווחי דיג נשמרים מחוץ לאתר בשלב זה, ואין באתר סטטיסטיקת תפיסות'
  ]
};

function apiUrl(base, params) {
  const q = new URLSearchParams(params);
  return `${base}?${q}`;
}


// Approximate moon phase for a UTC date: illuminated fraction (0-100) and waxing/waning.
function moonPhase(dateUtc) {
  const synodic = 29.53058867;
  const knownNew = Date.UTC(2000, 0, 6, 18, 14) / 86400000;
  const days = dateUtc.getTime() / 86400000;
  let age = (days - knownNew) % synodic;
  if (age < 0) age += synodic;
  const pct = Math.round((1 - Math.cos(2 * Math.PI * age / synodic)) / 2 * 100);
  return { pct, waxing: age < synodic / 2 };
}

// Solar event times via the NOAA sunrise/sunset algorithm, computed per beach and date.
// zenith 90.833 deg = sunrise/sunset (incl. refraction); 96 deg = civil twilight (dawn/dusk).
// Returns the event time in UTC hours (float). Pure math, no Date timezone pitfalls.
function solarEventUtcHours(dateStr, lat, lon, zenithDeg, rising) {
  const [y, mo, da] = dateStr.split('-').map(Number);
  const n = Math.round((Date.UTC(y, mo - 1, da) - Date.UTC(y, 0, 0)) / 86400000); // day of year
  const lngHour = lon / 15;
  const t = n + ((rising ? 6 : 18) - lngHour) / 24;
  const M = 0.9856 * t - 3.289;
  const d2r = Math.PI / 180;
  let L = (M + 1.916 * Math.sin(M * d2r) + 0.020 * Math.sin(2 * M * d2r) + 282.634) % 360;
  if (L < 0) L += 360;
  let RA = Math.atan(0.91764 * Math.tan(L * d2r)) / d2r;
  RA = ((RA % 360) + 360) % 360;
  RA = (RA + Math.floor(L / 90) * 90 - Math.floor(RA / 90) * 90) / 15;
  const sinDec = 0.39782 * Math.sin(L * d2r);
  const cosDec = Math.cos(Math.asin(sinDec));
  const cosH = (Math.cos(zenithDeg * d2r) - sinDec * Math.sin(lat * d2r)) / (cosDec * Math.cos(lat * d2r));
  if (Math.abs(cosH) > 1) return null; // polar day/night - never at Israel's latitude
  let H = Math.acos(cosH) / d2r;
  if (rising) H = 360 - H;
  H /= 15;
  const T = H + RA - 0.06571 * t - 6.622;
  let UT = (T - lngHour) % 24;
  if (UT < 0) UT += 24;
  return UT;
}

const hhmmToMin = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
const minToHhmm = (mins) => `${String(Math.floor(((mins % 1440) + 1440) % 1440 / 60)).padStart(2, '0')}:${String(((mins % 1440) + 1440) % 1440 % 60).padStart(2, '0')}`;

// Civil dawn/dusk in local time: computed per beach/date, with the local UTC offset
// anchored to Open-Meteo's own local sunrise/sunset for that date (handles DST).
function civilTwilight(dateStr, lat, lon, localSunrise, localSunset, rising) {
  const anchorLocal = rising ? localSunrise : localSunset;
  if (!anchorLocal) return null;
  const anchorUtc = solarEventUtcHours(dateStr, lat, lon, 90.833, rising);
  const eventUtc = solarEventUtcHours(dateStr, lat, lon, 96, rising);
  if (anchorUtc == null || eventUtc == null) return null;
  let offsetMin = hhmmToMin(anchorLocal) - anchorUtc * 60;
  offsetMin = ((offsetMin + 720) % 1440) - 720; // wrap to +/-12h
  return minToHhmm(Math.round(eventUtc * 60 + offsetMin));
}
const round = (x, p = 1) => (x == null ? null : +x.toFixed(p));

// --- Experimental scoring heuristics (documented, to be calibrated from user trip logs) ---
// Species cards are qualitative only (shore-lure scope, 2026-11-18): no reviewed source
// validates numerical season/hour/wave/wind/SST cutoffs per species, so the old species
// suitability model was removed rather than re-parameterized. Marine window scoring
// (windowScore above) is wave/wind comparison only and stays.

function compass(deg) {
  if (deg == null) return null;
  const dirs = ['צפון', 'צפון-מזרח', 'מזרח', 'דרום-מזרח', 'דרום', 'דרום-מערב', 'מערב', 'צפון-מערב'];
  return dirs[Math.round(((deg % 360) / 45)) % 8];
}
const avg = arr => arr.filter(x => x != null).length ? arr.filter(x => x != null).reduce((a, b) => a + b, 0) / arr.filter(x => x != null).length : null;

// Circular (vector) mean for directions in degrees. Arithmetic means break at the 359/1 wrap
// (mean 180) and hide cancelling vectors. Returns null when there is no meaningful direction:
// no values, or mean resultant length below 0.25 (vectors roughly cancel).
function circMeanDeg(vals) {
  const v = vals.filter(x => x != null);
  if (!v.length) return null;
  let sx = 0, sy = 0;
  for (const d of v) { const r = d * Math.PI / 180; sx += Math.cos(r); sy += Math.sin(r); }
  const rl = Math.hypot(sx, sy) / v.length;
  if (rl < 0.25) return null;
  return (Math.atan2(sy, sx) * 180 / Math.PI + 360) % 360;
}

// Freshness/completeness gate for one beach's API responses. All-null or empty series,
// or data that does not cover the issue date, must never be promoted as fresh data.
function beachDataValid(m, w, issueDate) {
  if (!m?.hourly?.time?.length || !w?.hourly?.time?.length) return false;
  if (m.hourly.time[0].slice(0, 10) > issueDate || w.hourly.time[0].slice(0, 10) > issueDate) return false;
  const n = Math.min(48, m.hourly.time.length, w.hourly.time.length);
  let waves = 0, winds = 0;
  for (let h = 0; h < n; h++) {
    if (m.hourly.wave_height?.[h] != null) waves++;
    if (w.hourly.wind_speed_10m?.[h] != null) winds++;
  }
  return waves >= n * 0.5 && winds >= n * 0.5;
}

async function main() {
  const environmentRun=spawnSync('python3',[path.join(ROOT,'pipeline/fetch-environment-history.py')],{stdio:'inherit'});
  if(environmentRun.status!==0) console.error('Recent wave/wind history unavailable.');
  const historyRun=spawnSync('python3',[path.join(ROOT,'pipeline/fetch-change48.py')],{stdio:'inherit'});
  if(historyRun.status!==0) console.error('Daily48h unavailable; existing snapshot retained if present.');
  const lats = beaches.beaches.map(b => b.lat).join(',');
  const lons = beaches.beaches.map(b => b.lon).join(',');
  const marineUrl = apiUrl('https://marine-api.open-meteo.com/v1/marine', {
    latitude: lats, longitude: lons, hourly: MARINE_HOURLY, timezone: TZ, forecast_days: 7
  });
  const wxUrl = apiUrl('https://api.open-meteo.com/v1/forecast', {
    latitude: lats, longitude: lons, hourly: WX_HOURLY, daily: WX_DAILY,
    timezone: TZ, forecast_days: 7, wind_speed_unit: 'kmh'
  });

  let marine, wx;
  try {
    [marine, wx] = await Promise.all([
      fetchJson(marineUrl, 'marine'),
      fetchJson(wxUrl, 'forecast')
    ]);
  } catch (e) {
    console.error(`FETCH FAILED: ${e.message}. Previous data files left untouched.`);
    process.exit(1);
  }
  if (!Array.isArray(marine)) marine = [marine];
  if (!Array.isArray(wx)) wx = [wx];

  const nowUtc = new Date();
  const issuedLocal = new Intl.DateTimeFormat('sv-SE', { timeZone: TZ, dateStyle: 'short', timeStyle: 'medium' }).format(nowUtc).replace(' ', 'T');
  // Unique, immutable issue id: seconds precision plus random suffix so two runs can never collide.
  const issueId = issuedLocal.replace(/[:]/g, '-') + '-' + crypto.randomBytes(3).toString('hex');

  const issueDate = issuedLocal.slice(0, 10);
  const issueHour = +issuedLocal.slice(11, 13);

  const prevLatestPath = path.join(DATA, 'latest.json');
  const prev = fs.existsSync(prevLatestPath) ? JSON.parse(fs.readFileSync(prevLatestPath, 'utf8')) : null;
  const prevByBeach = {};
  if (prev?.beaches) for (const b of prev.beaches) prevByBeach[b.id] = b;

  // Copernicus modeled sea-surface salinity, pre-fetched by pipeline/fetch-salinity.py
  // into data/salinity.json (nearest valid sea cell, ~1.6-5 km offshore: modeled value,
  // never an in-situ beach measurement). Used only when the file is fresh (< 3h old);
  // otherwise salinity fields stay null and render as missing.
  let salinity = null;
  try {
    const sp = path.join(DATA, 'salinity.json');
    if (fs.existsSync(sp)) {
      const s = JSON.parse(fs.readFileSync(sp, 'utf8'));
      const ageH = (Date.now() - new Date(s.generated_at).getTime()) / 3600000;
      if (ageH >= 0 && ageH < 3 && s.beaches) salinity = s;
    }
  } catch { salinity = null; }

  // Independent named wave models: no source averaging and no use as observations.
  const cpWaves = readFreshCache(fs, path.join(DATA,'copernicus-waves.json'));
  const cross = {};
  for (const model of ['ecmwf_wam','ncep_gfswave025']) {
    try {
      const response=await fetchJson(apiUrl('https://marine-api.open-meteo.com/v1/marine', {
        latitude:lats,longitude:lons,hourly:'wave_height',models:model,timezone:TZ,forecast_days:7
      }),model);
      cross[model]=Array.isArray(response)?response:[response];
    } catch(e) { console.error(`Comparison ${model} unavailable: ${e.message}`); cross[model]=[]; }
  }

  const outBeaches = [];
  const staleBeaches = [];
  let freshBeaches = 0;

  beaches.beaches.forEach((b, i) => {
    const m = marine[i], w = wx[i];
    if (!beachDataValid(m, w, issueDate)) {
      const old = prevByBeach[b.id];
      if (old) {
        outBeaches.push({ ...old, stale: true, stale_note_he: 'שואב מנתוני ההפקה הקודמת - רענון נכשל', original_issued_at: old.original_issued_at || prev.meta.issued_at_local });
        staleBeaches.push(b.id);
      } else {
        outBeaches.push({ id: b.id, missing: true, missing_note_he: 'נתונים חסרים - לא הומצאו ערכים' });
        staleBeaches.push(b.id);
      }
      return;
    }

    const fallback=omSeries(m);
    const cp=cpWaves?.beaches?.[b.id]||null;
    const primary=choosePrimary(cp,fallback,issueDate);
    const cpByTime=new Map((cp?.hourly||[]).map(r=>[r.time,r]));
    const modelSeries={};
    if(cp) modelSeries.copernicus_med=cp;
    for(const id of ['ecmwf_wam','ncep_gfswave025']) modelSeries[id]=omSeries(cross[id]?.[i]);
    if(primary.id!=='copernicus_med') modelSeries.open_meteo_best_match=fallback;
    const n = m.hourly.time.length;
    const byDate = {};
    for (let h = 0; h < n; h++) {
      const t = m.hourly.time[h]; // local ISO "YYYY-MM-DDTHH:MM"
      const date = t.slice(0, 10);
      const hour = +t.slice(11, 13);
      (byDate[date] ||= []).push({
        hour,
        wave_height: primary.id==='copernicus_med' ? cpByTime.get(t)?.height??null : m.hourly.wave_height?.[h]??null,
        wave_direction: primary.id==='copernicus_med' ? cpByTime.get(t)?.direction??null : m.hourly.wave_direction?.[h]??null,
        wave_period: primary.id==='copernicus_med' ? cpByTime.get(t)?.period_tm02??null : m.hourly.wave_period?.[h]??null,
        swell_wave_height: m.hourly.swell_wave_height?.[h] ?? null,
        swell_wave_period: m.hourly.swell_wave_period?.[h] ?? null,
        wind_wave_height: m.hourly.wind_wave_height?.[h] ?? null,
        sst: m.hourly.sea_surface_temperature?.[h] ?? null,
        sea_level: m.hourly.sea_level_height_msl?.[h] ?? null,
        current_vel: m.hourly.ocean_current_velocity?.[h] ?? null,
        current_dir: m.hourly.ocean_current_direction?.[h] ?? null,
        wind_kmh: w.hourly.wind_speed_10m?.[h] ?? null,
        wind_dir: w.hourly.wind_direction_10m?.[h] ?? null,
        gust_kmh: w.hourly.wind_gusts_10m?.[h] ?? null,
        air_temp: w.hourly.temperature_2m?.[h] ?? null,
        pressure: w.hourly.pressure_msl?.[h] ?? null,
        humidity: w.hourly.relative_humidity_2m?.[h] ?? null,
        precip: w.hourly.precipitation?.[h] ?? null,
        wx_code: w.hourly.weather_code?.[h] ?? null,
        is_day: w.hourly.is_day?.[h] ?? null
      });
    }

    const days = Object.keys(byDate).sort().map(date => {
      const hours = byDate[date];
      // 3-hour windows 00-21
      const windows = [];
      for (let start = 0; start < 24; start += 3) {
        const cells = hours.filter(x => x.hour >= start && x.hour < start + 3);
        if (!cells.length) continue;
        const c = k => avg(cells.map(x => x[k]));
        const win = {
          from: `${String(start).padStart(2, '0')}:00`,
          to: `${String((start + 3) % 24).padStart(2, '0')}:00`,
          fromHour: start,
          wave_height: round(c('wave_height'), 2), wave_period: round(c('wave_period')),
          wave_dir: compass(circMeanDeg(cells.map(x => x.wave_direction))),
          swell_height: round(c('swell_wave_height'), 2), swell_period: round(c('swell_wave_period')),
          sst: round(c('sst')),
          sea_level: round(c('sea_level'), 2),
          current_vel: round(c('current_vel'), 2), current_dir: compass(circMeanDeg(cells.map(x => x.current_dir))),
          wind_kmh: round(c('wind_kmh')), wind_dir: compass(circMeanDeg(cells.map(x => x.wind_dir))),
          wind_deg: (m => m == null ? null : Math.round(m))(circMeanDeg(cells.map(x => x.wind_dir))), gust_kmh: round(c('gust_kmh')),
          air_temp: round(c('air_temp')), pressure: round(c('pressure')),
          humidity: round(c('humidity')),
          precip: cells.some(x => x.precip != null) ? round(cells.reduce((a, x) => a + (x.precip ?? 0), 0), 1) : null,
          // Icon hour: the most severe weather inside the window by an explicit WMO severity
          // ranking (numeric code order is NOT a severity order), with its own day/night flag.
          ...(() => {
            const RANK = c => c == null ? -1
              : c >= 95 ? 60                    // thunderstorm (+ hail 96/99)
              : (c >= 80 && c <= 82) ? 50       // rain showers
              : c >= 85 && c <= 86 ? 50         // snow showers
              : (c >= 61 && c <= 67) ? 40       // rain
              : (c >= 71 && c <= 77) ? 40       // snow
              : (c >= 51 && c <= 57) ? 30       // drizzle
              : (c === 45 || c === 48) ? 20     // fog
              : c === 3 ? 10 : c === 2 ? 5 : 0; // overcast / partly / clear
            const ranked = cells.filter(x => x.wx_code != null)
              .sort((a, b) => (RANK(b.wx_code) - RANK(a.wx_code)) || (b.wx_code - a.wx_code));
            const worst = ranked[0];
            return { wx_code: worst ? worst.wx_code : null, is_day: worst ? (worst.is_day ?? null) : null };
          })()
        };
        win.score = windowScore(win.wave_height,win.wind_kmh,win.gust_kmh);
        // Hourly wave min/max inside the window, for an honest range display (not an uncertainty band).
        const wv = cells.map(x => x.wave_height).filter(x => x != null);
        win.wave_min = wv.length ? round(Math.min(...wv), 2) : null;
        win.wave_max = wv.length ? round(Math.max(...wv), 2) : null;
        // Sustained-wind min/max from the window's hourly values, same honest-range approach.
        // Gusts stay separate (gust_kmh) and are never folded into this sustained range.
        const wn = cells.map(x => x.wind_kmh).filter(x => x != null);
        win.wind_min_kmh = wn.length ? round(Math.min(...wn)) : null;
        win.wind_max_kmh = wn.length ? round(Math.max(...wn)) : null;

        // For the issue day, windows that already ended are marked past and excluded from recommendations.
        win.past = (date === issueDate) && (start + 3 <= issueHour);
        windows.push(win);
      }
      const activeWindows = windows.filter(x => !x.past);
      const di = w.daily?.time?.indexOf(date);
      const sunrise = di >= 0 ? w.daily.sunrise[di].slice(11, 16) : null;
      const sunset = di >= 0 ? w.daily.sunset[di].slice(11, 16) : null;
      const civilDawn = civilTwilight(date, b.lat, b.lon, sunrise, sunset, true);
      const dateUtc = new Date(date + 'T12:00:00Z');
      const moon = moonPhase(dateUtc);
      const dayPeakWind=hours.map(x=>x.wind_kmh).filter(x=>x!=null);
      const peakWind=dayPeakWind.length?Math.max(...dayPeakWind):null;
      const daySst = avg(hours.map(x => x.sst));
      const dayAir = hours.map(x => x.air_temp).filter(x => x != null);
      const dayPres = hours.map(x => x.pressure).filter(x => x != null);
      const dayWaves = hours.map(x => x.wave_height).filter(x => x != null);
      const maxWave = dayWaves.length ? Math.max(...dayWaves) : 0;
      const minWave = dayWaves.length ? Math.min(...dayWaves) : null;
      // Qualitative schema: cards render from the frozen config snapshot, not per-day numbers.
      const species = speciesCfg.species.map(sp => ({ id: sp.id, status_only: true }));
      const salDay = salinity?.beaches?.[b.id]?.days?.[date] || null;
      return {
        date,
        sunrise, sunset,
        first_light: civilDawn==null?null:minToHhmm(hhmmToMin(civilDawn)-20),
        civil_dawn: civilDawn,
        first_light_adjustment_minutes: -20,
        first_light_definition: 'user-adjusted planning time: 20 minutes before computed civil dawn, not astronomical dawn',
        last_light: civilTwilight(date, b.lat, b.lon, sunrise, sunset, false),
        moon_illumination_pct: moon.pct,
        moon_waxing: moon.waxing,
        wind_max_kmh: peakWind==null?null:round(peakWind),
        wave_max: dayWaves.length ? maxWave : null,
        wave_source: primary.id,
        wave_comparison: modelSummary(modelSeries,date),
        wave_hourly: hours.map(h=>({hour:h.hour,height:h.wave_height})),
        wave_min: minWave,
        high_wave_warning: maxWave > 1.8,
        sst_avg: daySst,
        air_temp_min: dayAir.length ? round(Math.min(...dayAir)) : null,
        air_temp_max: dayAir.length ? round(Math.max(...dayAir)) : null,
        pressure_min: dayPres.length ? round(Math.min(...dayPres)) : null,
        pressure_max: dayPres.length ? round(Math.max(...dayPres)) : null,
        salinity_min: salDay ? salDay.min : null,
        salinity_max: salDay ? salDay.max : null,
        salinity_hours_valid: salDay ? salDay.hours_valid : null,
        salinity_hours_in_axis: salDay ? salDay.hours_in_axis : null,
        windows,
        species
      };
    });

    outBeaches.push({ id: b.id,
      wave_primary: primary.id,
      wave_provenance: {primary:primary.id, primary_label:MODEL_LABELS[primary.id],
        retrieved_at:primary.id==='copernicus_med'?cpWaves.generated_at:nowUtc.toISOString(),
        cell_lat:primary.series.cell_lat,cell_lon:primary.series.cell_lon,dist_km:primary.series.dist_km??null,
        copernicus_source:cp?cpWaves.source:null,
        comparison_retrieved_at:nowUtc.toISOString(),
        model_series:modelSeries,
        field_sources:{wave_height:primary.id,wave_direction:primary.id,wave_period:primary.id==='copernicus_med'?'Copernicus VTM02 (Tm02)':'Open-Meteo mean period',swell:'Open-Meteo Marine best match',water_temperature:'Open-Meteo Marine best match',current:'Open-Meteo Marine best match',wind:'Open-Meteo Forecast',salinity:'Copernicus MEDSEA PHY'},
        note:'No averaging, shoreline calibration or independent-error assumption. Model cells may differ; missing values retained.'},
      salinity_dist_km: salinity?.beaches?.[b.id]?.dist_km ?? null, days });
    freshBeaches++;
  });

  // Total failure: stale carry-forward entries keep their old days, so count only beaches
  // scored fresh in THIS run. If none validated fresh, leave all previous files untouched.
  if (freshBeaches === 0) {
    console.error('ALL BEACHES FAILED validation (0 fresh) - previous data files left untouched.');
    process.exit(1);
  }

  // --- IMS official coast forecast (enabled with IMS_ENABLE=1; the daily workflow sets it).
  // Reuse per IMS terms clauses 2-3 requires prominent attribution + no-liability disclaimer
  // (both rendered in the site footer). Low-volume fetch of 2 public endpoints once per
  // evening; on any IMS failure the strip is omitted and the issue still builds.
  // 24h horizon, 3 Mediterranean regions; displayed next to (never instead of) the
  // 7-day Open-Meteo forecast.
  const IMS_REGION_LID = { north: '212', center: '210', south: '213' };
  let imsBlock = { available: false };
  if (process.env.IMS_ENABLE === '1') {
    try {
      const [fcRes, toolsRes] = await Promise.all([
        fetch('https://ims.gov.il/he/coasts_forecasts/'),
        fetch('https://ims.gov.il/he/sea_tools/coasts')
      ]);
      if (!fcRes.ok || !toolsRes.ok) throw new Error(`IMS HTTP ${fcRes.status}/${toolsRes.status}`);
      const fc = (await fcRes.json()).data;
      const tools = (await toolsRes.json()).data;
      const regions = {};
      for (const [region, lid] of Object.entries(IMS_REGION_LID)) {
        const slots = fc[lid] ? Object.keys(fc[lid]).sort().map(k => {
          const d = fc[lid][k].data;
          return {
            valid_from: d.valid_from, valid_to: d.valid_to,
            sea_temp: d.sea_temp !== '' ? +d.sea_temp : null,
            wind_dir_from: +d.wind_dir_from, wind_dir_to: +d.wind_dir_to,
            wind_speed_from: +d.wind_speed_from, wind_speed_to: +d.wind_speed_to,
            wave_from_cm: +String(d.wave_height_from).trim(), wave_to_cm: +String(d.wave_height_to).trim(),
            sea_state_he: tools.sea_state?.[String(d.sea_state).trim()] || null
          };
        }) : [];
        if (slots.length) regions[region] = { name_he: (tools.sea_locations?.[lid]?.name || region).trim(), slots };
      }
      const anyIssued = fc[IMS_REGION_LID.center]?.[Object.keys(fc[IMS_REGION_LID.center] || {})[0]]?.data?.issue_date;
      imsBlock = Object.keys(regions).length
        ? { available: true, issued_at: anyIssued || null, regions }
        : { available: false };
    } catch (e) {
      console.error(`IMS fetch failed: ${e.message} - IMS strip omitted from this issue.`);
      imsBlock = { available: false };
    }
  }

  const tideFor=loadTides(ROOT);
  for(const beach of outBeaches)for(const day of beach.days||[])day.tides=tideFor(beach.id,day.date);

  const issue = {
    // Frozen config snapshot: archived issues render from this, so historical views never mutate
    // when the live species/beach config changes later.
    snapshot: {
      species: speciesCfg.species,
      coverage_note_he: speciesCfg.coverage_note_he,
      data_quality_he: speciesCfg.data_quality_he,
      provenance_note_he: speciesCfg.provenance_note_he,
      species_sources: speciesCfg.sources,
      beaches: beaches.beaches.map(b => ({ id: b.id, name_he: b.name_he, region: b.region, terrain_he: b.terrain_he, caution_he: b.caution_he || null, lat: b.lat, lon: b.lon }))
    },
    environment_history: (()=>{try{const x=JSON.parse(fs.readFileSync(path.join(DATA,'environment-history.json'),'utf8'));return Date.now()-Date.parse(x.retrieved_at)<3*3600000?x:null;}catch(e){return null;}})(),
    change48: (()=>{try{return JSON.parse(fs.readFileSync(path.join(DATA,'change48-latest.json'),'utf8'));}catch(e){return {days:{}};}})(),
    ims: imsBlock,
    meta: {
      version: VERSION,
      conditions_scale: { version:1, meaning:'separate_wave_and_wind_colors_no_combined_score', aggregation:'separate full-day and interval hourly maxima; rounded display values', wave_cm:'<50;50..100;>100..<200;200..300;>300', wind_kmh:'<12;12..<20;20..<29;29..<50;>=50' },
      issue_id: issueId,
      issued_at_local: issuedLocal,
      issued_at_utc: nowUtc.toISOString(),
      timezone: TZ,
      valid_from: outBeaches.find(b => b.days)?.days?.[0]?.date ?? null,
      valid_to: outBeaches.find(b => b.days)?.days?.slice(-1)[0]?.date ?? null,
      refresh_policy_he: 'רענון נתונים מתוכנן כל 3 שעות; זמני GitHub Actions עשויים להתעכב; התחזית מכסה 7 ימים קלנדריים כולל יום הרענון; הפקות קודמות נשמרות בארכיון ללא שינוי',
      wave_policy: {primary:'Copernicus MED-WAV if current first-day coverage passes availability gate, otherwise explicitly labeled Open-Meteo best match',
        comparison:['ecmwf_wam','ncep_gfswave025'],
        spread:'largest simultaneous hourly spread, never a calibrated confidence interval',
        copernicus_retrieved_at:cpWaves?.generated_at??null},
      tide_policy: {source:'The Tide Chart',model:'FES2022',acquisition:'monthly cached quotation; original retrieval time preserved',coverage:'11 matched named localities plus 8 explicitly labeled nearest-locality proxies, not exact shoreline measurements',missing_beaches:outBeaches.filter(b=>!b.days?.some(d=>d.tides?.available)).map(b=>b.id)},
      sources: [
        {name:'The Tide Chart tide predictions',url:'https://www.thetidechart.com/terms',license:'Prediction quotation with source-page backlink'},
        {name:'Copernicus Mediterranean Waves (MED-WAV WAM Cycle 6)',url:'https://data.marine.copernicus.eu/product/MEDSEA_ANALYSISFORECAST_WAV_006_017/description',doi:'10.48670/mds-00373',license:'Copernicus Marine Service licence'},
        { name: 'Open-Meteo Marine API', url: 'https://open-meteo.com/en/docs/marine-weather-api', license: 'CC BY 4.0' },
        { name: 'Open-Meteo Forecast API', url: 'https://open-meteo.com/en/docs', license: 'CC BY 4.0' },
        { name: 'Météo-France MFWAM/SMOC (Copernicus Marine Service)', url: 'https://doi.org/10.48670/moi-00017', license: 'Copernicus' },
        { name: 'ECMWF WAM', url: 'https://www.ecmwf.int', license: 'CC BY 4.0' },
        { name: 'NOAA NCEP GFS Wave', url: 'https://www.ncei.noaa.gov', license: 'public domain' },
        { name: 'DWD EWAM/GWAM', url: 'https://www.dwd.de', license: 'CC BY 4.0' }
      ],
      attribution_he: 'גלים עיקריים: Copernicus MED-WAV כשזמין, אחרת Open-Meteo מסומן כגיבוי. השוואת גלים: ECMWF WAM ו-GFS Wave דרך Open-Meteo. יתר נתוני ים ומזג אוויר דרך Open-Meteo (CC BY 4.0), המשלב מודלים של Météo-France/Copernicus Marine Service (MFWAM, SMOC), ECMWF WAM, NOAA NCEP GFS Wave ו-DWD. גובה פני ים ממודל בלבד, דיוק מוגבל בחוף. מלוא ירח ואור ראשון/אחרון מחושבים.',
      data_availability: DATA_AVAILABILITY,
      scoring_note_he: 'כרטיסי הדגים איכותניים בלבד, בהיקף דיג ז\'ירז\'ור מהחוף - ללא ציון התאמה מספרי: אין מקור מאומת לספי עונה/שעות/גלים/רוח/טמפרטורה למין. צבע הגלים וצבע הרוח המתמשכת מוצגים בנפרד, לפי השיא היומי או בטווח השעות. עמודת התנאים מחזירה את ציון ההשוואה הניסיוני המקורי 0–100, המחושב מממוצעי החלון ומשבים, בנפרד מסולם הצבעים של המדידות. הסולם מקומי וניסיוני, לא תחזית תפיסה ולא דירוג בטיחות.',
      stale_beaches: staleBeaches
    },
    beaches: outBeaches
  };

  if(imsBlock.available){ const ip=path.join(DATA,'ims-latest.json');fs.writeFileSync(ip+'.tmp',JSON.stringify({...imsBlock,checked_at:nowUtc.toISOString(),source_url:'https://ims.gov.il/he/coasts'},null,1)+'\n');fs.renameSync(ip+'.tmp',ip); }
  fs.mkdirSync(path.join(DATA, 'issues'), { recursive: true });
  const issuePath = path.join(DATA, 'issues', `${issueId}.json`);
  // Exclusive create: never overwrite an existing issue file (immutability).
  fs.writeFileSync(issuePath, JSON.stringify(issue, null, 1), { flag: 'wx' });
  // latest.json is the mutable pointer, written atomically (tmp + rename) so readers never see a torn file.
  const tmpPath = prevLatestPath + '.tmp';
  fs.writeFileSync(tmpPath, JSON.stringify({ ...issue, meta: { ...issue.meta, issue_file: `issues/${issueId}.json` } }, null, 1));
  fs.renameSync(tmpPath, prevLatestPath);

  const indexPath = path.join(DATA, 'archive-index.json');
  const index = fs.existsSync(indexPath) ? JSON.parse(fs.readFileSync(indexPath, 'utf8')) : { issues: [] };
  index.issues = index.issues.filter(x => x.issue_id !== issueId);
  index.issues.unshift({ issue_id: issueId, file: `issues/${issueId}.json`, issued_at_local: issuedLocal, valid_from: issue.meta.valid_from, valid_to: issue.meta.valid_to });
  fs.writeFileSync(indexPath, JSON.stringify(index, null, 1));

  console.log(`OK issue ${issueId}: ${outBeaches.length} beaches, ${outBeaches[0]?.days?.length ?? 0} days/beach, stale: [${staleBeaches.join(',') || 'none'}]`);
}

main();
