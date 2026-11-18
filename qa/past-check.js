const { chromium } = require('playwright-core');
(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const p = await browser.newPage();
  await p.goto('http://127.0.0.1:8734/index.html', { waitUntil: 'networkidle' });
  const r = await p.evaluate(() => ({
    pastRows: document.querySelectorAll('tr.past').length,
    totalRows: document.querySelectorAll('table.win tr').length - 1,
    heroBest: document.querySelector('.best')?.innerText
  }));
  console.log(JSON.stringify(r));
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
