const { chromium } = require('playwright-core');
(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const out = {};
  for (const w of [320, 390, 640, 768, 1280]) {
    const p = await browser.newPage({ viewport: { width: w, height: 800 } });
    await p.goto('http://127.0.0.1:8734/index.html', { waitUntil: 'networkidle' });
    out[w] = await p.evaluate(() => ({
      pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      spCols: getComputedStyle(document.querySelector('.sp-grid')).gridTemplateColumns.split(' ').length,
      errors: []
    }));
    await p.close();
  }
  console.log(JSON.stringify(out));
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
