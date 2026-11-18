const { chromium } = require('playwright-core');
(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const out = {};
  const p = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await p.goto('http://127.0.0.1:8734/index.html', { waitUntil: 'networkidle' });
  out.heroBest = await p.evaluate(() => document.querySelector('.best')?.innerText);
  out.selectedDay = await p.evaluate(() => document.querySelector('.day.sel .dt')?.innerText);
  // click first day (Nov 18, historical now is same day though) -> click a non-today day then day 0
  await p.evaluate(() => document.querySelectorAll('.day')[3].click());
  out.afterClick3 = await p.evaluate(() => document.querySelector('.day.sel .dt')?.innerText);
  await p.evaluate(() => document.querySelectorAll('.day')[0].click());
  out.afterClick0 = await p.evaluate(() => ({ sel: document.querySelector('.day.sel .dt')?.innerText, best: document.querySelector('.best')?.innerText }));
  // species provenance line present on every scored card
  out.provLines = await p.evaluate(() => [...document.querySelectorAll('.card.sp')].map(c => c.innerText.includes('מקורות:')).filter(Boolean).length);
  out.confLabels = await p.evaluate(() => [...new Set([...document.querySelectorAll('.card.sp .conf b')].map(x => x.innerText))]);
  // archive now empty -> placeholder text
  out.archiveEmpty = await p.evaluate(() => document.body.innerText.includes('הארכיון נבנה עם ההפקות היומיות'));
  console.log(JSON.stringify(out, null, 1));
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
