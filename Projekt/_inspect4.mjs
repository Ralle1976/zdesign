// Generic: find ALL image nodes and trace upward for any 0-width one
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
      await sleep(12000);

      // Find all images and their dimensions
      const result = await page.evaluate(() => {
        const imgs = [...document.querySelectorAll('[data-node-type="image"]')];
        const out = [];
        for (const img of imgs) {
          const r = img.getBoundingClientRect();
          const cs = getComputedStyle(img);
          const entry = {
            id: img.getAttribute('data-node-id'),
            w: Math.round(r.width),
            h: Math.round(r.height),
            collapsed: r.width < 50,
          };
          // If collapsed, trace 4 ancestors
          if (r.width < 50) {
            entry.chain = [];
            let el = img.parentElement;
            for (let i = 0; i < 5 && el; i++) {
              const pr = el.getBoundingClientRect();
              const pcs = getComputedStyle(el);
              entry.chain.push({
                tag: el.tagName,
                id: el.getAttribute('data-node-id'),
                w: Math.round(pr.width),
                h: Math.round(pr.height),
                display: pcs.display,
                width: pcs.width,
                gridColumn: pcs.gridColumn,
              });
              el = el.parentElement;
            }
          }
          out.push(entry);
        }
        return out;
      });

      console.log('\n=== ALL IMAGES ===');
      result.forEach(im => {
        const status = im.collapsed ? '❌ COLLAPSED' : '✅';
        console.log(`  ${status} ${im.id}: ${im.w}x${im.h}`);
        if (im.chain) {
          console.log('   Parent chain:');
          im.chain.forEach((c, i) => {
            console.log(`     [${i}] <${c.tag}> id=${c.id} ${c.w}x${c.h} display=${c.display} width=${c.width} gridCol=${c.gridColumn}`);
          });
        }
      });

      await page.screenshot({ path: '_inspect_bakery2.png' });
      break;
    }
  } catch (e) {
    console.log(`tick ${s}: ${e.message.slice(0, 60)}`);
  }
}
await browser.close();
