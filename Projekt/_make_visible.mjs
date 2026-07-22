// Generate 3 variants and save them as viewable pages
import puppeteer from 'puppeteer';
import fs from 'fs';
const sleep = ms => new Promise(r => setTimeout(r, ms));

const PROJECT_ID = 'cmricdbno0000l0zc7jm756oq';
const PORT = 3020;

const tests = [
  { name: 'bakery', prompt: 'Erstelle eine Landingpage fuer eine traditionelle Baeckerei', file: 'variant-bakery.html' },
  { name: 'startup', prompt: 'A SaaS startup landing page for project management', file: 'variant-startup.html' },
  { name: 'law', prompt: 'A law firm website, professional navy blue and gold', file: 'variant-law.html' },
];

console.log('=== GENERATING 3 VISIBLE VARIANTS ===\n');

for (const t of tests) {
  console.log(`Generating ${t.name}...`);
  const start = Date.now();
  const res = await fetch(`http://localhost:${PORT}/api/design/cream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: t.prompt, projectId: PROJECT_ID, quick: true }),
    signal: AbortSignal.timeout(600000),
  });
  const elapsed = Math.round((Date.now() - start) / 1000);
  const data = await res.json();
  const html = data.html || '';
  fs.writeFileSync(`public/${t.file}`, html);
  console.log(`  ✅ ${elapsed}s, ${html.length} chars → public/${t.file}`);
}

console.log('\n=== TAKING SCREENSHOTS ===\n');
const browser = await puppeteer.launch({
  executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  headless: 'new',
  args: ['--no-sandbox', '--window-size=1280,900'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 900 });

for (const t of tests) {
  const html = fs.readFileSync(`public/${t.file}`, 'utf8');
  await page.setContent(html, { waitUntil: 'networkidle2', timeout: 60000 });
  await sleep(5000);
  await page.screenshot({ path: `public/${t.name}-screenshot.png`, fullPage: false });
  console.log(`  📸 ${t.name}-screenshot.png`);
}

await browser.close();
console.log('\n=== DONE ===');
console.log('View at:');
console.log('  → http://localhost:3020/variant-bakery.html');
console.log('  → http://localhost:3020/variant-startup.html');
console.log('  → http://localhost:3020/variant-law.html');
