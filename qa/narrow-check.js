const { chromium } = require('playwright-core');
(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const p = await browser.newPage({ viewport: { width: 320, height: 700 } });
  await p.goto('http://127.0.0.1:8734/index.html', { waitUntil: 'networkidle' });
  const out = await p.evaluate(() => ({
    pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    tableScrollable: (() => { const w = document.querySelector('.winwrap'); return w ? w.scrollWidth > w.clientWidth : null; })(),
    clippedBars: [...document.querySelectorAll('.bar')].filter(b => { const r = b.getBoundingClientRect(); const c = b.closest('.winwrap').getBoundingClientRect(); return r.right > c.right + 1; }).length
  }));
  console.log(JSON.stringify(out));
  await p.screenshot({ path: '/downloads/mobile-320.png', clip: { x: 0, y: 0, width: 320, height: 700 } });
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
