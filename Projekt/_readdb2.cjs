const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const rows = await p.$queryRawUnsafe('SELECT designJSON FROM Project ORDER BY createdAt DESC LIMIT 1');
  if (!rows[0] || !rows[0].designJSON) { console.log('NO DESIGN'); return; }
  const tree = JSON.parse(rows[0].designJSON);

  // Dump hero section and its children deeply
  const hero = tree.children?.[1];
  console.log('=== HERO SECTION ===');
  console.log('id:', hero.id, 'type:', hero.type);
  console.log('style:', JSON.stringify(hero.style, null, 2));
  console.log('children:', hero.children?.length);

  hero.children?.forEach((c, i) => {
    console.log(`\n--- hero child [${i}] ---`);
    console.log('id:', c.id, 'type:', c.type, 'tag:', c.tag);
    console.log('style:', JSON.stringify(c.style, null, 2));
    if (c.children) {
      c.children.forEach((cc, j) => {
        console.log(`  [${i}.${j}] id=${cc.id} type=${cc.type} style=${JSON.stringify(cc.style).slice(0,150)}`);
      });
    }
  });

  // Also dump the features section (root.2)
  const features = tree.children?.[2];
  console.log('\n=== FEATURES SECTION ===');
  console.log('id:', features.id, 'type:', features.type);
  console.log('style:', JSON.stringify(features.style, null, 2));

  // Walk features deeply to find the image containers
  function walk(node, depth, maxDepth) {
    if (depth > maxDepth) return;
    const indent = '  '.repeat(depth);
    console.log(`${indent}id=${node.id} type=${node.type} tag=${node.tag}`);
    console.log(`${indent}style=${JSON.stringify(node.style||{}).slice(0,200)}`);
    if (node.meta?.imagePrompt) console.log(`${indent}imagePrompt=${node.meta.imagePrompt.slice(0,80)}`);
    if (node.children) {
      node.children.forEach(c => walk(c, depth+1, maxDepth));
    }
  }
  walk(features, 0, 5);

  await p.$disconnect();
})().catch(e => { console.error(e.message); process.exit(1); });
