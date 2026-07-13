// Test: Generate bakery with GENERATED images (not stock Unsplash)
const fs = await import('fs');

console.log('=== IMAGE GENERATION TEST ===');
console.log('Generating bakery with extra images...\n');

const start = Date.now();
const res = await fetch('http://localhost:3010/api/design/cream', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    message: 'Erstelle eine Landingpage fuer eine traditionelle Baeckerei mit frischem Brot',
    projectId: 'cmr8223t50002l060vtg7k7ua',
    quick: true,
  }),
  signal: AbortSignal.timeout(600000), // 10 min — image gen takes time
});
const elapsed = Math.round((Date.now() - start) / 1000);
const data = await res.json();
const html = data.html || '';

console.log(`Elapsed: ${elapsed}s`);
console.log(`HTML length: ${html.length}`);

// Check image sources
const imgRegex = /<img\s+[^>]*src=["']([^"']+)["'][^>]*>/gi;
const images = [];
let m;
while ((m = imgRegex.exec(html)) !== null) {
  const src = m[1];
  const altMatch = m[0].match(/alt=["']([^"']*)["']/i);
  images.push({
    src: src.slice(0, 80),
    type: src.includes('unsplash') ? 'STOCK' : src.includes('pollinations') ? 'GENERATED' : 'OTHER',
    alt: altMatch ? altMatch[1].slice(0, 50) : '',
  });
}

console.log(`\nImages found: ${images.length}`);
const stock = images.filter(i => i.type === 'STOCK').length;
const generated = images.filter(i => i.type === 'GENERATED').length;
console.log(`  Stock (Unsplash): ${stock}`);
console.log(`  Generated (Pollinations): ${generated}`);

images.forEach((img, i) => {
  console.log(`  [${i}] ${img.type}: alt="${img.alt}"`);
  console.log(`       src: ${img.src}...`);
});

// Save for visual inspection
fs.writeFileSync('BAKERY_GENERATED_IMAGES.html', html);
console.log('\nSaved: BAKERY_GENERATED_IMAGES.html');

const ok = generated > 0;
console.log(`\n=== RESULT: ${ok ? '✅ GENERATED IMAGES' : '❌ STILL STOCK'} ===`);
process.exit(ok ? 0 : 1);
