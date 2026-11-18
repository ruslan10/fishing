const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');

const OUT = __dirname;
const SHOTS = '/downloads';

const DATA = {
  title: 'תחזית דייג',
  subtitle: 'תחזית דיג לחופי ישראל',
  issued: 'הופק: ד׳ 18.11.2026 · 17:00',
  regions: ['צפון', 'מרכז', 'דרום'],
  activeRegion: 'מרכז',
  beaches: ['קיסריה', 'נתניה', 'הרצליה', 'תל אביב - פרישמן', 'יפו', 'ראשון לציון'],
  activeBeach: 'תל אביב - פרישמן',
  hero: {
    wave: '0.5–0.8 מ׳',
    wind: 'מערבית-צפונית · 12 קמ״ש',
    sst: '24.0°',
    bestWindow: '05:30–08:00',
    light: 'אור ראשון 05:45 · זריחה 06:12 · שקיעה 16:40'
  },
  days: [
    { d: 'רביעי', date: '18.11', score: 82, wave: 0.6, today: true },
    { d: 'חמישי', date: '19.11', score: 76, wave: 0.7 },
    { d: 'שישי', date: '20.11', score: 64, wave: 0.9 },
    { d: 'שבת', date: '21.11', score: 55, wave: 1.1 },
    { d: 'ראשון', date: '22.11', score: 61, wave: 0.8 },
    { d: 'שני', date: '23.11', score: 70, wave: 0.5 },
    { d: 'שלישי', date: '24.11', score: 58, wave: 0.7 }
  ],
  windows: [
    { t: '04:00–06:00', wave: 0.5, wind: '8 צ״מ', score: 78 },
    { t: '06:00–08:00', wave: 0.6, wind: '10 מ״צ', score: 84 },
    { t: '08:00–10:00', wave: 0.7, wind: '14 מ״צ', score: 71 },
    { t: '10:00–12:00', wave: 0.8, wind: '18 מערבית', score: 52 },
    { t: '12:00–14:00', wave: 0.9, wind: '22 מערבית', score: 40 },
    { t: '14:00–16:00', wave: 0.9, wind: '20 מערבית', score: 44 },
    { t: '16:00–18:00', wave: 0.8, wind: '16 מ״צ', score: 63 },
    { t: '18:00–20:00', wave: 0.7, wind: '12 צפונית', score: 58 }
  ],
  species: [
    { he: 'לוקו', lat: 'Pomatomus saltatrix', season: 'בעונה', seasonKind: 'on', hours: 'שחר וערב', score: 82,
      reasons: ['גלים מתונים', 'רוח חלשה בשחר', 'מעבר סתיו'], conf: 'בינונית', confKind: 'mid' },
    { he: 'אינטיאס', lat: 'Seriola dumerili', season: 'בעונה', seasonKind: 'on', hours: 'בוקר', score: 74,
      reasons: ['מים 24° יחסית חמים', 'מבנים וסלעים'], conf: 'בינונית', confKind: 'mid' },
    { he: 'לברק', lat: 'Dicentrarchus labrax', season: 'בעונה', seasonKind: 'on', hours: 'לילה ושחר', score: 68,
      reasons: ['מים מתקררים', 'פעילות לילית'], conf: 'נמוכה', confKind: 'low' },
    { he: 'מוסר', lat: 'Argyrosomus regius', season: 'סוף עונה', seasonKind: 'end', hours: 'ערב ולילה', score: 45,
      reasons: ['מים עדיין חמים', 'דורש שקט'], conf: 'נמוכה', confKind: 'low' },
    { he: 'טונית אטלנטית', lat: 'Euthynnus alletteratus', season: 'סוף עונה', seasonKind: 'end', hours: 'בוקר', score: 38,
      reasons: ['מעבר מים קרים'], conf: 'נמוכה', confKind: 'low' },
    { he: 'ברקודה', lat: 'Sphyraena sphyraena', season: 'לא בעונה', seasonKind: 'off', hours: 'קיץ', score: 22,
      reasons: ['מים מתקררים מדי'], conf: 'בינונית', confKind: 'mid' }
  ]
};

const BASE_CSS = `
  * { margin:0; padding:0; box-sizing:border-box; }
  html { direction: rtl; }
  body { font-family:'Heebo','Segoe UI',Arial,sans-serif; color:var(--fg); background:var(--bg); -webkit-font-smoothing:antialiased; }
  .wrap { max-width:430px; margin:0 auto; padding:18px 16px 30px; }
  .tag-sample { display:inline-block; font-size:11px; padding:2px 8px; border-radius:99px; background:var(--sample-bg); color:var(--sample-fg); }
  header h1 { font-size:30px; font-weight:800; letter-spacing:.2px; }
  header .sub { font-size:13px; opacity:.75; margin-top:2px; }
  header .issued { font-size:11px; opacity:.6; margin-top:6px; }
  .tabs { display:flex; gap:8px; margin:16px 0 10px; }
  .tab { flex:1; text-align:center; padding:8px 0; border-radius:12px; font-size:14px; font-weight:700; background:var(--chip-bg); color:var(--chip-fg); border:1px solid var(--chip-border); }
  .tab.on { background:var(--accent); color:var(--accent-fg); border-color:transparent; }
  .chips { display:flex; gap:7px; overflow:hidden; flex-wrap:wrap; margin-bottom:14px; }
  .chip { padding:6px 12px; border-radius:99px; font-size:12.5px; font-weight:600; background:var(--chip-bg); color:var(--chip-fg); border:1px solid var(--chip-border); }
  .chip.on { background:var(--accent-2); color:var(--accent-2-fg); border-color:transparent; }
  .card { background:var(--card-bg); border:1px solid var(--card-border); border-radius:var(--radius); padding:14px; margin-bottom:12px; box-shadow:var(--card-shadow); backdrop-filter:var(--card-blur); }
  .hero h2 { font-size:15px; font-weight:800; margin-bottom:10px; }
  .hero-grid { display:grid; grid-template-columns:1fr 1fr; gap:8px; }
  .hg { background:var(--inset-bg); border-radius:10px; padding:9px 10px; }
  .hg .k { font-size:11px; opacity:.65; }
  .hg .v { font-size:15px; font-weight:800; margin-top:1px; }
  .hero .light { margin-top:10px; font-size:11.5px; opacity:.7; }
  .best { margin-top:10px; padding:9px 12px; border-radius:10px; background:var(--best-bg); color:var(--best-fg); font-weight:800; font-size:14px; display:flex; justify-content:space-between; align-items:center; }
  .best small { font-weight:600; font-size:11px; opacity:.8; }
  h3.sec { font-size:14px; font-weight:800; margin:16px 0 8px; opacity:.9; }
  .days { display:grid; grid-template-columns:repeat(7,1fr); gap:5px; }
  .day { text-align:center; padding:7px 2px; border-radius:10px; background:var(--inset-bg); }
  .day.today { outline:2px solid var(--accent); }
  .day .dd { font-size:10px; opacity:.65; }
  .day .dt { font-size:10.5px; font-weight:700; }
  .day .sc { font-size:14px; font-weight:800; margin-top:3px; }
  .day .wv { font-size:9.5px; opacity:.6; }
  table.win { width:100%; border-collapse:collapse; font-size:12.5px; }
  table.win th { text-align:right; font-size:11px; opacity:.6; font-weight:600; padding:5px 4px; }
  table.win td { padding:7px 4px; border-top:1px solid var(--row-border); }
  .bar { height:6px; border-radius:99px; background:var(--bar-bg); overflow:hidden; min-width:54px; }
  .bar i { display:block; height:100%; border-radius:99px; }
  .score-num { font-weight:800; font-size:13px; }
  .sp-grid { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
  .sp { padding:12px; }
  .sp .nm { font-size:16px; font-weight:800; }
  .sp .lt { font-size:10px; opacity:.55; direction:ltr; text-align:right; }
  .badges { display:flex; gap:5px; margin:8px 0; flex-wrap:wrap; }
  .bdg { font-size:10.5px; font-weight:700; padding:3px 8px; border-radius:99px; }
  .bdg.on { background:var(--ok-bg); color:var(--ok-fg); }
  .bdg.end { background:var(--warn-bg); color:var(--warn-fg); }
  .bdg.off { background:var(--off-bg); color:var(--off-fg); }
  .bdg.hrs { background:var(--inset-bg); color:var(--fg); opacity:.85; }
  .sp .scoreline { display:flex; align-items:center; gap:8px; margin:6px 0; }
  .reasons { display:flex; flex-wrap:wrap; gap:4px; margin-top:6px; }
  .rsn { font-size:10px; padding:2px 7px; border-radius:99px; background:var(--inset-bg); opacity:.85; }
  .conf { margin-top:8px; font-size:10.5px; opacity:.75; }
  .conf b { font-weight:800; }
  footer { margin-top:18px; font-size:10.5px; line-height:1.7; opacity:.6; }
`;

const THEMES = {
  a: {
    name: 'mockup-a-night-sea',
    css: `
      :root {
        --bg:#0a1622; --fg:#e8f1f8;
        --card-bg:#101f30; --card-border:#1d3349; --card-shadow:none; --card-blur:none; --radius:16px;
        --accent:#2fd4ff; --accent-fg:#04222e; --accent-2:#ffb454; --accent-2-fg:#3a2404;
        --chip-bg:#12253a; --chip-fg:#a9c4d8; --chip-border:#1d3349;
        --inset-bg:#0c1a29; --row-border:#1a2f44; --bar-bg:#1a2f44;
        --ok-bg:#0e3b2e; --ok-fg:#4fe3a5; --warn-bg:#3d2c07; --warn-fg:#ffcf6e; --off-bg:#3a1a1a; --off-fg:#ff9a8a;
        --best-bg:#0e3b2e; --best-fg:#4fe3a5;
        --sample-bg:#33270a; --sample-fg:#ffcf6e;
      }
      body { background:radial-gradient(1200px 500px at 80% -10%, #123b52 0%, #0a1622 55%); }
      header h1 { color:#2fd4ff; }
    `
  },
  b: {
    name: 'mockup-b-beach-light',
    css: `
      :root {
        --bg:#f7f3ea; --fg:#21303a;
        --card-bg:#ffffff; --card-border:#e7e0d2; --card-shadow:0 1px 4px rgba(60,50,20,.07); --card-blur:none; --radius:16px;
        --accent:#0e7c7b; --accent-fg:#ffffff; --accent-2:#e8f4f3; --accent-2-fg:#0e7c7b;
        --chip-bg:#ffffff; --chip-fg:#5c6b74; --chip-border:#e0d8c8;
        --inset-bg:#f4efe4; --row-border:#ece5d6; --bar-bg:#e9e2d2;
        --ok-bg:#e2f4e8; --ok-fg:#177a45; --warn-bg:#fdf1d7; --warn-fg:#9a6b0a; --off-bg:#fbe4e0; --off-fg:#b23c2a;
        --best-bg:#0e7c7b; --best-fg:#ffffff;
        --sample-bg:#fdf1d7; --sample-fg:#9a6b0a;
      }
      header h1 { color:#0e7c7b; }
    `
  },
  c: {
    name: 'mockup-c-glass-wave',
    css: `
      :root {
        --bg:#0b2440; --fg:#f2f7ff;
        --card-bg:rgba(255,255,255,.08); --card-border:rgba(255,255,255,.16); --card-shadow:0 8px 24px rgba(0,10,30,.25); --card-blur:blur(10px); --radius:20px;
        --accent:#7c5cff; --accent-fg:#ffffff; --accent-2:#22d3ee; --accent-2-fg:#032730;
        --chip-bg:rgba(255,255,255,.07); --chip-fg:#c7d6ea; --chip-border:rgba(255,255,255,.14);
        --inset-bg:rgba(255,255,255,.06); --row-border:rgba(255,255,255,.12); --bar-bg:rgba(255,255,255,.14);
        --ok-bg:rgba(46,213,115,.18); --ok-fg:#5cf0b0; --warn-bg:rgba(255,196,66,.16); --warn-fg:#ffd97a; --off-bg:rgba(255,107,107,.16); --off-fg:#ffa3a3;
        --best-bg:linear-gradient(90deg,#7c5cff,#22d3ee); --best-fg:#ffffff;
        --sample-bg:rgba(255,196,66,.16); --sample-fg:#ffd97a;
      }
      body { background:linear-gradient(160deg,#0b2440 0%, #0e4d64 45%, #3b2a6e 100%); }
      header h1 { background:linear-gradient(90deg,#22d3ee,#a78bfa); -webkit-background-clip:text; background-clip:text; color:transparent; }
    `
  }
};

function scoreColor(s) {
  if (s >= 70) return 'var(--ok-fg)';
  if (s >= 45) return 'var(--warn-fg)';
  return 'var(--off-fg)';
}

function seasonBadge(sp) {
  return `<span class="bdg ${sp.seasonKind}">${sp.season === 'בעונה' ? '✓ ' : sp.seasonKind === 'end' ? '~ ' : '✕ '}${sp.season}</span>`;
}

function html(theme) {
  const d = DATA;
  return `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<link href="https://fonts.googleapis.com/css2?family=Heebo:wght@400;600;700;800&display=swap" rel="stylesheet">
<style>${BASE_CSS}${theme.css}</style></head><body><div class="wrap">
<header>
  <h1>${d.title} <span class="tag-sample">מיקאפ עיצוב · נתוני דוגמה</span></h1>
  <div class="sub">${d.subtitle}</div>
  <div class="issued">${d.issued}</div>
</header>
<div class="tabs">${d.regions.map(r => `<div class="tab ${r === d.activeRegion ? 'on' : ''}">${r}</div>`).join('')}</div>
<div class="chips">${d.beaches.map(b => `<span class="chip ${b === d.activeBeach ? 'on' : ''}">${b}</span>`).join('')}</div>

<div class="card hero">
  <h2>${d.activeBeach} · היום</h2>
  <div class="hero-grid">
    <div class="hg"><div class="k">גלים</div><div class="v">${d.hero.wave}</div></div>
    <div class="hg"><div class="k">רוח</div><div class="v">${d.hero.wind}</div></div>
    <div class="hg"><div class="k">מי ים</div><div class="v">${d.hero.sst}</div></div>
    <div class="hg"><div class="k">לילה</div><div class="v">ירח 62%</div></div>
  </div>
  <div class="best"><span>החלון המומלץ: ${d.hero.bestWindow}</span><small>ציון 84</small></div>
  <div class="light">${d.hero.light}</div>
</div>

<h3 class="sec">שבעת הימים הקרובים</h3>
<div class="card"><div class="days">${d.days.map(x => `
  <div class="day ${x.today ? 'today' : ''}"><div class="dd">${x.d}</div><div class="dt">${x.date}</div>
  <div class="sc" style="color:${scoreColor(x.score)}">${x.score}</div><div class="wv">${x.wave} מ׳</div></div>`).join('')}</div></div>

<h3 class="sec">חלונות דיג להיום (שעתיים)</h3>
<div class="card"><table class="win">
<tr><th>שעות</th><th>גלים</th><th>רוח</th><th style="width:90px">התאמה</th></tr>
${d.windows.map(w => `<tr><td>${w.t}</td><td>${w.wave} מ׳</td><td>${w.wind}</td>
<td><div style="display:flex;align-items:center;gap:6px"><span class="score-num" style="color:${scoreColor(w.score)}">${w.score}</span>
<span class="bar"><i style="width:${w.score}%;background:${scoreColor(w.score)}"></i></span></div></td></tr>`).join('')}
</table></div>

<h3 class="sec">דגי טורפים · התאמה להיום</h3>
<div class="sp-grid">${d.species.map(sp => `
  <div class="card sp">
    <div class="nm">${sp.he}</div><div class="lt">${sp.lat}</div>
    <div class="badges">${seasonBadge(sp)}<span class="bdg hrs">${sp.hours}</span></div>
    <div class="scoreline"><span class="score-num" style="color:${scoreColor(sp.score)};font-size:20px">${sp.score}</span>
      <span class="bar" style="flex:1"><i style="width:${sp.score}%;background:${scoreColor(sp.score)}"></i></span></div>
    <div class="reasons">${sp.reasons.map(r => `<span class="rsn">${r}</span>`).join('')}</div>
    <div class="conf">ביטחון בהערכה: <b>${sp.conf}</b></div>
  </div>`).join('')}
</div>

<footer>
  מקורות תנאים: Open-Meteo (רוח, גלים, טמפ׳ מים) · הערכות עונה ושעות: מדריכי דיג מקומיים, ללא אימות מדעי מלא.<br>
  הציון הוא התאמת תנאים ניסיונית עם הסבר — לא אחוז תפיסה ולא הבטחה. דגים מוגנים בחוק אינם מומלצים.<br>
  ארכיון תחזיות נשמר מדי יום בקבצי נתונים מתוארכים.
</footer>
</div></body></html>`;
}

(async () => {
  for (const key of Object.keys(THEMES)) {
    const t = THEMES[key];
    const file = path.join(OUT, t.name + '.html');
    fs.writeFileSync(file, html(t));
  }
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  for (const key of Object.keys(THEMES)) {
    const t = THEMES[key];
    await page.goto('file://' + path.join(OUT, t.name + '.html'), { waitUntil: 'networkidle' });
    await page.screenshot({ path: path.join(SHOTS, t.name + '.png'), fullPage: true });
    console.log('rendered', t.name);
  }
  await browser.close();
})();
