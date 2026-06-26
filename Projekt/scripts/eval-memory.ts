/**
 * eval-memory.ts — P1 functional gate for the negative-memory layer.
 *
 * Seeds negative + positive episodes + an approved recipe (with avoidPatterns),
 * calls recallAntiPatterns, asserts the negative signals surface ranked and the
 * positive does NOT, then cleans up the seeded rows. Proves the loop end-to-end
 * on the real Prisma substrate.
 *
 * Run:  bun --env-file=.env.local scripts/eval-memory.ts
 */
import { db } from '../src/lib/db';
import { recallAntiPatterns } from '../src/lib/ai/memory/negative-memory';

const DOMAIN = 'eval-p1-negative-memory';

async function main() {
  console.log(`[eval] seeding episodes + recipe for domain "${DOMAIN}" …`);
  await db.designHistory.createMany({
    data: [
      { prompt: 'eval-1', domain: DOMAIN, composite: 4, valence: -1, outcome: 'failure', rootCause: 'used indigo #6366f1 gradient (slop)', sourceAgentId: 'eval' },
      { prompt: 'eval-2', domain: DOMAIN, composite: 5, valence: -1, outcome: 'failure', rootCause: 'used indigo #6366f1 gradient (slop)', sourceAgentId: 'eval' },
      { prompt: 'eval-3', domain: DOMAIN, composite: 9, valence: 1, outcome: 'success', rootCause: null, sourceAgentId: 'eval' },
    ],
  });
  await db.designLesson.create({
    data: {
      topic: DOMAIN,
      recipeJson: JSON.stringify({ avoidPatterns: ['emoji icons as feature icons', 'purple trust gradient'] }),
      composite: 8.6,
      approved: true,
    },
  });

  console.log('[eval] recalling anti-patterns …');
  const r = await recallAntiPatterns({ domain: DOMAIN, maxTokens: 1200 });
  console.log(`[eval] items=${r.items.length}  budget=${r.budget.used}/${r.budget.max}tk${r.note ? '  note=' + r.note : ''}`);
  r.items.slice(0, 8).forEach((i) =>
    console.log(`   [salience ${i.salience.toFixed(2)} ×${i.frequency}] ${i.source}: ${i.text}`),
  );

  const texts = r.items.map((i) => i.text.toLowerCase());
  const okRootCause = texts.some((t) => t.includes('indigo'));
  const okRecipeAvoid = texts.some((t) => t.includes('emoji icons'));
  const okNoPositive = r.items.every((i) => i.valence < 0 || i.source === 'recipe'); // nothing positive-leaked as avoid
  const okCount = r.items.length >= 2;

  console.log('\n[eval] assertions:');
  console.log('  negative root-cause (indigo) surfaces :', okRootCause ? 'PASS' : 'FAIL');
  console.log('  recipe avoidPattern (emoji icons)     :', okRecipeAvoid ? 'PASS' : 'FAIL');
  console.log('  no positive leaked as avoid           :', okNoPositive ? 'PASS' : 'FAIL');
  console.log('  ≥2 items returned                     :', okCount ? 'PASS' : 'FAIL');

  console.log('\n[eval] cleaning up seeded rows …');
  await db.designHistory.deleteMany({ where: { sourceAgentId: 'eval' } });
  await db.designLesson.deleteMany({ where: { topic: DOMAIN } });
  await db.designLessonHistory.deleteMany({ where: { topic: DOMAIN } });

  const pass = okRootCause && okRecipeAvoid && okNoPositive && okCount;
  console.log(`\n[eval] RESULT: ${pass ? 'PASS ✅  (negative-memory loop proven)' : 'FAIL ❌'}`);
  process.exit(pass ? 0 : 1);
}

main().catch((e) => {
  console.error('[eval] crashed:', e);
  process.exit(1);
});
