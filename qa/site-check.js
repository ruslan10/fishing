const { chromium } = require('playwright-core');

(async () => {
  const base = 'http://127.0.0.1:8734';
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });

  // Mobile pass
  const m = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const errors = [];
  m.on('pageerror', e => errors.push('pageerror: ' + e.message));
  m.on('console', msg => { if (msg.type() === 'error') errors.push('console: ' + msg.text()); });
  await m.goto(base + '/index.html', { waitUntil: 'networkidle' });
  const overflowM = await m.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  await m.screenshot({ path: '/downloads/site-mobile-top.png' });
  await m.screenshot({ path: '/downloads/site-mobile-full.png', fullPage: true });

  // Interactions: switch region to north, pick beach, pick a day
  await m.click('.tab[data-region="north"]');
  await m.click('.chip[data-beach="achziv"]');
  await m.click('.day[data-day="3"]');
  await m.screenshot({ path: '/downloads/site-mobile-north-day3.png', fullPage: true });

  // Archive-issue view renders
  await m.goto(base + '/index.html', { waitUntil: 'networkidle' });
  const issueId = await m.evaluate(async () => (await (await fetch('data/archive-index.json')).json()).issues[0].issue_id);
  await m.goto(base + '/index.html?issue=' + issueId, { waitUntil: 'networkidle' });
  const archiveOk = await m.evaluate(() => document.body.innerText.includes('מוצגת הפקה מהארכיון'));

  // Desktop pass
  const d = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await d.goto(base + '/index.html', { waitUntil: 'networkidle' });
  await d.screenshot({ path: '/downloads/site-desktop.png', fullPage: true });

  // Content sanity checks
  const checks = await m.evaluate(() => {
    const t = document.body.innerText;
    return {
      hasTitle: t.includes('תחזית דייג'),
      hasDisclaimer: t.includes('אינה אחוז תפיסה'),
      hasAvailability: t.includes('אילו נתונים יש ואילו חסרים'),
      hasSpeciesSection: t.includes('דגי טורפים'),
      speciesCards: document.querySelectorAll('.sp').length,
      windowsRows: document.querySelectorAll('table.win tr').length,
      days: document.querySelectorAll('.day').length,
      chips: document.querySelectorAll('.chip').length
    };
  });

  console.log(JSON.stringify({ overflowM, archiveOk, checks, errors }, null, 1));
  await browser.close();
})();
