/**
 * Sanity check for progressive-disclosure.ts.
 * Run: bun test tests/progressive-disclosure.test.ts
 *
 * Not a framework test — just assertions that print and exit non-zero on fail,
 * so it works with `bun test` without any test runner config.
 */
import {
  atLevel,
  listForIndex,
  loadForTrigger,
  recipeAsDisclosable,
  type Disclosable,
} from '../src/lib/ai/memory/progressive-disclosure'

let failures = 0
function check(name: string, cond: boolean, detail = ''): void {
  if (!cond) {
    failures++
    console.error(`FAIL: ${name}${detail ? ' — ' + detail : ''}`)
  } else {
    console.log(`ok: ${name}`)
  }
}

// 10 items, mimicking a recipe/skill index.
const items: Disclosable[] = Array.from({ length: 10 }, (_, i) => ({
  id: `recipe-${i}`,
  level0: `topic-${i}: short description ${i}`,
  level1: `FULL BODY FOR ${i}: `.repeat(40),
  level2: `debug/patch history for ${i}`,
}))

// atLevel
check('atLevel L0 returns level0', atLevel(items[0], 0) === items[0].level0)
check('atLevel L1 returns level1', atLevel(items[0], 1) === items[0].level1)
check('atLevel L2 returns level2', atLevel(items[0], 2) === items[0].level2)
check(
  'atLevel L2 falls back to L1 when missing',
  atLevel({ id: 'x', level0: 'l0', level1: 'l1' }, 2) === 'l1',
)
check(
  'atLevel L2 falls back to L0 when L1+L2 missing',
  atLevel({ id: 'x', level0: 'l0', level1: '' }, 2) === 'l0',
)
check(
  'atLevel L1 falls back to L0 when body empty',
  atLevel({ id: 'x', level0: 'l0', level1: '   ' }, 1) === 'l0',
)

// listForIndex
const index = listForIndex(items)
check('listForIndex starts with header', index.startsWith('Verfuegbar:\n'))
check('listForIndex includes all 10 at L0', index.split('\n').filter((l) => l.startsWith('  - ')).length === 10)
check('listForIndex never includes L1 bodies', !index.includes('FULL BODY'))

// ~compact: each L0 line is short; index well under ~500 tokens (~4 chars/token).
const indexChars = index.length
check('listForIndex compact (< 2500 chars ≈ <600 tokens)', indexChars < 2500, `${indexChars} chars`)
console.log(`   index size: ${indexChars} chars`)

check('listForIndex empty on []', listForIndex([]) === '')

// loadForTrigger — only the matching one at L1.
const loaded = loadForTrigger(items, 'topic-3')
check('loadForTrigger returns only the matching item at L1', loaded.includes(items[3].level1))
check('loadForTrigger excludes non-matches', !loaded.includes(items[0].level1))
check(
  'loadForTrigger excludes non-matches (another)',
  !loaded.includes(items[7].level1),
)
check('loadForTrigger header carries L0 label', loaded.includes(items[3].level0))
check('loadForTrigger empty string on no match', loadForTrigger(items, 'zzz-nope') === '')
check('loadForTrigger empty string on empty trigger', loadForTrigger(items, '') === '')

// Trigger matches via id too (not just level0 text).
const byId = loadForTrigger([{ id: 'asian-spa', level0: 'warm aesthetic', level1: 'BODY' }], 'asian-spa')
check('loadForTrigger matches id', byId.includes('BODY'))

// Case-insensitive.
check(
  'loadForTrigger case-insensitive',
  loadForTrigger(items, 'TOPIC-3').includes(items[3].level1),
)

// recipeAsDisclosable wrapper.
const disc = recipeAsDisclosable({
  topic: 'asian-spa',
  palette: { accent: '#C9A227' },
  fonts: { display: 'Cormorant', body: 'Inter' },
  layoutArchetype: 'editorial-hero',
  soulGestures: ['warm glow'],
  praisedByPanelists: ['harmonie'],
  avoidPatterns: ['flat bg'],
  sourceComposite: 8.1,
})
check('recipe L0 has topic', disc.level0.startsWith('asian-spa:'))
check('recipe L0 has score', disc.level0.includes('Ø8.1'))
check('recipe L0 has accent', disc.level0.includes('#C9A227'))
check('recipe L1 is JSON containing palette', disc.level1.includes('"palette"'))
check('recipe L2 mentions patch history', /patch history/i.test(disc.level2 ?? ''))
check('recipe survives L1 load via atLevel', atLevel(disc, 1) === disc.level1)

// The example from the task: asian-spa recipe disclosure shape.
const example = recipeAsDisclosable({
  topic: 'asian-spa',
  palette: { accent: 'gold', bg: 'ivory' },
  fonts: { display: 'Cormorant', body: 'Inter' },
  layoutArchetype: 'spa-hero',
  sourceComposite: 8.1,
})
const exIndex = listForIndex([example])
check('example index line shape', exIndex.includes('asian-spa:') && exIndex.includes('Ø8.1'))
check(
  'example loadForTrigger returns L1 JSON',
  loadForTrigger([example], 'asian-spa').includes('"fonts"'),
)

if (failures > 0) {
  console.error(`\n${failures} check(s) failed`)
  process.exit(1)
}
console.log(`\nAll checks passed.`)
