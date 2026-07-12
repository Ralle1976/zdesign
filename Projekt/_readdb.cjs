const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const rows = await p.$queryRawUnsafe('SELECT id, designJSON FROM Project ORDER BY createdAt DESC LIMIT 1');
  if (!rows[0] || !rows[0].designJSON) { console.log('NO DESIGN'); return; }
  const tree = JSON.parse(rows[0].designJSON);
  // Walk the tree and find all nodes with backgroundImage or type image
  const findings = [];
  function walk(node, path) {
    if (!node || typeof node !== 'object') return;
    const style = node.style || {};
    const bg = style.backgroundImage || '';
    if (bg && bg.includes('url')) {
      findings.push({ path, id: node.id, type: node.type, width: style.width, height: style.height, aspectRatio: style.aspectRatio, bg: bg.slice(0, 200), meta: node.meta || null });
    }
    if (node.type === 'image' || node.tag === 'img') {
      findings.push({ path, id: node.id, type: node.type, width: style.width, height: style.height, aspectRatio: style.aspectRatio, content: (node.content||'').slice(0,80), meta: node.meta || null });
    }
    if (node.children) {
      node.children.forEach((c, i) => walk(c, path + '.' + i));
    }
  }
  walk(tree, 'root');
  console.log('=== IMAGE NODES IN DESIGN TREE ===');
  console.log('Count:', findings.length);
  findings.forEach((f, i) => {
    console.log(`\n[${i}] path=${f.path} id=${f.id} type=${f.type}`);
    console.log(`     width=${f.width} height=${f.height} aspectRatio=${f.aspectRatio}`);
    if (f.bg) console.log(`     bg: ${f.bg}`);
    if (f.content) console.log(`     content: ${f.content}`);
    if (f.meta) console.log(`     meta: ${JSON.stringify(f.meta).slice(0, 200)}`);
  });
  // Also dump the first 2 top-level children structure for context
  console.log('\n=== TOP-LEVEL STRUCTURE ===');
  if (tree.children) {
    tree.children.forEach((c, i) => {
      console.log(`[${i}] id=${c.id} type=${c.type} tag=${c.tag} children=${c.children?.length||0}`);
      console.log(`     style keys: ${Object.keys(c.style||{}).join(', ')}`);
      // Show grandchildren
      if (c.children) {
        c.children.forEach((gc, j) => {
          console.log(`  [${i}.${j}] id=${gc.id} type=${gc.type} tag=${gc.tag} style.width=${gc.style?.width}`);
        });
      }
    });
  }
  await p.$disconnect();
})().catch(e => { console.error(e.message); process.exit(1); });
