const { chromium } = require('playwright-core');
(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const p = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await p.goto('http://127.0.0.1:8734/index.html', { waitUntil: 'networkidle' });
  await p.screenshot({ path: '/downloads/mobile-hero-390.png', clip: { x: 0, y: 0, width: 390, height: 844 } });
  const card = await p.$('.card.sp');
  await card.screenshot({ path: '/downloads/mobile-species-390.png' });
  await browser.close();
  console.log('done');
})().catch(e => { console.error(e); process.exit(1); });
