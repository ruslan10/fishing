const { chromium } = require('playwright-core');
(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const p = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await p.goto('http://127.0.0.1:8734/index.html?issue=TESTEXPIRED', { waitUntil: 'networkidle' });
  const out = await p.evaluate(() => ({
    heroBest: document.querySelector('.best')?.innerText || null,
    warn: document.querySelector('.issued')?.innerText,
    greenRec: !!document.querySelector('.best:not([style])')
  }));
  console.log(JSON.stringify(out, null, 1));
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
