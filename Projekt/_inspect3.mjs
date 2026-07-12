// Precise DOM inspection of the hero image cascade
import puppeteer from 'puppeteer';
const sleep = ms => new Promise(r => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  headless: 'new',
  args: ['--no-sandbox', '--window-size=1280,900'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 900 });
await page.goto('http://localhost:3000', { waitUntil: 'networkidle2', timeout: 60000 });
await sleep(4000);

const ta = await page.$('textarea');
await ta.focus();
await page.keyboard.down('Control'); await page.keyboard.press('A'); await page.keyboard.up('Control');
await page.keyboard.press('Backspace'); await sleep(200);
await page.keyboard.type('Erstelle eine Landingpage fuer eine traditionelle Baeckerei');
await sleep(300); await page.keyboard.press('Enter');
console.log('Generating...');

for (let s = 0; s < 40; s++) {
  await sleep(5000);
  try {
    const text = await page.evaluate(() => document.body.innerText.slice(0, 500));
    if (!text.includes('Designing') && !text.includes('Generating') && s > 2) {
      console.log(`Done at ${s*5}s`);
      await sleep(10000); // images load

      // Walk the hero-image DOM chain UP to find who has 0 width
      const chain = await page.evaluate(() => {
        const img = document.querySelector('[data-node-id="hero-image"]');
        if (!img) return { found: false };
        const chain = [];
        let el = img;
        for (let i = 0; i < 6 && el; i++) {
          const r = el.getBoundingClientRect();
          const cs = getComputedStyle(el);
          chain.push({
            tag: el.tagName,
            nodeId: el.getAttribute('data-node-id'),
            w: Math.round(r.width),
            h: Math.round(r.height),
            display: cs.display,
            width: cs.width,
            height: cs.height,
            gridColumn: cs.gridColumn,
            gridArea: cs.gridArea,
            flex: cs.flex,
            position: cs.position,
          });
          el = el.parentElement;
        }
        return { found: true, chain };
      });

      console.log('\n=== DOM CHAIN from hero-image upward ===');
      if (chain.found) {
        chain.chain.forEach((c, i) => {
          const status = c.w === 0 ? '❌ ZERO' : '✅';
          console.log(`  [${i}] ${status} <${c.tag}> id=${c.nodeId} ${c.w}x${c.h}`);
          console.log(`       display=${c.display} width=${c.width} gridColumn=${c.gridColumn} flex=${c.flex}`);
        });
      }

      break;
    }
  } catch (e) {
    console.log(`tick ${s}: ${e.message.slice(0, 60)}`);
  }
}
await browser.close();
