// Verify the image fix: generate bakery, measure ALL image dimensions
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
await sleep(4000); // wait for dev server HMR to apply the fix

// Type prompt
const ta = await page.$('textarea');
await ta.focus();
await page.keyboard.down('Control'); await page.keyboard.press('A'); await page.keyboard.up('Control');
await page.keyboard.press('Backspace'); await sleep(200);
await page.keyboard.type('Erstelle eine Landingpage fuer eine traditionelle Baeckerei mit Brot, Croissant und Kuchen');
await sleep(300); await page.keyboard.press('Enter');
console.log('=== VERIFY FIX: Bakery Design ===');
console.log('Waiting for generation...');

for (let s = 0; s < 40; s++) {
  await sleep(5000);
  try {
    const text = await page.evaluate(() => document.body.innerText.slice(0, 500));
    if (!text.includes('Designing') && !text.includes('Generating') && s > 2) {
      console.log(`Generation done at ${s*5}s`);

      // Wait extra for images to load from Pollinations
      console.log('Waiting 15s for image loading...');
      await sleep(15000);

      // Measure all image nodes
      const imgs = await page.evaluate(() => {
        return [...document.querySelectorAll('[data-node-type="image"]')].map(el => {
          const r = el.getBoundingClientRect();
          const cs = getComputedStyle(el);
          return {
            id: el.getAttribute('data-node-id'),
            w: Math.round(r.width),
            h: Math.round(r.height),
            aspect: r.width && r.height ? (r.width / r.height).toFixed(2) : 'N/A',
            visible: r.width > 50 && r.height > 50,
            widthCSS: cs.width,
            heightCSS: cs.height,
            aspectRatioCSS: cs.aspectRatio,
            bgHasUrl: cs.backgroundImage.includes('url('),
          };
        });
      });

      console.log('\n=== IMAGE NODES AFTER FIX ===');
      let visibleCount = 0;
      imgs.forEach(im => {
        const status = im.visible ? '✅ VISIBLE' : '❌ COLLAPSED';
        console.log(`  ${status} ${im.id}: ${im.w}x${im.h} (aspect ${im.aspect}) bg=${im.bgHasUrl?'URL':'gradient'}`);
        if (im.visible) visibleCount++;
      });
      console.log(`\nResult: ${visibleCount}/${imgs.length} images visible`);

      // Check for the mood prefix bug
      const bgUrls = await page.evaluate(() => {
        return [...document.querySelectorAll('[data-node-type="image"]')]
          .map(el => getComputedStyle(el).backgroundImage.slice(0, 120))
          .filter(b => b.includes('url'));
      });
      const hasMoodPrefix = bgUrls.some(u => u.includes('handwerklich') || u.includes('warm'));
      console.log(`Mood prefix in URLs: ${hasMoodPrefix ? '❌ STILL PRESENT' : '✅ REMOVED'}`);

      await page.screenshot({ path: '_verify_bakery.png', fullPage: false });
      console.log('Screenshot: _verify_bakery.png');
      break;
    }
  } catch (e) {
    console.log(`tick ${s}: ${e.message.slice(0, 60)}`);
  }
}

await browser.close();
