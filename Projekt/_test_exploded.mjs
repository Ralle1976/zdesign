// Test Exploded View with real wheel events and measure translateZ values
import puppeteer from 'puppeteer';
import fs from 'fs';
const sleep = ms => new Promise(r => setTimeout(r, ms));

const PROJECT_ID = 'cmricdbno0000l0zc7jm756oq';
const PORT = 3020;

console.log('=== EXPLODED VIEW TEST ===\n');

// Generate Boss watches with interactive=true
const res = await fetch(`http://localhost:${PORT}/api/design/cream`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    message: 'Erstelle eine Premium-Landingpage für den Uhren-Hersteller BOSS mit einer 3D-Armbanduhr im Zentrum die man mit dem Mausrad zoomen kann um das Innere zu sehen',
    projectId: PROJECT_ID,
    quick: true,
    premium: true,
    interactive: true,
  }),
  signal: AbortSignal.timeout(600000),
});
const data = await res.json();
const html = data.html || '';

console.log(`Generated: ${html.length} chars`);

// Save
fs.writeFileSync('public/boss-exploded-view.html', html);

// Test in browser
const browser = await puppeteer.launch({
  executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  headless: 'new',
  args: ['--no-sandbox', '--window-size=1400,1000'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1400, height: 1000 });
await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 60000 });
await sleep(5000);

// Check structure
const structure = await page.evaluate(() => {
  const stage = document.querySelector('.product-stage');
  const layers = document.querySelectorAll('.product-layer');
  return {
    hasStage: !!stage,
    layerCount: layers.length,
    layers: [...layers].map((l, i) => ({
      index: i,
      dataZ: l.dataset.z,
      transform: getComputedStyle(l).transform,
    })),
  };
});

console.log('\n=== STRUCTURE ===');
console.log(`Stage exists: ${structure.hasStage ? '✅' : '❌'}`);
console.log(`Layers: ${structure.layerCount}`);
structure.layers.forEach((l, i) => {
  console.log(`  [${i}] data-z="${l.dataZ}" transform="${l.transform.slice(0, 50)}"`);
});

if (!structure.hasStage || structure.layerCount === 0) {
  console.log('\n❌ No product stage or layers found');
  await browser.close();
  process.exit(1);
}

// Test wheel events
console.log('\n=== WHEEL EVENTS ===');

// Initial state
const initial = await page.evaluate(() => {
  return [...document.querySelectorAll('.product-layer')].map(l => ({
    dataZ: l.dataset.z,
    transform: getComputedStyle(l).transform,
  }));
});
console.log('Initial state:');
initial.forEach((l, i) => console.log(`  [${i}] transform: ${l.transform.slice(0, 60)}`));

// Wheel down (explode)
console.log('\nSimulating wheel DOWN (explode)...');
await page.mouse.move(700, 500);
await page.mouse.wheel({ deltaY: 300 });
await sleep(1500);

const afterExplode = await page.evaluate(() => {
  return [...document.querySelectorAll('.product-layer')].map(l => ({
    dataZ: l.dataset.z,
    transform: getComputedStyle(l).transform,
  }));
});
console.log('After wheel DOWN:');
afterExplode.forEach((l, i) => console.log(`  [${i}] transform: ${l.transform.slice(0, 60)}`));

// Check if transforms changed
const exploded = initial.some((init, i) => init.transform !== afterExplode[i].transform);
console.log(`\nLayers moved: ${exploded ? '✅ YES (Exploded View works)' : '❌ NO (no change)'}`);

// Wheel up (implode)
console.log('\nSimulating wheel UP (implode)...');
await page.mouse.wheel({ deltaY: -300 });
await sleep(1500);

const afterImplode = await page.evaluate(() => {
  return [...document.querySelectorAll('.product-layer')].map(l => ({
    dataZ: l.dataset.z,
    transform: getComputedStyle(l).transform,
  }));
});
console.log('After wheel UP:');
afterImplode.forEach((l, i) => console.log(`  [${i}] transform: ${l.transform.slice(0, 60)}`));

const imploded = afterExplode.some((exp, i) => exp.transform !== afterImplode[i].transform);
console.log(`\nLayers returned: ${imploded ? '✅ YES (Implode works)' : '❌ NO (no change)'}`);

// Screenshot at different stages
await page.screenshot({ path: 'boss-exploded-initial.png', fullPage: false });
console.log('\nScreenshot: boss-exploded-initial.png');

await page.mouse.wheel({ deltaY: 300 });
await sleep(1500);
await page.screenshot({ path: 'boss-exploded-view.png', fullPage: false });
console.log('Screenshot: boss-exploded-view.png');

await browser.close();

const success = exploded && imploded;
console.log(`\n=== RESULT: ${success ? '✅ EXPLODED VIEW WORKS' : '❌ FAILED'} ===`);
process.exit(success ? 0 : 1);
