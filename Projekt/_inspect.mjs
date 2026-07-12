// Evidence collector: generate one design, inspect ALL images (src, alt, dimensions, aspect ratio)
import puppeteer from 'puppeteer';
const sleep = ms => new Promise(r => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  headless: 'new',
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,900'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 900 });

console.log('=== EVIDENCE COLLECTION: Bakery Design ===\n');
await page.goto('http://localhost:3000', { waitUntil: 'networkidle2', timeout: 60000 });
await sleep(3000);

// Type prompt
const ta = await page.$('textarea');
await ta.focus();
await page.keyboard.down('Control');
await page.keyboard.press('A');
await page.keyboard.up('Control');
await page.keyboard.press('Backspace');
await sleep(200);
await page.keyboard.type('Erstelle eine Landingpage fuer eine traditionelle Baeckerei mit Brot, Croissant und Kuchen');
await sleep(300);
await page.keyboard.press('Enter');
console.log('Prompt submitted, waiting for generation...\n');

// Wait for completion
for (let s = 0; s < 40; s++) {
  await sleep(5000);
  try {
    const text = await page.evaluate(() => document.body.innerText.slice(0, 800));
    const generating = text.includes('Designing') || text.includes('Generating');
    if (!generating && s > 2) {
      console.log(`Generation completed at tick ${s} (~${s*5}s)\n`);

      // 1. All <img> elements
      const imgs = await page.evaluate(() => {
        return [...document.querySelectorAll('img')].map(i => ({
          src: (i.src || '').slice(0, 300),
          alt: i.alt || '',
          width: i.naturalWidth,
          height: i.naturalHeight,
          aspect: i.naturalWidth && i.naturalHeight
            ? (i.naturalWidth / i.naturalHeight).toFixed(2)
            : 'unknown',
          rendered: `${i.offsetWidth}x${i.offsetHeight}`,
        }));
      });
      console.log('=== IMG ELEMENTS ===');
      console.log(`Count: ${imgs.length}`);
      imgs.forEach((im, i) => {
        console.log(`  [${i}] ${im.rendered} (natural ${im.width}x${im.height}, aspect ${im.aspect})`);
        console.log(`       src: ${im.src}`);
        console.log(`       alt: "${im.alt}"`);
      });

      // 2. Background images
      const bgs = await page.evaluate(() => {
        const out = [];
        for (const el of document.querySelectorAll('*')) {
          const s = getComputedStyle(el).backgroundImage;
          if (s && s !== 'none') {
            const m = s.match(/url\("?([^"]+)"?\)/);
            if (m) out.push({
              tag: el.tagName,
              cls: (el.className || '').toString().slice(0, 60),
              rendered: `${el.offsetWidth}x${el.offsetHeight}`,
              url: m[1].slice(0, 200),
            });
          }
        }
        return out;
      });
      console.log('\n=== BACKGROUND IMAGES ===');
      console.log(`Count: ${bgs.length}`);
      bgs.slice(0, 15).forEach((bg, i) => {
        console.log(`  [${i}] <${bg.tag}> ${bg.rendered} ${bg.cls}`);
        console.log(`       url: ${bg.url}`);
      });

      // 3. Check for pending/placeholder images (data URIs, broken, etc.)
      const placeholders = await page.evaluate(() => {
        return [...document.querySelectorAll('img')].filter(i => {
          const s = i.src || '';
          return s.startsWith('data:') || s.includes('placeholder') || s.includes('pending')
            || i.naturalWidth === 0;
        }).map(i => ({ src: (i.src||'').slice(0,150), status: i.dataset?.status || 'unknown' }));
      });
      console.log('\n=== PLACEHOLDER/PENDING IMAGES ===');
      console.log(`Count: ${placeholders.length}`);
      placeholders.forEach((p, i) => console.log(`  [${i}] ${p.src} (${p.status})`));

      // 4. Check what the design JSON contains about images
      const designState = await page.evaluate(() => {
        // Try to read the design tree from React state or localStorage
        const keys = Object.keys(localStorage).filter(k => k.includes('design') || k.includes('project'));
        return { lsKeys: keys.slice(0, 10) };
      });
      console.log('\n=== DESIGN STATE ===');
      console.log(JSON.stringify(designState, null, 2));

      await page.screenshot({ path: '_evidence_bakery.png', fullPage: false });
      console.log('\nScreenshot: _evidence_bakery.png');
      break;
    }
  } catch (e) {
    console.log(`tick ${s}: eval error (${e.message.slice(0, 60)})`);
  }
}

await browser.close();
console.log('\n=== DONE ===');
