// Deep DOM inspection: find the ACTUAL computed style of the 7px image container
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
await sleep(3000);

// Generate bakery
const ta = await page.$('textarea');
await ta.focus();
await page.keyboard.down('Control'); await page.keyboard.press('A'); await page.keyboard.up('Control');
await page.keyboard.press('Backspace'); await sleep(200);
await page.keyboard.type('Erstelle eine Landingpage fuer eine traditionelle Baeckerei mit Brot, Croissant und Kuchen');
await sleep(300); await page.keyboard.press('Enter');
console.log('Waiting for generation...');

for (let s = 0; s < 40; s++) {
  await sleep(5000);
  try {
    const text = await page.evaluate(() => document.body.innerText.slice(0, 500));
    if (!text.includes('Designing') && !text.includes('Generating') && s > 2) {
      console.log(`Done at ${s*5}s`);

      // Find the hero image node by data-node-id
      const heroImg = await page.evaluate(() => {
        const el = document.querySelector('[data-node-id="hero-image"]');
        if (!el) return { found: false };
        const cs = getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        const parent = el.parentElement;
        const pcs = parent ? getComputedStyle(parent) : null;
        const prect = parent ? parent.getBoundingClientRect() : null;
        return {
          found: true,
          width: rect.width,
          height: rect.height,
          top: rect.top,
          left: rect.left,
          computed: {
            display: cs.display,
            width: cs.width,
            height: cs.height,
            minWidth: cs.minWidth,
            maxWidth: cs.maxWidth,
            flex: cs.flex,
            gridColumn: cs.gridColumn,
            gridRow: cs.gridRow,
            backgroundImage: cs.backgroundImage?.slice(0, 100),
            position: cs.position,
          },
          parent: {
            tag: parent?.tagName,
            id: parent?.getAttribute('data-node-id'),
            width: prect?.width,
            height: prect?.height,
            computed: pcs ? {
              display: pcs.display,
              gridTemplateColumns: pcs.gridTemplateColumns,
              gridTemplateRows: pcs.gridTemplateRows,
            } : null,
          },
        };
      });
      console.log('\n=== HERO IMAGE COMPUTED ===');
      console.log(JSON.stringify(heroImg, null, 2));

      // Also check all image nodes
      const allImgs = await page.evaluate(() => {
        return [...document.querySelectorAll('[data-node-type="image"]')].map(el => {
          const r = el.getBoundingClientRect();
          const cs = getComputedStyle(el);
          return {
            id: el.getAttribute('data-node-id'),
            w: Math.round(r.width),
            h: Math.round(r.height),
            display: cs.display,
            width: cs.width,
            height: cs.height,
          };
        });
      });
      console.log('\n=== ALL IMAGE NODES ===');
      console.log(JSON.stringify(allImgs, null, 2));

      break;
    }
  } catch (e) {
    console.log(`tick ${s}: ${e.message.slice(0, 60)}`);
  }
}

await browser.close();
