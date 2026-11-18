const { chromium } = require('playwright-core');
(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const p = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await p.goto('http://127.0.0.1:8734/index.html', { waitUntil: 'networkidle' });
  const out = await p.evaluate(() => {
    const cards = [...document.querySelectorAll('.card.sp')];
    const bad = [];
    for (const c of cards) {
      const cr = c.getBoundingClientRect();
      for (const el of c.querySelectorAll('*')) {
        const r = el.getBoundingClientRect();
        if (r.width && (r.left < cr.left - 1 || r.right > cr.right + 1)) bad.push(c.querySelector('.nm')?.innerText + ':' + el.className);
        if (el.children.length === 0 && el.scrollWidth > el.clientWidth + 1) bad.push(c.querySelector('.nm')?.innerText + ':textclip:' + el.className);
      }
    }
    return { cards: cards.length, cols: getComputedStyle(document.querySelector('.sp-grid')).gridTemplateColumns.split(' ').length, overflowEls: bad.slice(0, 10), badCount: bad.length };
  });
  console.log(JSON.stringify(out, null, 1));
  const card = await p.$('.card.sp');
  await card.screenshot({ path: '/downloads/mobile-species-390.png' });
  const cards = await p.$$('.card.sp');
  if (cards[1]) await cards[1].screenshot({ path: '/downloads/mobile-species2-390.png' });
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
