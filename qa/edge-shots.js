const { chromium } = require('playwright-core');
(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  await page.goto(process.argv[2], { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  const cards = page.locator('.sp-grid .card.sp');
  await cards.nth(0).scrollIntoViewIfNeeded(); await page.evaluate(() => window.scrollBy(0,-60)); await page.waitForTimeout(250);
  await page.screenshot({ path: process.argv[3] });
  await cards.nth(12).scrollIntoViewIfNeeded(); await page.waitForTimeout(250);
  await page.screenshot({ path: process.argv[4] });
  await browser.close();
})();
