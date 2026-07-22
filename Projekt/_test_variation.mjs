// Test: 3 different domains, verify they get DIFFERENT designs (not "always the same")
const PROJECT_ID = 'cmricdbno0000l0zc7jm756oq';
const PORT = 3020;

const tests = [
  { name: 'bakery', prompt: 'Erstelle eine Landingpage fuer eine traditionelle Baeckerei' },
  { name: 'startup', prompt: 'A SaaS startup landing page for project management' },
  { name: 'law', prompt: 'A law firm website, professional navy blue and gold' },
];

console.log('=== CONCEPT-VARIATION TEST ===');
console.log('Generating 3 designs from different domains...\n');

const results = [];
for (const t of tests) {
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

  // Extract distinctive features
  const colors = [...new Set((html.match(/#[0-9a-fA-F]{6}/g) || []))];
  const primaryColor = colors.find(c => !c.includes('fff') && !c.includes('000')) || colors[0];
  const fontFamily = html.match(/font-family:\s*['"]([^'"`,;]+)/i)?.[1] || 'unknown';
  const hasDarkBg = /#0[0-9a-f]{5}|#1[0-9a-f]{5}|background.*dark/i.test(html);
  const hasLightBg = /#f[0-9a-f]{5}|#e[0-9a-f]{5}|background.*white|background.*light/i.test(html);
  const sections = (html.match(/<section/gi) || []).length;
  const h1Match = html.match(/<h1[^>]*>([^<]+)</i)?.[1]?.trim() || '';

  console.log(`${t.name.padEnd(10)} ${elapsed}s`);
  console.log(`  Colors: ${colors.slice(0, 3).join(', ')}`);
  console.log(`  Font: ${fontFamily}`);
  console.log(`  Background: ${hasDarkBg ? 'DARK' : hasLightBg ? 'LIGHT' : 'mixed'}`);
  console.log(`  Sections: ${sections} | H1: "${h1Match.slice(0, 40)}..."`);

  results.push({ name: t.name, elapsed, colors, primaryColor, fontFamily, hasDarkBg, hasLightBg, sections, h1Match });
}

// Check for meaningful differences
const allSameBg = results.every(r => r.hasDarkBg === results[0].hasDarkBg);
const allSameFont = results.every(r => r.fontFamily === results[0].fontFamily);
const allSameColors = results.every(r => r.primaryColor === results[0].primaryColor);

console.log('\n=== VARIATION CHECK ===');
console.log(`All same background: ${allSameBg ? '❌ IDENTICAL (bad)' : '✅ VARIED (good)'}`);
console.log(`All same font: ${allSameFont ? '❌ IDENTICAL (bad)' : '✅ VARIED (good)'}`);
console.log(`All same primary color: ${allSameColors ? '❌ IDENTICAL (bad)' : '✅ VARIED (good)'}`);

const varied = !allSameBg && !allSameFont && !allSameColors;
console.log(`\nRESULT: ${varied ? '✅ DESIGNS ARE DIFFERENT' : '❌ STILL TOO SIMILAR'}`);
process.exit(varied ? 0 : 1);
