const { chromium } = require('playwright-core');
(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });
  await page.goto(process.argv[2], { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  // count species cards
  const cardCount = await page.locator('.sp-grid .card.sp').count();
  console.log('species cards:', cardCount);
  // hero shot (top of page incl. sun strip)
  await page.screenshot({ path: process.argv[3] });
  // scroll to species section and shoot 2 screens
  await page.locator('.sp-grid').scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  await page.screenshot({ path: process.argv[4] });
  // further down for grouper + remaining cards
  await page.evaluate(() => window.scrollBy(0, 700));
  await page.waitForTimeout(300);
  await page.screenshot({ path: process.argv[5] });
  console.log('errors:', errors.length ? errors : 'none');
  await browser.close();
})();
