// Generate a fresh bakery design with fresh Minimax images
// Then render it IMMEDIATELY with screenshots
import puppeteer from 'puppeteer';
import fs from 'fs';
const sleep = ms => new Promise(r => setTimeout(r, ms));

const PROJECT_ID = 'cmricdbno0000l0zc7jm756oq';
const PORT = 3020;
const MINIMAX_KEY = 'sk-cp-p4g780jkhtVbE7KBrnBe5u1twrZNKvulVRzzZSzEdJtAmHNxqmFW6L-v1hj12W83OaPS9c7EBIZi6BNkHlpjAT1AVpEFbTs2uMxy9fMd22-zsS2bwXl8JbA';

console.log('=== FRESH BAKERY DESIGN WITH FRESH IMAGES ===\n');

// Step 1: Generate fresh Minimax images
console.log('Step 1: Generating fresh Minimax images...');
const imagePrompts = [
  'Rustic sourdough bread on wooden table, warm morning light, professional food photography, shallow depth of field, appetizing, editorial quality',
  'Baker hands kneading dough on flour-dusted surface, warm workshop atmosphere, professional documentary photography',
  'Traditional German bakery interior with fresh bread loaves, warm golden light, cozy atmosphere, editorial photography'
];

const imageUrls = [];
for (const prompt of imagePrompts) {
  const res = await fetch('https://api.minimax.io/v1/image_generation', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${MINIMAX_KEY}` },
    body: JSON.stringify({ model: 'image-01', prompt, aspect_ratio: '16:9' }),
    signal: AbortSignal.timeout(120000),
  });
  const data = await res.json();
  const url = data?.data?.image_urls?.[0];
  if (url) {
    imageUrls.push(url);
    console.log(`  ✅ Generated: ${url.slice(0, 60)}...`);
  } else {
    console.log(`  ❌ Failed: ${JSON.stringify(data).slice(0, 80)}`);
  }
}

// Step 2: Generate design with these images
console.log(`\nStep 2: Generating design with ${imageUrls.length} reference images...`);
const start = Date.now();
const res = await fetch(`http://localhost:${PORT}/api/design/cream`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    message: 'Erstelle eine Landingpage fuer eine traditionelle Baeckerei mit 36-Stunden-Sauerteig',
    projectId: PROJECT_ID,
    quick: true,
    premium: true,
    referenceImages: imageUrls,
  }),
  signal: AbortSignal.timeout(600000),
});
const elapsed = Math.round((Date.now() - start) / 1000);
const data = await res.json();
const html = data.html || '';
console.log(`Generated: ${elapsed}s, ${html.length} chars`);

// Step 3: Render and screenshot
console.log('\nStep 3: Rendering with fresh images...');
const browser = await puppeteer.launch({
  executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  headless: 'new',
  args: ['--no-sandbox', '--window-size=1400,1000'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1400, height: 1000 });
await page.setContent(html, { waitUntil: 'networkidle2', timeout: 120000 });
await sleep(15000);

const imgStats = await page.evaluate(() => {
  const imgs = [...document.querySelectorAll('img')];
  return {
    total: imgs.length,
    loaded: imgs.filter(i => i.naturalWidth > 100).length,
    sources: imgs.map(i => ({ src: i.src.slice(0, 50), w: i.naturalWidth, h: i.naturalHeight })).slice(0, 3),
  };
});
console.log(`Images: ${imgStats.loaded}/${imgStats.total} loaded`);
imgStats.sources.forEach((s, i) => console.log(`  [${i}] ${s.w}x${s.h} ${s.src}...`));

await page.screenshot({ path: 'FINAL_bakery_fresh.png', fullPage: true });
console.log('\nScreenshot: FINAL_bakery_fresh.png');

await browser.close();
console.log('\n✅ DONE');
