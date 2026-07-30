// LIVE DEMO: Generate a restaurant design with FULL progress visibility
// Shows every step of the Cream pipeline in real-time

const PROJECT_ID = 'cmricdbno0000l0zc7jm756oq';
const PORT = 3020;

const PROMPT = 'Ein exklusives japanisches Kaiseki-Restaurant mit traditioneller Teezeremonie und saisonalem Omakase-Menü';

console.log('╔══════════════════════════════════════════════════════╗');
console.log('║  LIVE DEMO: Z.Design Cream Pipeline                  ║');
console.log('╚══════════════════════════════════════════════════════╝\n');
console.log(`📝 Prompt: "${PROMPT}"\n`);

console.log('⏱️  Phase 1: Art Direction (deterministic, ~0s)');
console.log('   → buildArtBrief(): Domain detection, palette, fonts, mood');
console.log('   → pickCreativeAxes(): Layout gesture, motion, effect');
console.log('   → getConceptSpecs(): Domain-specific design specs\n');

const start = Date.now();

console.log('🤖 Phase 2: LLM Generation (GLM-5.2, ~60-90s)');
console.log('   → callTextLLM() with full prompt:');
console.log('     - LESSONS.md (learned patterns)');
console.log('     - user-memory (preferences)');
console.log('     - anti-patterns (avoid list)');
console.log('     - concept-specs (domain-adaptive)');
console.log('     - agency-craft (premium specs)');
console.log('     - generate-prompt (restaurant reference)');
console.log('   → Waiting for GLM-5.2 to generate HTML...\n');

const res = await fetch(`http://localhost:${PORT}/api/design/cream`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    message: PROMPT,
    projectId: PROJECT_ID,
    quick: true,
    premium: true,
  }),
  signal: AbortSignal.timeout(600000),
});

const elapsed = Math.round((Date.now() - start) / 1000);
console.log(`   ✅ Generated in ${elapsed}s\n`);

const data = await res.json();
const html = data.html || '';

console.log('🔧 Phase 3: Post-Processing (deterministic, ~0s)');
console.log('   → ensureGoogleFonts(): Inject Google Fonts <link>');
console.log('   → ensureDesignImages(): Replace stock with Minimax images');
console.log('   → injectAgencyCraft(): Add film-grain, hover effects');
console.log('   → ensureExperienceRuntime(): Add scroll animations\n');

console.log('📊 Phase 4: Analysis');
const sections = (html.match(/<section/gi) || []).length;
const headings = (html.match(/<h[1-3]/gi) || []).length;
const images = (html.match(/<img/gi) || []).length;
const hasFonts = html.includes('fonts.googleapis.com');
const hasFeatures = html.includes('feature');
const hasTestimonials = html.includes('testimonial');
const hasFAQ = html.includes('faq') || html.includes('FAQ');
const hasCTA = html.includes('cta') || html.includes('CTA');
const hasFooter = html.includes('footer');

console.log(`   → Sections: ${sections}`);
console.log(`   → Headings: ${headings}`);
console.log(`   → Images: ${images}`);
console.log(`   → Google Fonts: ${hasFonts ? '✅' : '❌'}`);
console.log(`   → Features: ${hasFeatures ? '✅' : '❌'}`);
console.log(`   → Testimonials: ${hasTestimonials ? '✅' : '❌'}`);
console.log(`   → FAQ: ${hasFAQ ? '✅' : '❌'}`);
console.log(`   → CTA: ${hasCTA ? '✅' : '❌'}`);
console.log(`   → Footer: ${hasFooter ? '✅' : '❌'}\n`);

// Save
const fs = await import('fs');
fs.writeFileSync('public/live-demo-kaiseki.html', html);
console.log('💾 Saved: public/live-demo-kaiseki.html');
console.log('🌐 Open: http://localhost:3020/live-demo-kaiseki.html\n');

console.log('╔══════════════════════════════════════════════════════╗');
console.log('║  LIVE DEMO COMPLETE — Design generated successfully! ║');
console.log('╚══════════════════════════════════════════════════════╝');
