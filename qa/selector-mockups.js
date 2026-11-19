// Visual mockups: beach selection without horizontal scrolling.
// Loads the real local site, switches to the north region (most beaches),
// then re-styles the chips area three ways and screenshots each at 390px.
const { chromium } = require('playwright-core');

const OUT = [
  ['a-wrap', '/downloads/mock-sel-a-wrap.png'],
  ['b-dropdown', '/downloads/mock-sel-b-dropdown.png'],
  ['c-list', '/downloads/mock-sel-c-list.png'],
];

(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('http://localhost:8734/', { waitUntil: 'networkidle' });
  await page.locator('.tab', { hasText: 'צפון' }).click();
  await page.waitForTimeout(200);

  // Option A: chips wrap onto multiple rows (same look, no sideways scroll)
  await page.addStyleTag({ content: `.chips{flex-wrap:wrap !important; overflow-x:visible !important;}` });
  await page.screenshot({ path: OUT[0][1] });
  await page.addStyleTag({ content: `.chips{flex-wrap:nowrap !important; overflow-x:auto !important;}` });

  // Option B: compact dropdown row (native select styled to the theme)
  await page.evaluate(() => {
    const chips = document.querySelector('.chips');
    const sel = document.createElement('select');
    sel.id = 'mock-select';
    [...chips.querySelectorAll('.chip')].forEach(c => {
      const o = document.createElement('option');
      o.textContent = c.textContent;
      if (c.classList.contains('on')) o.selected = true;
      sel.appendChild(o);
    });
    chips.style.display = 'none';
    chips.parentNode.insertBefore(sel, chips);
  });
  await page.addStyleTag({ content: `
    #mock-select{ width:100%; margin-bottom:14px; padding:11px 14px; border-radius:12px;
      background:var(--chip-bg); color:var(--fg); border:1px solid var(--chip-border);
      font-size:15px; font-weight:700; font-family:inherit; appearance:none;
      background-image:linear-gradient(45deg,transparent 50%,var(--fg) 50%),linear-gradient(135deg,var(--fg) 50%,transparent 50%);
      background-position:calc(0% + 18px) 50%,calc(0% + 13px) 50%; background-size:5px 5px; background-repeat:no-repeat; }
  ` });
  await page.screenshot({ path: OUT[1][1] });
  await page.evaluate(() => {
    document.getElementById('mock-select').remove();
    document.querySelector('.chips').style.display = '';
  });

  // Option C: vertical full-width list, one beach per row, check mark on the selected
  await page.evaluate(() => {
    const chips = document.querySelector('.chips');
    const list = document.createElement('div');
    list.id = 'mock-list';
    [...chips.querySelectorAll('.chip')].forEach(c => {
      const row = document.createElement('div');
      row.className = 'mock-row' + (c.classList.contains('on') ? ' on' : '');
      row.innerHTML = `<span>${c.textContent}</span><span class="mock-check">${c.classList.contains('on') ? '✓' : ''}</span>`;
      list.appendChild(row);
    });
    chips.style.display = 'none';
    chips.parentNode.insertBefore(list, chips);
  });
  await page.addStyleTag({ content: `
    #mock-list{ display:flex; flex-direction:column; gap:6px; margin-bottom:14px; }
    .mock-row{ display:flex; justify-content:space-between; align-items:center; padding:11px 14px;
      border-radius:12px; background:var(--chip-bg); color:var(--chip-fg);
      border:1px solid var(--chip-border); font-size:14px; font-weight:600; }
    .mock-row.on{ background:var(--accent-2); color:var(--accent-2-fg); border-color:transparent; }
    .mock-check{ font-weight:800; }
  ` });
  await page.screenshot({ path: OUT[2][1] });

  console.log('errors:', errors.length ? errors : 'none');
  await browser.close();
})();
