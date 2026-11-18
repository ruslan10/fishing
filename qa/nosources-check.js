const { chromium } = require('playwright-core');
(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const p = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await p.goto('http://127.0.0.1:8734/index.html', { waitUntil: 'networkidle' });
  // open the methodology details too, then scan whole body
  await p.evaluate(() => document.querySelectorAll('details').forEach(d => d.open = true));
  const out = await p.evaluate(() => {
    const t = document.body.innerText;
    return {
      hasSourceLabel: t.includes('מקורות'),
      hasWiki: /wikipedia|fishbase|babajig|riptide|fishnetil/i.test(t),
      footerAttribution: document.querySelector('footer')?.innerText.slice(0, 160),
      cards: document.querySelectorAll('.card.sp').length
    };
  });
  console.log(JSON.stringify(out, null, 1));
  const card = await p.$('.card.sp');
  await card.screenshot({ path: '/downloads/mobile-species-390.png' });
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
