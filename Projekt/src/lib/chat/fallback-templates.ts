// Z.Design - Chat fallback design templates
//
// Extracted from src/app/api/chat/route.ts (T5 modularization, 2026-07-04).
// These are the deterministic, no-LLM fallback designs used when:
//   - Z.ai LLM is unavailable            -> generateFallbackDesign()
//   - LLM returned, but JSON parse +     -> generateContextualFallback()
//     repairLLMJson both failed (topic-aware fallback)
//
// No external dependencies; pure data + pure functions. Safe to import from
// anywhere (API routes, server-only).

// ============ Types ============

export interface TopicTemplate {
  keywords: string[];
  brandName: string;
  primaryColor: string;
  primaryDark: string;
  accentLight: string;
  heroTitle: string;
  heroSubtitle: string;
  heroEmoji: string;
  features: Array<{ icon: string; title: string; desc: string }>;
  ctaTitle: string;
  ctaSubtitle: string;
  testimonial: string;
  testimonialAuthor: string;
  testimonialRole: string;
  footerDesc: string;
}

// ============ Topic templates (topic-aware fallback source) ============

export const TOPIC_TEMPLATES: TopicTemplate[] = [
  {
    keywords: ['fitness', 'workout', 'gym', 'exercise', 'health', 'training', 'sport'],
    brandName: 'FitPulse',
    primaryColor: '#f97316',
    primaryDark: '#ea580c',
    accentLight: '#ffedd5',
    heroTitle: 'Transform Your Fitness Journey',
    heroSubtitle: 'Personalized workout plans, real-time tracking, and expert guidance — all in one app.',
    heroEmoji: '🏋️',
    features: [
      { icon: '📊', title: 'Smart Tracking', desc: 'Monitor your progress with AI-powered analytics and personalized insights.' },
      { icon: '🎯', title: 'Custom Plans', desc: 'Workout plans that adapt to your fitness level, goals, and available equipment.' },
      { icon: '🔥', title: 'Streak Rewards', desc: 'Stay motivated with achievement badges, streaks, and community challenges.' },
      { icon: '🍎', title: 'Nutrition Guide', desc: 'Meal plans and calorie tracking synced with your workout intensity.' },
      { icon: '👥', title: 'Community', desc: 'Connect with fellow athletes, share progress, and join group challenges.' },
      { icon: '📱', title: 'Any Device', desc: 'Seamless sync across phone, watch, and web — never miss a workout.' },
    ],
    ctaTitle: 'Start Your Free Trial Today',
    ctaSubtitle: 'Join 2M+ athletes who train smarter with FitPulse. No credit card required.',
    testimonial: '"FitPulse completely changed how I approach fitness. I lost 20lbs in 3 months with their personalized plans."',
    testimonialAuthor: 'Alex Chen',
    testimonialRole: 'Marathon Runner',
    footerDesc: 'The #1 AI-powered fitness platform for personalized training.',
  },
  {
    keywords: ['restaurant', 'food', 'cafe', 'bakery', 'menu', 'dining', 'bistro', 'kitchen'],
    brandName: 'Saveur',
    primaryColor: '#dc2626',
    primaryDark: '#b91c1c',
    accentLight: '#fee2e2',
    heroTitle: 'A Culinary Experience Like No Other',
    heroSubtitle: 'Farm-to-table dishes crafted with passion. Reserve your table and savor the extraordinary.',
    heroEmoji: '🍽️',
    features: [
      { icon: '🌿', title: 'Farm to Table', desc: 'Locally sourced organic ingredients, handpicked from trusted farms every morning.' },
      { icon: '👨‍🍳', title: 'Expert Chefs', desc: 'Our Michelin-trained chefs bring world-class techniques to every plate.' },
      { icon: '🍷', title: 'Wine Pairing', desc: 'Curated wine selections from sommeliers to perfectly complement your meal.' },
      { icon: '🪑', title: 'Easy Reservations', desc: 'Book your table in seconds — choose your preferred time, party size, and seating.' },
      { icon: '🎉', title: 'Private Events', desc: 'Exclusive dining rooms for celebrations, corporate events, and special occasions.' },
      { icon: '🎁', title: 'Loyalty Rewards', desc: 'Earn points on every visit and unlock complimentary dishes and priority seating.' },
    ],
    ctaTitle: 'Reserve Your Table',
    ctaSubtitle: 'Experience fine dining reimagined. Book now and receive a complimentary appetizer.',
    testimonial: '"Every dish tells a story. The seasonal tasting menu was an unforgettable journey of flavors."',
    testimonialAuthor: 'Marie Dubois',
    testimonialRole: 'Food Critic, Le Guide',
    footerDesc: 'Fine dining, unforgettable moments. Open daily for lunch & dinner.',
  },
  {
    keywords: ['crypto', 'bitcoin', 'blockchain', 'web3', 'nft', 'defi', 'token', 'wallet'],
    brandName: 'ChainVault',
    primaryColor: '#8b5cf6',
    primaryDark: '#7c3aed',
    accentLight: '#ede9fe',
    heroTitle: 'The Future of Digital Assets',
    heroSubtitle: 'Secure, fast, and intuitive crypto management. Trade, stake, and earn across multiple chains.',
    heroEmoji: '🔗',
    features: [
      { icon: '🛡️', title: 'Military-Grade Security', desc: 'Multi-sig wallets, cold storage, and biometric auth keep your assets safe.' },
      { icon: '⚡', title: 'Lightning Trading', desc: 'Execute trades in milliseconds with zero slippage on major DEXs and CEXs.' },
      { icon: '💎', title: 'Smart Staking', desc: 'Auto-compound yields across protocols to maximize your passive income.' },
      { icon: '🌐', title: 'Multi-Chain', desc: 'Seamlessly manage assets across Ethereum, Solana, Polygon, and 20+ chains.' },
      { icon: '📊', title: 'Portfolio Analytics', desc: 'Real-time P&L tracking, tax reports, and AI-powered market insights.' },
      { icon: '🔮', title: 'DeFi Dashboard', desc: 'Monitor liquidity pools, lending positions, and yield farms in one view.' },
    ],
    ctaTitle: 'Start Trading in Minutes',
    ctaSubtitle: 'Join 500K+ traders on the most trusted crypto platform. No hidden fees.',
    testimonial: '"ChainVault made DeFi accessible. I earn 12% APY on stablecoins without touching a single line of code."',
    testimonialAuthor: 'Viktor Petrov',
    testimonialRole: 'Crypto Analyst',
    footerDesc: 'The trusted platform for digital asset management and DeFi.',
  },
  {
    keywords: ['education', 'learn', 'course', 'school', 'tutor', 'study', 'academy', 'university', 'teach'],
    brandName: 'LearnHub',
    primaryColor: '#0891b2',
    primaryDark: '#0e7490',
    accentLight: '#cffafe',
    heroTitle: 'Learn Without Limits',
    heroSubtitle: 'Access thousands of courses from world-class instructors. Master new skills at your own pace.',
    heroEmoji: '🎓',
    features: [
      { icon: '📚', title: '10,000+ Courses', desc: 'From coding to cooking, find expert-led courses in every subject imaginable.' },
      { icon: '🏆', title: 'Certifications', desc: 'Earn industry-recognized certificates that boost your career prospects.' },
      { icon: '🤖', title: 'AI Tutor', desc: 'Personalized learning paths and 24/7 AI-powered assistance for any question.' },
      { icon: '🎯', title: 'Practice Labs', desc: 'Hands-on coding environments, quizzes, and real-world projects.' },
      { icon: '👥', title: 'Study Groups', desc: 'Collaborate with peers worldwide through live sessions and discussion forums.' },
      { icon: '📱', title: 'Offline Access', desc: 'Download courses for offline learning — study anywhere, anytime.' },
    ],
    ctaTitle: 'Start Learning for Free',
    ctaSubtitle: 'Unlock your potential with unlimited access to expert courses. 7-day free trial included.',
    testimonial: '"LearnHub helped me switch careers from marketing to software engineering in just 6 months."',
    testimonialAuthor: 'Priya Sharma',
    testimonialRole: 'Software Engineer at Google',
    footerDesc: 'Empowering millions of learners worldwide with accessible education.',
  },
  {
    keywords: ['shop', 'store', 'ecommerce', 'e-commerce', 'fashion', 'clothing', 'retail', 'boutique', 'marketplace'],
    brandName: 'StyleMart',
    primaryColor: '#e11d48',
    primaryDark: '#be123c',
    accentLight: '#ffe4e6',
    heroTitle: 'Discover Your Perfect Style',
    heroSubtitle: 'Curated collections from top brands. Free shipping on orders over $50. Shop the latest trends.',
    heroEmoji: '🛍️',
    features: [
      { icon: '👗', title: 'Curated Collections', desc: 'Handpicked styles from 500+ brands, updated weekly with the latest trends.' },
      { icon: '🚚', title: 'Free Shipping', desc: 'Complimentary shipping on orders over $50 with hassle-free 30-day returns.' },
      { icon: '💳', title: 'Secure Checkout', desc: 'Multiple payment options with buyer protection on every purchase.' },
      { icon: '⭐', title: 'Reviews & Ratings', desc: 'Real customer reviews with photos so you shop with confidence.' },
      { icon: '🏷️', title: 'Flash Sales', desc: 'Daily deals and exclusive member-only discounts up to 70% off.' },
      { icon: '🔄', title: 'Easy Returns', desc: 'No-questions-asked returns within 30 days. Free return shipping included.' },
    ],
    ctaTitle: 'Shop the New Collection',
    ctaSubtitle: 'New arrivals just dropped. Get 15% off your first order with code WELCOME15.',
    testimonial: '"Finally an online store that gets my style. The curated picks are always on point!"',
    testimonialAuthor: 'Jessica Park',
    testimonialRole: 'Fashion Blogger',
    footerDesc: 'Your destination for curated fashion and lifestyle products.',
  },
  {
    keywords: ['blog', 'article', 'write', 'content', 'magazine', 'newsletter', 'publish', 'journal', 'news'],
    brandName: 'InkWell',
    primaryColor: '#0d9488',
    primaryDark: '#0f766e',
    accentLight: '#ccfbf1',
    heroTitle: 'Stories That Matter',
    heroSubtitle: 'Thought-provoking articles, in-depth analysis, and fresh perspectives from voices that inspire.',
    heroEmoji: '✍️',
    features: [
      { icon: '📖', title: 'Long-Form Reads', desc: 'Deep-dive articles and investigative pieces that go beyond the headlines.' },
      { icon: '🎙️', title: 'Author Voices', desc: 'Hear directly from writers through podcasts, AMAs, and exclusive interviews.' },
      { icon: '🔖', title: 'Smart Bookmarks', desc: 'Save articles for later with AI-powered tagging and personalized collections.' },
      { icon: '💡', title: 'Daily Insights', desc: 'Curated morning briefings with the ideas shaping our world today.' },
      { icon: '💬', title: 'Community', desc: 'Join vibrant discussions with fellow readers in moderated comment sections.' },
      { icon: '📧', title: 'Newsletter', desc: 'Weekly digest of the best stories delivered straight to your inbox.' },
    ],
    ctaTitle: 'Start Reading Today',
    ctaSubtitle: 'Get unlimited access to premium stories. Free for your first month.',
    testimonial: '"InkWell is where I go for writing that makes me think differently. Every article is a gem."',
    testimonialAuthor: 'David Okonkwo',
    testimonialRole: 'Journalist & Author',
    footerDesc: 'Independent publishing for the curious mind.',
  },
  {
    keywords: ['portfolio', 'resume', 'cv', 'personal', 'freelance', 'creative', 'showcase', 'artist'],
    brandName: 'CreativeFolio',
    primaryColor: '#6366f1',
    primaryDark: '#4f46d5',
    accentLight: '#e0e7ff',
    heroTitle: 'Showcase Your Creative Vision',
    heroSubtitle: 'Build a stunning portfolio that gets you hired. Beautiful templates, zero code required.',
    heroEmoji: '🎨',
    features: [
      { icon: '🖼️', title: 'Visual Gallery', desc: 'Drag-and-drop gallery layouts with lightbox, masonry, and carousel options.' },
      { icon: '🎭', title: 'Unique Themes', desc: 'Professionally designed templates that make your work stand out.' },
      { icon: '📱', title: 'Responsive', desc: 'Looks perfect on every device — from phones to ultrawide monitors.' },
      { icon: '🔍', title: 'SEO Optimized', desc: 'Built-in SEO tools so clients and recruiters can find you easily.' },
      { icon: '📊', title: 'Analytics', desc: 'Track visitors, popular projects, and referral sources in real-time.' },
      { icon: '🔗', title: 'Custom Domain', desc: 'Connect your own domain for a professional online presence.' },
    ],
    ctaTitle: 'Build Your Portfolio Now',
    ctaSubtitle: 'Join 100K+ creatives who showcase their work with CreativeFolio. Free to start.',
    testimonial: '"I landed three freelance gigs in my first month after switching to CreativeFolio."',
    testimonialAuthor: 'Nina Rodriguez',
    testimonialRole: 'Freelance Illustrator',
    footerDesc: 'The portfolio platform built for creatives, by creatives.',
  },
  {
    keywords: ['travel', 'trip', 'hotel', 'flight', 'vacation', 'booking', 'tour', 'adventure', 'destination'],
    brandName: 'WanderPath',
    primaryColor: '#0ea5e9',
    primaryDark: '#0284c7',
    accentLight: '#e0f2fe',
    heroTitle: 'Explore the World Your Way',
    heroSubtitle: 'Discover hidden gems, book unique stays, and plan unforgettable trips with AI-powered recommendations.',
    heroEmoji: '✈️',
    features: [
      { icon: '🗺️', title: 'Smart Itineraries', desc: 'AI-generated trip plans that adapt to your interests, budget, and travel style.' },
      { icon: '🏨', title: 'Unique Stays', desc: 'From boutique hotels to treehouses — find accommodations you won\'t find elsewhere.' },
      { icon: '💰', title: 'Best Price', desc: 'Price match guarantee with exclusive deals you won\'t find on other platforms.' },
      { icon: '📸', title: 'Travel Guides', desc: 'Local insider tips, photo spots, and off-the-beaten-path recommendations.' },
      { icon: '🛡️', title: 'Travel Insurance', desc: 'Comprehensive coverage with one-tap claims processing worldwide.' },
      { icon: '🌟', title: 'Reviews', desc: 'Verified traveler reviews with real photos to help you book with confidence.' },
    ],
    ctaTitle: 'Plan Your Next Adventure',
    ctaSubtitle: 'Save 20% on your first booking. Millions of destinations, one seamless experience.',
    testimonial: '"WanderPath found us a hidden beach in Thailand that no other travel site mentioned. Pure magic!"',
    testimonialAuthor: 'Tom & Lisa Anderson',
    testimonialRole: 'Travel Bloggers',
    footerDesc: 'Your passport to extraordinary travel experiences.',
  },
];

// ============ Fallback Design Generator ============
// Used when Z.ai LLM is unavailable so the app still works.
// Returns a JSON string in the { message, design } shape the chat pipeline expects.

export function generateFallbackDesign(userMessage: string, creativeMode?: boolean): string {
  const msg = userMessage.toLowerCase();

  if (msg.includes('landing') || msg.includes('hero') || msg.includes('page') || msg.includes('website') || msg.includes('saas')) {
    return JSON.stringify({
      message: 'I created a landing page with a navigation bar, hero section, features grid, testimonials, and call-to-action. You can customize it by telling me what to change!',
      design: buildLandingPageFallback(creativeMode),
    });
  }

  if (msg.includes('dashboard') || msg.includes('analytics') || msg.includes('admin')) {
    return JSON.stringify({
      message: 'I created a comprehensive dashboard layout with a sidebar, metric cards, activity feed, and chart area. Tell me what data you want to display!',
      design: buildDashboardFallback(),
    });
  }

  if (msg.includes('portfolio') || msg.includes('gallery') || msg.includes('showcase')) {
    return JSON.stringify({
      message: 'I created a stunning portfolio layout with a hero section, project gallery grid, and contact section. Let me know how to customize it!',
      design: buildPortfolioFallback(),
    });
  }

  if (msg.includes('mobile') || msg.includes('app') || msg.includes('onboarding') || msg.includes('ios') || msg.includes('android')) {
    return JSON.stringify({
      message: 'I created a mobile app onboarding flow with welcome screens and a sign-up interface. You can tell me to adjust the steps, colors, or content!',
      design: buildMobileOnboardingFallback(),
    });
  }

  if (msg.includes('pitch') || msg.includes('deck') || msg.includes('slide') || msg.includes('presentation')) {
    return JSON.stringify({
      message: 'I created a pitch deck with title, problem, solution, and market slides. Tell me to add more slides or adjust the content!',
      design: buildPitchDeckFallback(),
    });
  }

  if (msg.includes('pricing') || msg.includes('plan') || msg.includes('subscription') || msg.includes('tier')) {
    return JSON.stringify({
      message: 'I created a pricing page with three plan tiers and a comparison section. Tell me to adjust the prices, features, or add a FAQ section!',
      design: buildPricingFallback(),
    });
  }

  // Default design for any other request
  return JSON.stringify({
    message: 'I created a design based on your request. Tell me what to change — for example: "Make it darker", "Add a contact form", or "Change the layout"!',
    design: buildDefaultFallback(),
  });
}

// ============ Smart Contextual Fallback ============
// Used when LLM returned a response but JSON parsing AND repairLLMJson both fail.
// Generates a HIGH-QUALITY, topic-aware design based on the user's intent AND
// the LLM's description.

export function generateContextualFallback(userMessage: string, llmMessage: string, creativeMode?: boolean): string {
  const msg = (userMessage + ' ' + llmMessage).toLowerCase();

  // Try to find a matching topic template
  let bestTemplate = TOPIC_TEMPLATES[0];
  let bestScore = 0;

  for (const template of TOPIC_TEMPLATES) {
    let score = 0;
    for (const kw of template.keywords) {
      if (msg.includes(kw)) score += 2;
      // Partial match for compound words
      if (kw.length > 4 && msg.includes(kw.substring(0, 4))) score += 1;
    }
    if (score > bestScore) {
      bestScore = score;
      bestTemplate = template;
    }
  }

  const t = bestTemplate;

  return JSON.stringify({
    message: `I created a ${t.brandName}-style design based on your request! You can customize it by telling me what to change.`,
    design: buildTopicDesign(t, creativeMode),
  });
}

// ============ Internal builders ============
// (Kept local to this module; only the three exports above are part of the
// public API consumed by the chat route.)

function buildLandingPageFallback(creativeMode?: boolean) {
  return {
    id: 'root', type: 'root', tag: 'div',
    style: { display: 'flex', flexDirection: 'column', minHeight: '100vh', width: '100%', fontFamily: 'Inter, system-ui, sans-serif', backgroundColor: '#ffffff' },
    meta: { name: 'Landing Page' },
    children: [
      { id: 'nav-1', type: 'nav', tag: 'nav', style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 32px', maxWidth: '1200px', margin: '0 auto', width: '100%', backgroundColor: 'rgba(255,255,255,0.8)', backdropFilter: 'blur(12px)', position: 'sticky', top: '0', zIndex: '50', borderBottom: '1px solid rgba(226,232,240,0.5)' }, meta: { name: 'Navigation', ariaLabel: 'Main navigation', role: 'navigation' }, children: [
        { id: 'logo-1', type: 'text', tag: 'span', content: 'Z.Design', style: { fontSize: '22px', fontWeight: '800', background: 'linear-gradient(135deg, #10b981, #06b6d4)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' } },
        { id: 'nav-links', type: 'flex', tag: 'div', style: { display: 'flex', gap: '24px', alignItems: 'center' }, children: [
          { id: 'nl1', type: 'link', tag: 'a', content: 'Features', style: { fontSize: '14px', color: '#475569', textDecoration: 'none', fontWeight: '500' } },
          { id: 'nl2', type: 'link', tag: 'a', content: 'Pricing', style: { fontSize: '14px', color: '#475569', textDecoration: 'none', fontWeight: '500' } },
          { id: 'nl3', type: 'link', tag: 'a', content: 'About', style: { fontSize: '14px', color: '#475569', textDecoration: 'none', fontWeight: '500' } },
          { id: 'nb1', type: 'button', tag: 'button', content: 'Get Started', style: { padding: '10px 24px', background: 'linear-gradient(135deg, #10b981, #06b6d4)', color: '#ffffff', borderRadius: '10px', fontSize: '14px', fontWeight: '600', border: 'none', cursor: 'pointer', boxShadow: '0 2px 8px rgba(16,185,129,0.3)', transition: 'all 0.2s ease' } }
        ]}
      ]},
      { id: 'hero-1', type: 'section', tag: 'section', style: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '100px 32px 80px', textAlign: 'center', background: 'linear-gradient(180deg, #f0fdf4 0%, #ffffff 50%, #ecfdf5 100%)', backgroundImage: 'radial-gradient(circle at 20% 50%, rgba(16,185,129,0.12) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(6,182,212,0.08) 0%, transparent 40%)' }, meta: { name: 'Hero', ariaLabel: 'Hero section' }, children: [
        { id: 'hb1', type: 'badge', tag: 'span', content: '✨ AI-Powered Design', style: { padding: '6px 16px', backgroundColor: '#d1fae5', color: '#065f46', borderRadius: '20px', fontSize: '13px', fontWeight: '600', marginBottom: '24px', display: 'inline-block', border: '1px solid rgba(16,185,129,0.2)' } },
        { id: 'hh1', type: 'heading', tag: 'h1', content: creativeMode ? 'Imagine. Create. Inspire.' : 'Design Beautiful Websites With AI', style: { fontSize: 'clamp(36px, 5vw, 56px)', fontWeight: '800', lineHeight: '1.1', color: '#0f172a', maxWidth: '720px', marginBottom: '20px', letterSpacing: '-0.02em' } },
        { id: 'hp1', type: 'text', tag: 'p', content: creativeMode ? 'Break free from templates. Our AI understands your vision and crafts unique, boundary-pushing designs that stand out.' : 'Create stunning designs, prototypes, and websites through natural conversation. Powered by Z.ai.', style: { fontSize: '18px', color: '#475569', maxWidth: '540px', lineHeight: '1.7', marginBottom: '36px' } },
        { id: 'hbtns', type: 'flex', tag: 'div', style: { display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }, children: [
          { id: 'hb2', type: 'button', tag: 'button', content: 'Start Designing →', style: { padding: '14px 32px', background: 'linear-gradient(135deg, #10b981, #059669)', color: '#ffffff', borderRadius: '12px', fontSize: '16px', fontWeight: '600', border: 'none', cursor: 'pointer', boxShadow: '0 4px 16px rgba(16,185,129,0.35)', transition: 'all 0.2s ease' } },
          { id: 'hb3', type: 'button', tag: 'button', content: 'View Templates', style: { padding: '14px 32px', backgroundColor: '#ffffff', color: '#475569', borderRadius: '12px', fontSize: '16px', fontWeight: '500', border: '1px solid #e2e8f0', cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', transition: 'all 0.2s ease' } }
        ]}
      ]},
      { id: 'feat-1', type: 'section', tag: 'section', style: { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '96px 32px', backgroundColor: '#ffffff' }, meta: { name: 'Features', ariaLabel: 'Features section' }, children: [
        { id: 'fh2', type: 'heading', tag: 'h2', content: 'Everything you need to design faster', style: { fontSize: '36px', fontWeight: '700', color: '#0f172a', marginBottom: '56px' } },
        { id: 'fgrid', type: 'grid', tag: 'div', style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px', maxWidth: '1020px', width: '100%' }, children: [
          { id: 'fc1', type: 'card', tag: 'div', style: { padding: '32px', borderRadius: '16px', boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.06)' }, children: [
            { id: 'fi1', type: 'text', tag: 'div', content: '🎨', style: { fontSize: '32px', marginBottom: '16px' } },
            { id: 'fh3a', type: 'heading', tag: 'h3', content: 'AI Design Engine', style: { fontSize: '18px', fontWeight: '600', marginBottom: '8px' } },
            { id: 'fp1', type: 'text', tag: 'p', content: 'Generate complete designs from natural language descriptions.', style: { fontSize: '14px', color: '#475569', lineHeight: '1.6' } }
          ]}
        ]}
      ]},
      { id: 'footer-1', type: 'footer', tag: 'footer', style: { display: 'flex', justifyContent: 'center', padding: '32px', backgroundColor: '#0f172a' }, meta: { name: 'Footer', role: 'contentinfo' }, children: [
        { id: 'fcopy', type: 'text', tag: 'p', content: '© 2026 Z.Design. All rights reserved.', style: { color: '#64748b', fontSize: '13px' } }
      ]}
    ]
  };
}

function buildDashboardFallback() {
  return {
    id: 'root', type: 'root', tag: 'div',
    style: { display: 'flex', minHeight: '100vh', width: '100%', fontFamily: 'Inter, system-ui, sans-serif', backgroundColor: '#f1f5f9' },
    meta: { name: 'Dashboard' },
    children: [
      { id: 'sb1', type: 'sidebar', tag: 'aside', style: { width: '260px', minHeight: '100vh', background: 'linear-gradient(180deg, #0f172a 0%, #1e293b 100%)', padding: '24px 16px', display: 'flex', flexDirection: 'column' }, meta: { name: 'Sidebar', ariaLabel: 'Main sidebar navigation', role: 'navigation' }, children: [
        { id: 'sbl', type: 'text', tag: 'div', content: '📊 Dashboard', style: { fontSize: '18px', fontWeight: '700', background: 'linear-gradient(135deg, #34d399, #06b6d4)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', marginBottom: '32px', padding: '0 8px' } },
        { id: 'sbi1', type: 'text', tag: 'div', content: '📈 Overview', style: { padding: '10px 12px', borderRadius: '8px', backgroundColor: 'rgba(16,185,129,0.15)', color: '#34d399', fontSize: '14px', marginBottom: '4px', cursor: 'pointer', fontWeight: '500' } },
        { id: 'sbi2', type: 'text', tag: 'div', content: '📋 Projects', style: { padding: '10px 12px', borderRadius: '8px', color: '#94a3b8', fontSize: '14px', marginBottom: '4px', cursor: 'pointer' } },
        { id: 'sbi3', type: 'text', tag: 'div', content: '⚙️ Settings', style: { padding: '10px 12px', borderRadius: '8px', color: '#94a3b8', fontSize: '14px', cursor: 'pointer' } }
      ]},
      { id: 'main1', type: 'container', tag: 'main', style: { flex: '1', padding: '32px', display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '1200px' }, meta: { name: 'Main Content' }, children: [
        { id: 'mh1', type: 'heading', tag: 'h1', content: 'Dashboard Overview', style: { fontSize: '24px', fontWeight: '700', color: '#0f172a' } },
        { id: 'mgrid', type: 'grid', tag: 'div', style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }, children: [
          { id: 'mc1', type: 'card', tag: 'div', style: { padding: '24px', borderRadius: '16px', backgroundColor: '#ffffff', boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.06)' }, children: [
            { id: 'ml1', type: 'text', tag: 'p', content: 'Total Users', style: { fontSize: '13px', color: '#64748b', marginBottom: '8px' } },
            { id: 'mv1', type: 'heading', tag: 'h3', content: '12,345', style: { fontSize: '32px', fontWeight: '700', color: '#0f172a' } }
          ]}
        ]}
      ]}
    ]
  };
}

function buildPortfolioFallback() {
  return {
    id: 'root', type: 'root', tag: 'div',
    style: { display: 'flex', flexDirection: 'column', minHeight: '100vh', width: '100%', fontFamily: 'Inter, system-ui, sans-serif', backgroundColor: '#0f172a' },
    meta: { name: 'Portfolio' },
    children: [
      { id: 'nav-1', type: 'nav', tag: 'nav', style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 48px' }, meta: { name: 'Navigation', role: 'navigation' }, children: [
        { id: 'logo-1', type: 'text', tag: 'span', content: 'Portfolio', style: { fontSize: '18px', fontWeight: '700', color: '#ffffff' } }
      ]},
      { id: 'hero-1', type: 'section', tag: 'section', style: { display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '120px 48px 80px', minHeight: '80vh' }, meta: { name: 'Hero' }, children: [
        { id: 'hh1', type: 'heading', tag: 'h1', content: 'I craft digital experiences that inspire and delight', style: { fontSize: '56px', fontWeight: '800', lineHeight: '1.1', color: '#ffffff', maxWidth: '700px' } }
      ]}
    ]
  };
}

function buildMobileOnboardingFallback() {
  return {
    id: 'root', type: 'root', tag: 'div',
    style: { display: 'flex', justifyContent: 'center', minHeight: '100vh', width: '100%', fontFamily: 'Inter, system-ui, sans-serif', backgroundColor: '#f0f0f0' },
    meta: { name: 'Mobile App Onboarding' },
    children: [
      { id: 'phone-frame', type: 'container', tag: 'div', style: { width: '375px', minHeight: '812px', backgroundColor: '#ffffff', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px rgba(0,0,0,0.15)', borderRadius: '40px', overflow: 'hidden' }, children: [
        { id: 'ob-title', type: 'heading', tag: 'h2', content: 'Achieve Your Goals', style: { fontSize: '28px', fontWeight: '700', color: '#0f172a', padding: '40px 32px 16px', textAlign: 'center' } },
        { id: 'ob-btn', type: 'button', tag: 'button', content: 'Get Started', style: { margin: '24px 32px 48px', padding: '16px', backgroundColor: '#10b981', color: '#ffffff', borderRadius: '14px', fontSize: '16px', fontWeight: '600', border: 'none', cursor: 'pointer' } }
      ]}
    ]
  };
}

function buildPitchDeckFallback() {
  return {
    id: 'root', type: 'root', tag: 'div',
    style: { display: 'flex', flexDirection: 'column', minHeight: '100vh', width: '100%', fontFamily: 'Inter, system-ui, sans-serif', backgroundColor: '#0f172a' },
    meta: { name: 'Pitch Deck' },
    children: [
      { id: 'slide-title', type: 'section', tag: 'section', style: { display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', padding: '80px', textAlign: 'center' }, meta: { name: 'Title Slide' }, children: [
        { id: 'st-h1', type: 'heading', tag: 'h1', content: 'Revolutionizing Design with AI', style: { fontSize: '64px', fontWeight: '800', color: '#ffffff', letterSpacing: '-0.03em', lineHeight: '1.1', marginBottom: '32px', maxWidth: '900px' } }
      ]}
    ]
  };
}

function buildPricingFallback() {
  return {
    id: 'root', type: 'root', tag: 'div',
    style: { display: 'flex', flexDirection: 'column', minHeight: '100vh', width: '100%', fontFamily: 'Inter, system-ui, sans-serif', backgroundColor: '#ffffff' },
    meta: { name: 'Pricing Page' },
    children: [
      { id: 'pricing-hero', type: 'section', tag: 'section', style: { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '80px 32px 48px', textAlign: 'center' }, meta: { name: 'Pricing Header' }, children: [
        { id: 'ph1', type: 'heading', tag: 'h1', content: 'Simple, transparent pricing', style: { fontSize: '48px', fontWeight: '800', color: '#0f172a', marginBottom: '16px' } }
      ]}
    ]
  };
}

function buildDefaultFallback() {
  return {
    id: 'root', type: 'root', tag: 'div',
    style: { display: 'flex', flexDirection: 'column', minHeight: '100vh', width: '100%', fontFamily: 'Inter, system-ui, sans-serif', backgroundColor: '#ffffff' },
    meta: { name: 'Custom Design' },
    children: [
      { id: 'hero-1', type: 'section', tag: 'section', style: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: '1', padding: '100px 32px', textAlign: 'center' }, meta: { name: 'Hero' }, children: [
        { id: 'sh1', type: 'heading', tag: 'h1', content: 'Your Design Starts Here', style: { fontSize: '48px', fontWeight: '800', color: '#0f172a', marginBottom: '20px' } },
        { id: 'sp1', type: 'text', tag: 'p', content: 'Tell me more about what you want and I\'ll create a custom design for you.', style: { fontSize: '18px', color: '#475569', maxWidth: '540px', lineHeight: '1.7' } }
      ]}
    ]
  };
}

function buildTopicDesign(t: TopicTemplate, creativeMode?: boolean) {
  return {
    id: 'root', type: 'root', tag: 'div',
    style: { display: 'flex', flexDirection: 'column', minHeight: '100vh', width: '100%', fontFamily: 'Inter, system-ui, sans-serif', backgroundColor: '#ffffff' },
    meta: { name: `${t.brandName} Design` },
    children: [
      { id: 'nav-1', type: 'nav', tag: 'nav', style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 32px', backgroundColor: '#ffffff', borderBottom: '1px solid #e2e8f0', position: 'sticky', top: '0', zIndex: '50' }, meta: { name: 'Navigation', ariaLabel: 'Main navigation', role: 'navigation' }, children: [
        { id: 'logo-1', type: 'text', tag: 'span', content: t.brandName, style: { fontSize: '22px', fontWeight: '700', color: t.primaryColor } },
        { id: 'nav-links', type: 'flex', tag: 'div', style: { display: 'flex', gap: '24px', alignItems: 'center' }, children: [
          { id: 'nl1', type: 'link', tag: 'a', content: 'Features', style: { fontSize: '14px', color: '#475569', textDecoration: 'none', fontWeight: '500' } },
          { id: 'nb1', type: 'button', tag: 'button', content: 'Get Started', style: { padding: '10px 24px', backgroundColor: t.primaryColor, color: '#ffffff', borderRadius: '8px', fontSize: '14px', fontWeight: '600', border: 'none', cursor: 'pointer', boxShadow: `0 2px 8px ${t.primaryColor}40` } }
        ]}
      ]},
      { id: 'hero-1', type: 'section', tag: 'section', style: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '100px 32px 80px', textAlign: 'center', backgroundColor: '#f8fafc', backgroundImage: `radial-gradient(circle at 30% 50%, ${t.primaryColor}14 0%, transparent 50%)` }, meta: { name: 'Hero', ariaLabel: 'Hero section' }, children: [
        { id: 'hb1', type: 'badge', tag: 'span', content: `${t.heroEmoji} Powered by AI`, style: { padding: '6px 16px', backgroundColor: t.accentLight, color: t.primaryDark, borderRadius: '20px', fontSize: '13px', fontWeight: '500', marginBottom: '24px', display: 'inline-block' } },
        { id: 'hh1', type: 'heading', tag: 'h1', content: creativeMode ? `Reimagine. ${t.heroEmoji} Create.` : t.heroTitle, style: { fontSize: '52px', fontWeight: '800', lineHeight: '1.1', color: '#0f172a', maxWidth: '720px', marginBottom: '20px', letterSpacing: '-0.02em' } },
        { id: 'hp1', type: 'text', tag: 'p', content: t.heroSubtitle, style: { fontSize: '18px', color: '#475569', maxWidth: '540px', lineHeight: '1.7', marginBottom: '36px' } },
        { id: 'hbtns', type: 'flex', tag: 'div', style: { display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }, children: [
          { id: 'hb2', type: 'button', tag: 'button', content: 'Get Started', style: { padding: '14px 32px', backgroundColor: t.primaryColor, color: '#ffffff', borderRadius: '10px', fontSize: '16px', fontWeight: '600', border: 'none', cursor: 'pointer', boxShadow: `0 4px 16px ${t.primaryColor}4D`, transition: 'all 0.2s ease' } }
        ]}
      ]},
      { id: 'feat-1', type: 'section', tag: 'section', style: { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '96px 32px', backgroundColor: '#ffffff' }, meta: { name: 'Features', ariaLabel: 'Features section' }, children: [
        { id: 'fh2', type: 'heading', tag: 'h2', content: 'Everything you need to succeed', style: { fontSize: '36px', fontWeight: '700', color: '#0f172a', marginBottom: '56px' } },
        { id: 'fgrid', type: 'grid', tag: 'div', style: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '28px', maxWidth: '1020px', width: '100%' }, children: t.features.map((f, i) => ({
          id: `fc${i + 1}`, type: 'card', tag: 'div', style: { padding: '32px', borderRadius: '16px', border: '1px solid #e2e8f0', backgroundColor: '#ffffff', transition: 'box-shadow 0.2s ease' }, meta: { name: `Feature Card ${i + 1}` }, children: [
            { id: `fi${i + 1}`, type: 'text', tag: 'div', content: f.icon, style: { fontSize: '32px', marginBottom: '16px' } },
            { id: `fh3${String.fromCharCode(97 + i)}`, type: 'heading', tag: 'h3', content: f.title, style: { fontSize: '18px', fontWeight: '600', color: '#0f172a', marginBottom: '8px' } },
            { id: `fp${i + 1}`, type: 'text', tag: 'p', content: f.desc, style: { fontSize: '14px', color: '#475569', lineHeight: '1.6' } }
          ]
        })) }
      ]},
      { id: 'cta-1', type: 'section', tag: 'section', style: { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '96px 32px', background: `linear-gradient(135deg, ${t.primaryDark} 0%, ${t.primaryColor} 50%, ${t.primaryColor}99 100%)` }, meta: { name: 'Call to Action', ariaLabel: 'Call to action section' }, children: [
        { id: 'ch2', type: 'heading', tag: 'h2', content: t.ctaTitle, style: { fontSize: '40px', fontWeight: '700', color: '#ffffff', marginBottom: '16px' } },
        { id: 'cp1', type: 'text', tag: 'p', content: t.ctaSubtitle, style: { fontSize: '18px', color: `${t.accentLight}`, maxWidth: '500px', textAlign: 'center', marginBottom: '32px', lineHeight: '1.6' } }
      ]},
      { id: 'footer-1', type: 'footer', tag: 'footer', style: { display: 'flex', justifyContent: 'center', padding: '32px', backgroundColor: '#0f172a' }, meta: { name: 'Footer', role: 'contentinfo' }, children: [
        { id: 'fcopy', type: 'text', tag: 'p', content: `© 2026 ${t.brandName}. All rights reserved.`, style: { color: '#64748b', fontSize: '13px' } }
      ]}
    ]
  };
}
