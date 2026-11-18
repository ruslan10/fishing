const { chromium } = require('playwright-core');
(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const out = {};
  // Desktop layout proof
  const d = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await d.goto('http://127.0.0.1:8734/index.html', { waitUntil: 'networkidle' });
  out.desktop = {
    spCols: await d.evaluate(() => getComputedStyle(document.querySelector('.sp-grid')).gridTemplateColumns.split(' ').length),
    heroCols: await d.evaluate(() => getComputedStyle(document.querySelector('.hero-grid')).gridTemplateColumns.split(' ').length),
    overflowX: await d.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  };
  await d.screenshot({ path: '/downloads/site-desktop-v2.png', fullPage: true });
  // No bare numeric condition scores anywhere
  out.numericLeaks = await d.evaluate(() => {
    const t = document.body.innerText;
    return { scoreNumEls: document.querySelectorAll('.score-num').length,
      condWordSample: (t.match(/תנאים (מצוינים|טובים|בינוניים|חלשים|גרועים|חסר)/g) || []).slice(0,3),
      hasScoreLabel: /ציון תנאים \d/.test(t), hasPctSuitability: /\d{2,3}%? התאמה|התאמה \d/.test(t) };
  });
  // Direction labels
  out.dirLabels = await d.evaluate(() => {
    const t = document.body.innerText;
    return { windFrom: /קמ״ש מ/.test(t), currentTo: /קמ״ש ל/.test(t), conventionNote: t.includes('שממנו') };
  });
  // Failure state: latest.json 503 -> readable error, no permanent spinner
  const f = await browser.newPage();
  await f.route('**/data/latest.json', r => r.fulfill({ status: 503, body: 'err' }));
  await f.goto('http://127.0.0.1:8734/index.html', { waitUntil: 'networkidle' });
  out.failState = await d.evaluate(() => null); // placeholder
  out.failState = await f.evaluate(() => ({ shown: document.body.innerText.includes('טעינת הנתונים נכשלה'), retryBtn: !!document.querySelector('button') }));
  // Archive view uses frozen snapshot (old issue without snapshot still renders)
  const a = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await a.goto('http://127.0.0.1:8734/index.html?issue=2026-11-18T19-54-38-a22042', { waitUntil: 'networkidle' });
  out.archiveLegacy = await a.evaluate(() => ({ cards: document.querySelectorAll('.card.sp').length, archiveNote: document.body.innerText.includes('מוצגת הפקה מהארכיון') }));
  await a.screenshot({ path: '/downloads/site-mobile-v2.png', fullPage: true });
  console.log(JSON.stringify(out, null, 1));
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
