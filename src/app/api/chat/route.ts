// Z.Design - Chat API Route
// Uses Z.ai LLM for intelligent design generation with conversation context

import { NextRequest, NextResponse } from 'next/server';
import ZAI from 'z-ai-web-dev-sdk';
import { db } from '@/lib/db';
import { parseAIResponse, repairLLMJson, DESIGN_REFINEMENT_SYSTEM_PROMPT } from '@/lib/ai-prompts';

// ============ ZAI Singleton ============

let zaiInstance: ZAI | null = null;

async function getZAI(): Promise<ZAI> {
  if (!zaiInstance) {
    zaiInstance = await ZAI.create();
  }
  return zaiInstance;
}

// ============ Types ============

interface ChatRequestBody {
  message: string;
  projectId: string;
  designTree?: Record<string, unknown>;
  designSystem?: Record<string, unknown>;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
  creativeMode?: boolean;
}

// ============ Fallback Design Generator ============
// Used when Z.ai LLM is unavailable so the app still works

function generateFallbackDesign(userMessage: string, creativeMode?: boolean): string {
  const msg = userMessage.toLowerCase();

  if (msg.includes('landing') || msg.includes('hero') || msg.includes('page') || msg.includes('website') || msg.includes('saas')) {
    return JSON.stringify({
      message: 'I created a landing page with a navigation bar, hero section, features grid, testimonials, and call-to-action. You can customize it by telling me what to change!',
      design: {
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
          { id: 'logos-1', type: 'section', tag: 'section', style: { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '48px 32px', backgroundColor: '#ffffff', borderBottom: '1px solid #f1f5f9' }, meta: { name: 'Trusted By', ariaLabel: 'Trusted by section' }, children: [
            { id: 'lt1', type: 'text', tag: 'p', content: 'Trusted by teams at', style: { fontSize: '13px', color: '#94a3b8', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '24px' } },
            { id: 'lrow', type: 'flex', tag: 'div', style: { display: 'flex', gap: '48px', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap' }, children: [
              { id: 'lg1', type: 'text', tag: 'span', content: 'Acme Corp', style: { fontSize: '18px', fontWeight: '700', color: '#cbd5e1' } },
              { id: 'lg2', type: 'text', tag: 'span', content: 'TechFlow', style: { fontSize: '18px', fontWeight: '700', color: '#cbd5e1' } },
              { id: 'lg3', type: 'text', tag: 'span', content: 'Innovate', style: { fontSize: '18px', fontWeight: '700', color: '#cbd5e1' } },
              { id: 'lg4', type: 'text', tag: 'span', content: 'Quantum', style: { fontSize: '18px', fontWeight: '700', color: '#cbd5e1' } },
              { id: 'lg5', type: 'text', tag: 'span', content: 'Nebula', style: { fontSize: '18px', fontWeight: '700', color: '#cbd5e1' } }
            ]}
          ]},
          { id: 'feat-1', type: 'section', tag: 'section', style: { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '96px 32px', backgroundColor: '#ffffff' }, meta: { name: 'Features', ariaLabel: 'Features section' }, children: [
            { id: 'flabel', type: 'badge', tag: 'span', content: 'FEATURES', style: { padding: '4px 12px', backgroundColor: '#d1fae5', color: '#065f46', borderRadius: '16px', fontSize: '12px', fontWeight: '600', letterSpacing: '0.05em', marginBottom: '16px' } },
            { id: 'fh2', type: 'heading', tag: 'h2', content: 'Everything you need to design faster', style: { fontSize: '36px', fontWeight: '700', color: '#0f172a', marginBottom: '16px', letterSpacing: '-0.01em' } },
            { id: 'fsub', type: 'text', tag: 'p', content: 'Powerful features that help you go from idea to production in minutes.', style: { fontSize: '18px', color: '#475569', maxWidth: '520px', textAlign: 'center', marginBottom: '56px', lineHeight: '1.6' } },
            { id: 'fgrid', type: 'grid', tag: 'div', style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px', maxWidth: '1020px', width: '100%' }, children: [
              { id: 'fc1', type: 'card', tag: 'div', style: { padding: '32px', borderRadius: '16px', border: '1px solid #e2e8f0', backgroundColor: '#ffffff', boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.06)', transition: 'box-shadow 0.2s ease, transform 0.2s ease' }, meta: { name: 'Feature Card 1', description: 'Hover to see shadow elevation' }, children: [
                { id: 'fi1', type: 'text', tag: 'div', content: '🎨', style: { fontSize: '32px', marginBottom: '16px' } },
                { id: 'fh3a', type: 'heading', tag: 'h3', content: 'AI Design Engine', style: { fontSize: '18px', fontWeight: '600', color: '#0f172a', marginBottom: '8px' } },
                { id: 'fp1', type: 'text', tag: 'p', content: 'Generate complete designs from natural language descriptions. Just describe what you want.', style: { fontSize: '14px', color: '#475569', lineHeight: '1.6' } }
              ]},
              { id: 'fc2', type: 'card', tag: 'div', style: { padding: '32px', borderRadius: '16px', border: '1px solid #e2e8f0', backgroundColor: '#ffffff', boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.06)', transition: 'box-shadow 0.2s ease, transform 0.2s ease' }, meta: { name: 'Feature Card 2', description: 'Hover to see shadow elevation' }, children: [
                { id: 'fi2', type: 'text', tag: 'div', content: '🎤', style: { fontSize: '32px', marginBottom: '16px' } },
                { id: 'fh3b', type: 'heading', tag: 'h3', content: 'Voice Control', style: { fontSize: '18px', fontWeight: '600', color: '#0f172a', marginBottom: '8px' } },
                { id: 'fp2', type: 'text', tag: 'p', content: 'Design with your voice — speak and see changes in real-time. Hands-free creativity.', style: { fontSize: '14px', color: '#475569', lineHeight: '1.6' } }
              ]},
              { id: 'fc3', type: 'card', tag: 'div', style: { padding: '32px', borderRadius: '16px', border: '1px solid #e2e8f0', backgroundColor: '#ffffff', boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.06)', transition: 'box-shadow 0.2s ease, transform 0.2s ease' }, meta: { name: 'Feature Card 3', description: 'Hover to see shadow elevation' }, children: [
                { id: 'fi3', type: 'text', tag: 'div', content: '👥', style: { fontSize: '32px', marginBottom: '16px' } },
                { id: 'fh3c', type: 'heading', tag: 'h3', content: 'Real-time Collab', style: { fontSize: '18px', fontWeight: '600', color: '#0f172a', marginBottom: '8px' } },
                { id: 'fp3', type: 'text', tag: 'p', content: 'Work together with your team in real-time. See changes instantly across all devices.', style: { fontSize: '14px', color: '#475569', lineHeight: '1.6' } }
              ]},
              { id: 'fc4', type: 'card', tag: 'div', style: { padding: '32px', borderRadius: '16px', border: '1px solid #e2e8f0', backgroundColor: '#ffffff', boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.06)', transition: 'box-shadow 0.2s ease, transform 0.2s ease' }, meta: { name: 'Feature Card 4', description: 'Hover to see shadow elevation' }, children: [
                { id: 'fi4', type: 'text', tag: 'div', content: '⚡', style: { fontSize: '32px', marginBottom: '16px' } },
                { id: 'fh3d', type: 'heading', tag: 'h3', content: 'Instant Export', style: { fontSize: '18px', fontWeight: '600', color: '#0f172a', marginBottom: '8px' } },
                { id: 'fp4', type: 'text', tag: 'p', content: 'Export your designs as production-ready code. React, HTML/CSS, or your framework of choice.', style: { fontSize: '14px', color: '#475569', lineHeight: '1.6' } }
              ]},
              { id: 'fc5', type: 'card', tag: 'div', style: { padding: '32px', borderRadius: '16px', border: '1px solid #e2e8f0', backgroundColor: '#ffffff', boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.06)', transition: 'box-shadow 0.2s ease, transform 0.2s ease' }, meta: { name: 'Feature Card 5', description: 'Hover to see shadow elevation' }, children: [
                { id: 'fi5', type: 'text', tag: 'div', content: '🔒', style: { fontSize: '32px', marginBottom: '16px' } },
                { id: 'fh3e', type: 'heading', tag: 'h3', content: 'Enterprise Security', style: { fontSize: '18px', fontWeight: '600', color: '#0f172a', marginBottom: '8px' } },
                { id: 'fp5', type: 'text', tag: 'p', content: 'SOC 2 compliant with end-to-end encryption. Your designs stay private and secure.', style: { fontSize: '14px', color: '#475569', lineHeight: '1.6' } }
              ]},
              { id: 'fc6', type: 'card', tag: 'div', style: { padding: '32px', borderRadius: '16px', border: '1px solid #e2e8f0', backgroundColor: '#ffffff', boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.06)', transition: 'box-shadow 0.2s ease, transform 0.2s ease' }, meta: { name: 'Feature Card 6', description: 'Hover to see shadow elevation' }, children: [
                { id: 'fi6', type: 'text', tag: 'div', content: '🧩', style: { fontSize: '32px', marginBottom: '16px' } },
                { id: 'fh3f', type: 'heading', tag: 'h3', content: 'Design Systems', style: { fontSize: '18px', fontWeight: '600', color: '#0f172a', marginBottom: '8px' } },
                { id: 'fp6', type: 'text', tag: 'p', content: 'Create and manage design tokens, components, and patterns in one unified system.', style: { fontSize: '14px', color: '#475569', lineHeight: '1.6' } }
              ]}
            ]}
          ]},
          { id: 'testimonials-1', type: 'section', tag: 'section', style: { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '96px 32px', backgroundColor: '#f8fafc', backgroundImage: 'radial-gradient(circle at 70% 80%, rgba(139,92,246,0.06) 0%, transparent 50%)' }, meta: { name: 'Testimonials', ariaLabel: 'Testimonials section' }, children: [
            { id: 'th2', type: 'heading', tag: 'h2', content: 'Loved by designers everywhere', style: { fontSize: '36px', fontWeight: '700', color: '#0f172a', marginBottom: '56px', letterSpacing: '-0.01em' } },
            { id: 'tgrid', type: 'grid', tag: 'div', style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px', maxWidth: '1020px', width: '100%' }, children: [
              { id: 'tc1', type: 'card', tag: 'div', style: { padding: '28px', borderRadius: '16px', backgroundColor: '#ffffff', border: '1px solid #e2e8f0', boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.06)' }, children: [
                { id: 'tq1', type: 'text', tag: 'p', content: '"Z.Design cut our design time by 80%. We went from weeks to hours for new landing pages."', style: { fontSize: '15px', color: '#0f172a', lineHeight: '1.6', marginBottom: '20px', fontStyle: 'italic' } },
                { id: 'ta1', type: 'flex', tag: 'div', style: { display: 'flex', alignItems: 'center', gap: '12px' }, children: [
                  { id: 'tav1', type: 'avatar', tag: 'div', content: 'SK', style: { width: '40px', height: '40px', borderRadius: '50%', background: 'linear-gradient(135deg, #10b981, #06b6d4)', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: '600' } },
                  { id: 'tn1', type: 'text', tag: 'div', content: 'Sarah Kim', style: { fontSize: '14px', fontWeight: '600', color: '#0f172a' } },
                  { id: 'tr1', type: 'text', tag: 'span', content: 'Head of Design, Acme Corp', style: { fontSize: '13px', color: '#94a3b8' } }
                ]}
              ]},
              { id: 'tc2', type: 'card', tag: 'div', style: { padding: '28px', borderRadius: '16px', backgroundColor: '#ffffff', border: '1px solid #e2e8f0', boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.06)' }, children: [
                { id: 'tq2', type: 'text', tag: 'p', content: '"The AI understands exactly what I want. It feels like having a senior designer on call 24/7."', style: { fontSize: '15px', color: '#0f172a', lineHeight: '1.6', marginBottom: '20px', fontStyle: 'italic' } },
                { id: 'ta2', type: 'flex', tag: 'div', style: { display: 'flex', alignItems: 'center', gap: '12px' }, children: [
                  { id: 'tav2', type: 'avatar', tag: 'div', content: 'MR', style: { width: '40px', height: '40px', borderRadius: '50%', background: 'linear-gradient(135deg, #8b5cf6, #6366f1)', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: '600' } },
                  { id: 'tn2', type: 'text', tag: 'div', content: 'Marcus Rivera', style: { fontSize: '14px', fontWeight: '600', color: '#0f172a' } },
                  { id: 'tr2', type: 'text', tag: 'span', content: 'CTO, TechFlow', style: { fontSize: '13px', color: '#94a3b8' } }
                ]}
              ]},
              { id: 'tc3', type: 'card', tag: 'div', style: { padding: '28px', borderRadius: '16px', backgroundColor: '#ffffff', border: '1px solid #e2e8f0', boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.06)' }, children: [
                { id: 'tq3', type: 'text', tag: 'p', content: '"We replaced three design tools with Z.Design. Everything we need is now in one place."', style: { fontSize: '15px', color: '#0f172a', lineHeight: '1.6', marginBottom: '20px', fontStyle: 'italic' } },
                { id: 'ta3', type: 'flex', tag: 'div', style: { display: 'flex', alignItems: 'center', gap: '12px' }, children: [
                  { id: 'tav3', type: 'avatar', tag: 'div', content: 'JL', style: { width: '40px', height: '40px', borderRadius: '50%', background: 'linear-gradient(135deg, #f59e0b, #ef4444)', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: '600' } },
                  { id: 'tn3', type: 'text', tag: 'div', content: 'Julia Lee', style: { fontSize: '14px', fontWeight: '600', color: '#0f172a' } },
                  { id: 'tr3', type: 'text', tag: 'span', content: 'Product Lead, Innovate', style: { fontSize: '13px', color: '#94a3b8' } }
                ]}
              ]}
            ]}
          ]},
          { id: 'cta-1', type: 'section', tag: 'section', style: { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '96px 32px', background: 'linear-gradient(135deg, #059669 0%, #10b981 40%, #06b6d4 100%)', position: 'relative', overflow: 'hidden' }, meta: { name: 'Call to Action', ariaLabel: 'Call to action section' }, children: [
            { id: 'ch2', type: 'heading', tag: 'h2', content: 'Ready to Start Designing?', style: { fontSize: 'clamp(28px, 4vw, 42px)', fontWeight: '700', color: '#ffffff', marginBottom: '16px', letterSpacing: '-0.01em' } },
            { id: 'cp1', type: 'text', tag: 'p', content: 'Join thousands of designers who use Z.Design to create faster. Free to start, no credit card required.', style: { fontSize: '18px', color: '#d1fae5', maxWidth: '500px', textAlign: 'center', marginBottom: '32px', lineHeight: '1.6' } },
            { id: 'cbtns', type: 'flex', tag: 'div', style: { display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }, children: [
              { id: 'cb1', type: 'button', tag: 'button', content: 'Get Started Free', style: { padding: '14px 32px', backgroundColor: '#ffffff', color: '#059669', borderRadius: '12px', fontSize: '16px', fontWeight: '600', border: 'none', cursor: 'pointer', boxShadow: '0 4px 16px rgba(0,0,0,0.15)', transition: 'all 0.2s ease' } },
              { id: 'cb2', type: 'button', tag: 'button', content: 'Schedule Demo', style: { padding: '14px 32px', backgroundColor: 'transparent', color: '#ffffff', borderRadius: '12px', fontSize: '16px', fontWeight: '500', border: '2px solid rgba(255,255,255,0.4)', cursor: 'pointer', transition: 'all 0.2s ease' } }
            ]}
          ]},
          { id: 'footer-1', type: 'footer', tag: 'footer', style: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '64px 48px 32px', maxWidth: '1200px', margin: '0 auto', width: '100%', backgroundColor: '#0f172a' }, meta: { name: 'Footer', ariaLabel: 'Site footer', role: 'contentinfo' }, children: [
            { id: 'fcol1', type: 'container', tag: 'div', style: { display: 'flex', flexDirection: 'column', maxWidth: '280px' }, children: [
              { id: 'flogo', type: 'text', tag: 'span', content: 'Z.Design', style: { fontSize: '20px', fontWeight: '700', background: 'linear-gradient(135deg, #34d399, #06b6d4)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', marginBottom: '16px' } },
              { id: 'fdesc', type: 'text', tag: 'p', content: 'AI-powered visual design platform. Create stunning websites through natural conversation.', style: { fontSize: '14px', color: '#94a3b8', lineHeight: '1.6', marginBottom: '20px' } }
            ]},
            { id: 'fcol2', type: 'container', tag: 'div', style: { display: 'flex', gap: '64px' }, children: [
              { id: 'flinks1', type: 'container', tag: 'div', style: { display: 'flex', flexDirection: 'column', gap: '12px' }, children: [
                { id: 'flt1', type: 'text', tag: 'span', content: 'Product', style: { fontSize: '14px', fontWeight: '600', color: '#ffffff', marginBottom: '4px' } },
                { id: 'fl1', type: 'link', tag: 'a', content: 'Features', style: { fontSize: '14px', color: '#94a3b8', textDecoration: 'none' } },
                { id: 'fl2', type: 'link', tag: 'a', content: 'Pricing', style: { fontSize: '14px', color: '#94a3b8', textDecoration: 'none' } },
                { id: 'fl3', type: 'link', tag: 'a', content: 'Changelog', style: { fontSize: '14px', color: '#94a3b8', textDecoration: 'none' } }
              ]},
              { id: 'flinks2', type: 'container', tag: 'div', style: { display: 'flex', flexDirection: 'column', gap: '12px' }, children: [
                { id: 'flt2', type: 'text', tag: 'span', content: 'Company', style: { fontSize: '14px', fontWeight: '600', color: '#ffffff', marginBottom: '4px' } },
                { id: 'fl4', type: 'link', tag: 'a', content: 'About', style: { fontSize: '14px', color: '#94a3b8', textDecoration: 'none' } },
                { id: 'fl5', type: 'link', tag: 'a', content: 'Blog', style: { fontSize: '14px', color: '#94a3b8', textDecoration: 'none' } },
                { id: 'fl6', type: 'link', tag: 'a', content: 'Careers', style: { fontSize: '14px', color: '#94a3b8', textDecoration: 'none' } }
              ]},
              { id: 'flinks3', type: 'container', tag: 'div', style: { display: 'flex', flexDirection: 'column', gap: '12px' }, children: [
                { id: 'flt3', type: 'text', tag: 'span', content: 'Legal', style: { fontSize: '14px', fontWeight: '600', color: '#ffffff', marginBottom: '4px' } },
                { id: 'fl7', type: 'link', tag: 'a', content: 'Privacy', style: { fontSize: '14px', color: '#94a3b8', textDecoration: 'none' } },
                { id: 'fl8', type: 'link', tag: 'a', content: 'Terms', style: { fontSize: '14px', color: '#94a3b8', textDecoration: 'none' } }
              ]}
            ]}
          ]},
          { id: 'footer-bottom', type: 'container', tag: 'div', style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 48px', maxWidth: '1200px', margin: '0 auto', width: '100%', backgroundColor: '#0f172a', borderTop: '1px solid #1e293b' }, children: [
            { id: 'fcopy', type: 'text', tag: 'p', content: '© 2026 Z.Design. All rights reserved.', style: { color: '#64748b', fontSize: '13px' } }
          ]}
        ]
      }
    });
  }

  if (msg.includes('dashboard') || msg.includes('analytics') || msg.includes('admin')) {
    return JSON.stringify({
      message: 'I created a comprehensive dashboard layout with a sidebar, metric cards, activity feed, and chart area. Tell me what data you want to display!',
      design: {
        id: 'root', type: 'root', tag: 'div',
        style: { display: 'flex', minHeight: '100vh', width: '100%', fontFamily: 'Inter, system-ui, sans-serif', backgroundColor: '#f1f5f9' },
        meta: { name: 'Dashboard' },
        children: [
          { id: 'sb1', type: 'sidebar', tag: 'aside', style: { width: '260px', minHeight: '100vh', background: 'linear-gradient(180deg, #0f172a 0%, #1e293b 100%)', padding: '24px 16px', display: 'flex', flexDirection: 'column', flexShrink: '0' }, meta: { name: 'Sidebar', ariaLabel: 'Main sidebar navigation', role: 'navigation' }, children: [
            { id: 'sbl', type: 'text', tag: 'div', content: '📊 Dashboard', style: { fontSize: '18px', fontWeight: '700', background: 'linear-gradient(135deg, #34d399, #06b6d4)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', marginBottom: '32px', padding: '0 8px' } },
            { id: 'sbi1', type: 'text', tag: 'div', content: '📈 Overview', style: { padding: '10px 12px', borderRadius: '8px', backgroundColor: 'rgba(16,185,129,0.15)', color: '#34d399', fontSize: '14px', marginBottom: '4px', cursor: 'pointer', fontWeight: '500' } },
            { id: 'sbi2', type: 'text', tag: 'div', content: '📋 Projects', style: { padding: '10px 12px', borderRadius: '8px', color: '#94a3b8', fontSize: '14px', marginBottom: '4px', cursor: 'pointer', transition: 'all 0.15s ease' } },
            { id: 'sbi3', type: 'text', tag: 'div', content: '👥 Team', style: { padding: '10px 12px', borderRadius: '8px', color: '#94a3b8', fontSize: '14px', marginBottom: '4px', cursor: 'pointer', transition: 'all 0.15s ease' } },
            { id: 'sbi4', type: 'text', tag: 'div', content: '📊 Analytics', style: { padding: '10px 12px', borderRadius: '8px', color: '#94a3b8', fontSize: '14px', marginBottom: '4px', cursor: 'pointer', transition: 'all 0.15s ease' } },
            { id: 'sbi5', type: 'text', tag: 'div', content: '⚙️ Settings', style: { padding: '10px 12px', borderRadius: '8px', color: '#94a3b8', fontSize: '14px', cursor: 'pointer', transition: 'all 0.15s ease' } }
          ]},
          { id: 'main1', type: 'container', tag: 'main', style: { flex: '1', padding: '32px', display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '1200px' }, meta: { name: 'Main Content' }, children: [
            { id: 'mheader', type: 'flex', tag: 'div', style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }, children: [
              { id: 'mh1', type: 'heading', tag: 'h1', content: 'Dashboard Overview', style: { fontSize: '24px', fontWeight: '700', color: '#0f172a' } },
              { id: 'mhb1', type: 'button', tag: 'button', content: '+ New Report', style: { padding: '8px 20px', background: 'linear-gradient(135deg, #10b981, #059669)', color: '#ffffff', borderRadius: '10px', fontSize: '14px', fontWeight: '500', border: 'none', cursor: 'pointer', boxShadow: '0 2px 8px rgba(16,185,129,0.3)', transition: 'all 0.2s ease' } }
            ]},
            { id: 'mgrid', type: 'grid', tag: 'div', style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }, children: [
              { id: 'mc1', type: 'card', tag: 'div', style: { padding: '24px', borderRadius: '16px', backgroundColor: '#ffffff', border: '1px solid #e2e8f0', boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.06)' }, meta: { name: 'Metric: Users' }, children: [
                { id: 'ml1', type: 'text', tag: 'p', content: 'Total Users', style: { fontSize: '13px', color: '#64748b', marginBottom: '8px', fontWeight: '500' } },
                { id: 'mv1', type: 'heading', tag: 'h3', content: '12,345', style: { fontSize: '32px', fontWeight: '700', color: '#0f172a', marginBottom: '4px' } },
                { id: 'mc1c', type: 'text', tag: 'span', content: '↑ 12.5% from last month', style: { fontSize: '13px', color: '#10b981', fontWeight: '500' } }
              ]},
              { id: 'mc2', type: 'card', tag: 'div', style: { padding: '24px', borderRadius: '16px', backgroundColor: '#ffffff', border: '1px solid #e2e8f0', boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.06)' }, meta: { name: 'Metric: Revenue' }, children: [
                { id: 'ml2', type: 'text', tag: 'p', content: 'Revenue', style: { fontSize: '13px', color: '#64748b', marginBottom: '8px', fontWeight: '500' } },
                { id: 'mv2', type: 'heading', tag: 'h3', content: '$48.2K', style: { fontSize: '32px', fontWeight: '700', color: '#0f172a', marginBottom: '4px' } },
                { id: 'mc2c', type: 'text', tag: 'span', content: '↑ 8.1% from last month', style: { fontSize: '13px', color: '#10b981', fontWeight: '500' } }
              ]},
              { id: 'mc3', type: 'card', tag: 'div', style: { padding: '24px', borderRadius: '16px', backgroundColor: '#ffffff', border: '1px solid #e2e8f0', boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.06)' }, meta: { name: 'Metric: Active' }, children: [
                { id: 'ml3', type: 'text', tag: 'p', content: 'Active Now', style: { fontSize: '13px', color: '#64748b', marginBottom: '8px', fontWeight: '500' } },
                { id: 'mv3', type: 'heading', tag: 'h3', content: '573', style: { fontSize: '32px', fontWeight: '700', color: '#0f172a', marginBottom: '4px' } },
                { id: 'mc3c', type: 'text', tag: 'span', content: '↑ 2.4% from last hour', style: { fontSize: '13px', color: '#10b981', fontWeight: '500' } }
              ]},
              { id: 'mc4', type: 'card', tag: 'div', style: { padding: '24px', borderRadius: '16px', backgroundColor: '#ffffff', border: '1px solid #e2e8f0', boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.06)' }, meta: { name: 'Metric: Conversion' }, children: [
                { id: 'ml4', type: 'text', tag: 'p', content: 'Conversion', style: { fontSize: '13px', color: '#64748b', marginBottom: '8px', fontWeight: '500' } },
                { id: 'mv4', type: 'heading', tag: 'h3', content: '3.2%', style: { fontSize: '32px', fontWeight: '700', color: '#0f172a', marginBottom: '4px' } },
                { id: 'mc4c', type: 'text', tag: 'span', content: '↓ 0.4% from last month', style: { fontSize: '13px', color: '#ef4444', fontWeight: '500' } }
              ]}
            ]},
            { id: 'mcontent-grid', type: 'grid', tag: 'div', style: { display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px' }, children: [
              { id: 'chart1', type: 'card', tag: 'div', style: { padding: '24px', borderRadius: '16px', backgroundColor: '#ffffff', border: '1px solid #e2e8f0', boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.06)' }, meta: { name: 'Revenue Chart' }, children: [
                { id: 'cht1', type: 'heading', tag: 'h3', content: 'Revenue Over Time', style: { fontSize: '16px', fontWeight: '600', color: '#0f172a', marginBottom: '16px' } },
                { id: 'chp1', type: 'text', tag: 'p', content: '📊 Interactive chart area — Ask me to add specific visualizations!', style: { color: '#94a3b8', fontSize: '15px', padding: '40px 0', textAlign: 'center' } }
              ]},
              { id: 'activity1', type: 'card', tag: 'div', style: { padding: '24px', borderRadius: '16px', backgroundColor: '#ffffff', border: '1px solid #e2e8f0', boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.06)' }, meta: { name: 'Recent Activity' }, children: [
                { id: 'act1', type: 'heading', tag: 'h3', content: 'Recent Activity', style: { fontSize: '16px', fontWeight: '600', color: '#0f172a', marginBottom: '16px' } },
                { id: 'ai1', type: 'flex', tag: 'div', style: { display: 'flex', gap: '12px', alignItems: 'flex-start', marginBottom: '16px' }, children: [
                  { id: 'ai1d', type: 'avatar', tag: 'div', content: 'SK', style: { width: '32px', height: '32px', borderRadius: '50%', background: 'linear-gradient(135deg, #10b981, #06b6d4)', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: '600', flexShrink: '0' } },
                  { id: 'ai1t', type: 'container', tag: 'div', style: { display: 'flex', flexDirection: 'column' }, children: [
                    { id: 'ai1m', type: 'text', tag: 'p', content: 'Sarah updated the landing page design', style: { fontSize: '14px', color: '#0f172a', lineHeight: '1.4' } },
                    { id: 'ai1tm', type: 'text', tag: 'span', content: '2 min ago', style: { fontSize: '12px', color: '#94a3b8' } }
                  ]}
                ]},
                { id: 'ai2', type: 'flex', tag: 'div', style: { display: 'flex', gap: '12px', alignItems: 'flex-start', marginBottom: '16px' }, children: [
                  { id: 'ai2d', type: 'avatar', tag: 'div', content: 'MR', style: { width: '32px', height: '32px', borderRadius: '50%', background: 'linear-gradient(135deg, #8b5cf6, #6366f1)', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: '600', flexShrink: '0' } },
                  { id: 'ai2t', type: 'container', tag: 'div', style: { display: 'flex', flexDirection: 'column' }, children: [
                    { id: 'ai2m', type: 'text', tag: 'p', content: 'Marcus published the Q4 report', style: { fontSize: '14px', color: '#0f172a', lineHeight: '1.4' } },
                    { id: 'ai2tm', type: 'text', tag: 'span', content: '15 min ago', style: { fontSize: '12px', color: '#94a3b8' } }
                  ]}
                ]},
                { id: 'ai3', type: 'flex', tag: 'div', style: { display: 'flex', gap: '12px', alignItems: 'flex-start' }, children: [
                  { id: 'ai3d', type: 'avatar', tag: 'div', content: 'JL', style: { width: '32px', height: '32px', borderRadius: '50%', background: 'linear-gradient(135deg, #f59e0b, #ef4444)', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: '600', flexShrink: '0' } },
                  { id: 'ai3t', type: 'container', tag: 'div', style: { display: 'flex', flexDirection: 'column' }, children: [
                    { id: 'ai3m', type: 'text', tag: 'p', content: 'Julia added 3 new team members', style: { fontSize: '14px', color: '#0f172a', lineHeight: '1.4' } },
                    { id: 'ai3tm', type: 'text', tag: 'span', content: '1 hour ago', style: { fontSize: '12px', color: '#94a3b8' } }
                  ]}
                ]}
              ]}
            ]}
          ]}
        ]
      }
    });
  }

  // Portfolio / creative design
  if (msg.includes('portfolio') || msg.includes('gallery') || msg.includes('showcase')) {
    return JSON.stringify({
      message: 'I created a stunning portfolio layout with a hero section, project gallery grid, and contact section. Let me know how to customize it!',
      design: {
        id: 'root', type: 'root', tag: 'div',
        style: { display: 'flex', flexDirection: 'column', minHeight: '100vh', width: '100%', fontFamily: 'Inter, system-ui, sans-serif', backgroundColor: '#0f172a' },
        meta: { name: 'Portfolio' },
        children: [
          { id: 'nav-1', type: 'nav', tag: 'nav', style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 48px' }, meta: { name: 'Navigation', ariaLabel: 'Main navigation', role: 'navigation' }, children: [
            { id: 'logo-1', type: 'text', tag: 'span', content: 'Portfolio', style: { fontSize: '18px', fontWeight: '700', color: '#ffffff' } },
            { id: 'nav-links', type: 'flex', tag: 'div', style: { display: 'flex', gap: '32px', alignItems: 'center' }, children: [
              { id: 'nl1', type: 'link', tag: 'a', content: 'Work', style: { fontSize: '14px', color: '#94a3b8', textDecoration: 'none', fontWeight: '500' } },
              { id: 'nl2', type: 'link', tag: 'a', content: 'About', style: { fontSize: '14px', color: '#94a3b8', textDecoration: 'none', fontWeight: '500' } },
              { id: 'nl3', type: 'link', tag: 'a', content: 'Contact', style: { fontSize: '14px', color: '#94a3b8', textDecoration: 'none', fontWeight: '500' } }
            ]}
          ]},
          { id: 'hero-1', type: 'section', tag: 'section', style: { display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '120px 48px 80px', minHeight: '80vh' }, meta: { name: 'Hero', ariaLabel: 'Hero section' }, children: [
            { id: 'hl1', type: 'text', tag: 'p', content: 'Creative Designer & Developer', style: { fontSize: '16px', color: '#34d399', fontWeight: '500', marginBottom: '24px', letterSpacing: '0.05em', textTransform: 'uppercase' } },
            { id: 'hh1', type: 'heading', tag: 'h1', content: 'I craft digital experiences that inspire and delight', style: { fontSize: '56px', fontWeight: '800', lineHeight: '1.1', color: '#ffffff', maxWidth: '700px', letterSpacing: '-0.02em' } },
            { id: 'hp1', type: 'text', tag: 'p', content: 'Designing for the web, mobile, and beyond. Currently available for freelance projects.', style: { fontSize: '18px', color: '#94a3b8', maxWidth: '480px', lineHeight: '1.7', marginTop: '24px' } }
          ]},
          { id: 'projects-1', type: 'section', tag: 'section', style: { display: 'flex', flexDirection: 'column', padding: '80px 48px' }, meta: { name: 'Projects', ariaLabel: 'Projects section' }, children: [
            { id: 'ph2', type: 'heading', tag: 'h2', content: 'Selected Work', style: { fontSize: '32px', fontWeight: '700', color: '#ffffff', marginBottom: '48px' } },
            { id: 'pgrid', type: 'grid', tag: 'div', style: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '24px' }, children: [
              { id: 'pc1', type: 'card', tag: 'div', style: { borderRadius: '16px', overflow: 'hidden', backgroundColor: '#1e293b' }, meta: { name: 'Project 1' }, children: [
                { id: 'pimg1', type: 'image', tag: 'img', content: 'https://placehold.co/600x400/10b981/ffffff?text=Project+1', style: { width: '100%', height: '280px', objectFit: 'cover' }, meta: { alt: 'E-Commerce Redesign project screenshot' } },
                { id: 'pc1info', type: 'container', tag: 'div', style: { padding: '24px' }, children: [
                  { id: 'pc1t', type: 'heading', tag: 'h3', content: 'E-Commerce Redesign', style: { fontSize: '18px', fontWeight: '600', color: '#ffffff', marginBottom: '8px' } },
                  { id: 'pc1d', type: 'text', tag: 'p', content: 'UX/UI Design • Web Development', style: { fontSize: '14px', color: '#94a3b8' } }
                ]}
              ]},
              { id: 'pc2', type: 'card', tag: 'div', style: { borderRadius: '16px', overflow: 'hidden', backgroundColor: '#1e293b' }, meta: { name: 'Project 2' }, children: [
                { id: 'pimg2', type: 'image', tag: 'img', content: 'https://placehold.co/600x400/06b6d4/ffffff?text=Project+2', style: { width: '100%', height: '280px', objectFit: 'cover' }, meta: { alt: 'Finance Dashboard project screenshot' } },
                { id: 'pc2info', type: 'container', tag: 'div', style: { padding: '24px' }, children: [
                  { id: 'pc2t', type: 'heading', tag: 'h3', content: 'Finance Dashboard', style: { fontSize: '18px', fontWeight: '600', color: '#ffffff', marginBottom: '8px' } },
                  { id: 'pc2d', type: 'text', tag: 'p', content: 'Product Design • Data Visualization', style: { fontSize: '14px', color: '#94a3b8' } }
                ]}
              ]},
              { id: 'pc3', type: 'card', tag: 'div', style: { borderRadius: '16px', overflow: 'hidden', backgroundColor: '#1e293b' }, meta: { name: 'Project 3' }, children: [
                { id: 'pimg3', type: 'image', tag: 'img', content: 'https://placehold.co/600x400/8b5cf6/ffffff?text=Project+3', style: { width: '100%', height: '280px', objectFit: 'cover' }, meta: { alt: 'Mobile Banking App project screenshot' } },
                { id: 'pc3info', type: 'container', tag: 'div', style: { padding: '24px' }, children: [
                  { id: 'pc3t', type: 'heading', tag: 'h3', content: 'Mobile Banking App', style: { fontSize: '18px', fontWeight: '600', color: '#ffffff', marginBottom: '8px' } },
                  { id: 'pc3d', type: 'text', tag: 'p', content: 'Mobile Design • iOS/Android', style: { fontSize: '14px', color: '#94a3b8' } }
                ]}
              ]},
              { id: 'pc4', type: 'card', tag: 'div', style: { borderRadius: '16px', overflow: 'hidden', backgroundColor: '#1e293b' }, meta: { name: 'Project 4' }, children: [
                { id: 'pimg4', type: 'image', tag: 'img', content: 'https://placehold.co/600x400/f59e0b/ffffff?text=Project+4', style: { width: '100%', height: '280px', objectFit: 'cover' }, meta: { alt: 'Brand Identity System project screenshot' } },
                { id: 'pc4info', type: 'container', tag: 'div', style: { padding: '24px' }, children: [
                  { id: 'pc4t', type: 'heading', tag: 'h3', content: 'Brand Identity System', style: { fontSize: '18px', fontWeight: '600', color: '#ffffff', marginBottom: '8px' } },
                  { id: 'pc4d', type: 'text', tag: 'p', content: 'Branding • Visual Identity', style: { fontSize: '14px', color: '#94a3b8' } }
                ]}
              ]}
            ]}
          ]},
          { id: 'footer-1', type: 'footer', tag: 'footer', style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '32px 48px', borderTop: '1px solid #1e293b' }, meta: { name: 'Footer', ariaLabel: 'Site footer', role: 'contentinfo' }, children: [
            { id: 'ft1', type: 'text', tag: 'p', content: '© 2026 Portfolio. All rights reserved.', style: { color: '#64748b', fontSize: '14px' } },
            { id: 'flinks', type: 'flex', tag: 'div', style: { display: 'flex', gap: '24px' }, children: [
              { id: 'fl1', type: 'link', tag: 'a', content: 'Twitter', style: { color: '#94a3b8', textDecoration: 'none', fontSize: '14px' } },
              { id: 'fl2', type: 'link', tag: 'a', content: 'LinkedIn', style: { color: '#94a3b8', textDecoration: 'none', fontSize: '14px' } },
              { id: 'fl3', type: 'link', tag: 'a', content: 'GitHub', style: { color: '#94a3b8', textDecoration: 'none', fontSize: '14px' } }
            ]}
          ]}
        ]
      }
    });
  }

  // Mobile app onboarding flow
  if (msg.includes('mobile') || msg.includes('app') || msg.includes('onboarding') || msg.includes('ios') || msg.includes('android')) {
    return JSON.stringify({
      message: 'I created a mobile app onboarding flow with welcome screens and a sign-up interface. You can tell me to adjust the steps, colors, or content!',
      design: {
        id: 'root', type: 'root', tag: 'div',
        style: { display: 'flex', justifyContent: 'center', minHeight: '100vh', width: '100%', fontFamily: 'Inter, system-ui, sans-serif', backgroundColor: '#f0f0f0' },
        meta: { name: 'Mobile App Onboarding' },
        children: [
          { id: 'phone-frame', type: 'container', tag: 'div', style: { width: '375px', minHeight: '812px', backgroundColor: '#ffffff', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px rgba(0,0,0,0.15)', borderRadius: '40px', overflow: 'hidden' }, children: [
            { id: 'status-bar', type: 'container', tag: 'div', style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 24px', backgroundColor: '#ffffff' }, children: [
              { id: 'time', type: 'text', tag: 'span', content: '9:41', style: { fontSize: '14px', fontWeight: '600', color: '#0f172a' } },
              { id: 'icons', type: 'text', tag: 'span', content: '📶 🔋', style: { fontSize: '14px' } }
            ]},
            { id: 'onboard-content', type: 'container', tag: 'div', style: { flex: '1', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 32px', textAlign: 'center' }, children: [
              { id: 'ob-illustration', type: 'image', tag: 'img', content: 'https://placehold.co/280x280/10b981/ffffff?text=🎯', style: { width: '280px', height: '280px', marginBottom: '40px', borderRadius: '20px' }, meta: { alt: 'Goal achievement illustration' } },
              { id: 'ob-title', type: 'heading', tag: 'h2', content: 'Achieve Your Goals', style: { fontSize: '28px', fontWeight: '700', color: '#0f172a', marginBottom: '16px' } },
              { id: 'ob-desc', type: 'text', tag: 'p', content: 'Track your progress, set reminders, and stay motivated with personalized insights.', style: { fontSize: '16px', color: '#475569', lineHeight: '1.6', marginBottom: '48px' } },
              { id: 'ob-dots', type: 'flex', tag: 'div', style: { display: 'flex', gap: '8px', marginBottom: '32px' }, children: [
                { id: 'dot1', type: 'container', tag: 'div', style: { width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#d1d5db' } },
                { id: 'dot2', type: 'container', tag: 'div', style: { width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#d1d5db' } },
                { id: 'dot3', type: 'container', tag: 'div', style: { width: '24px', height: '8px', borderRadius: '4px', backgroundColor: '#10b981' } }
              ]}
            ]},
            { id: 'ob-actions', type: 'container', tag: 'div', style: { padding: '24px 32px 48px' }, children: [
              { id: 'ob-btn', type: 'button', tag: 'button', content: 'Get Started', style: { width: '100%', padding: '16px', backgroundColor: '#10b981', color: '#ffffff', borderRadius: '14px', fontSize: '16px', fontWeight: '600', border: 'none', cursor: 'pointer', marginBottom: '16px' } },
              { id: 'ob-skip', type: 'button', tag: 'button', content: 'Already have an account? Sign In', style: { width: '100%', padding: '12px', backgroundColor: 'transparent', color: '#475569', borderRadius: '14px', fontSize: '14px', fontWeight: '500', border: 'none', cursor: 'pointer' } }
            ]}
          ]}
        ]
      }
    });
  }

  // Pitch deck / slide deck
  if (msg.includes('pitch') || msg.includes('deck') || msg.includes('slide') || msg.includes('presentation')) {
    return JSON.stringify({
      message: 'I created a pitch deck with title, problem, solution, and market slides. Tell me to add more slides or adjust the content!',
      design: {
        id: 'root', type: 'root', tag: 'div',
        style: { display: 'flex', flexDirection: 'column', minHeight: '100vh', width: '100%', fontFamily: 'Inter, system-ui, sans-serif', backgroundColor: '#0f172a' },
        meta: { name: 'Pitch Deck' },
        children: [
          { id: 'slide-title', type: 'section', tag: 'section', style: { display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', padding: '80px', textAlign: 'center' }, meta: { name: 'Title Slide', ariaLabel: 'Title slide' }, children: [
            { id: 'st-badge', type: 'badge', tag: 'span', content: 'Seed Round 2026', style: { padding: '8px 20px', backgroundColor: '#064e3b', color: '#34d399', borderRadius: '24px', fontSize: '14px', fontWeight: '500', marginBottom: '40px' } },
            { id: 'st-h1', type: 'heading', tag: 'h1', content: 'Revolutionizing Design with AI', style: { fontSize: '64px', fontWeight: '800', color: '#ffffff', letterSpacing: '-0.03em', lineHeight: '1.1', marginBottom: '32px', maxWidth: '900px' } },
            { id: 'st-sub', type: 'text', tag: 'p', content: 'Z.Design — The future of visual design is conversational', style: { fontSize: '20px', color: '#94a3b8', lineHeight: '1.5' } }
          ]},
          { id: 'slide-problem', type: 'section', tag: 'section', style: { display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: '100vh', padding: '80px', backgroundColor: '#1e293b' }, meta: { name: 'Problem', ariaLabel: 'Problem statement' }, children: [
            { id: 'sp-label', type: 'text', tag: 'p', content: 'THE PROBLEM', style: { fontSize: '14px', fontWeight: '600', color: '#34d399', letterSpacing: '0.1em', marginBottom: '24px' } },
            { id: 'sp-h2', type: 'heading', tag: 'h2', content: 'Design tools are too complex and slow', style: { fontSize: '48px', fontWeight: '700', color: '#ffffff', maxWidth: '800px', lineHeight: '1.2', marginBottom: '40px' } },
            { id: 'sp-stats', type: 'grid', tag: 'div', style: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '32px', maxWidth: '800px' }, children: [
              { id: 'sps1', type: 'container', tag: 'div', children: [
                { id: 'sps1n', type: 'heading', tag: 'h3', content: '72%', style: { fontSize: '48px', fontWeight: '700', color: '#10b981' } },
                { id: 'sps1d', type: 'text', tag: 'p', content: 'of designers spend more time on tools than designing', style: { fontSize: '16px', color: '#94a3b8', lineHeight: '1.5' } }
              ]},
              { id: 'sps2', type: 'container', tag: 'div', children: [
                { id: 'sps2n', type: 'heading', tag: 'h3', content: '3.2h', style: { fontSize: '48px', fontWeight: '700', color: '#10b981' } },
                { id: 'sps2d', type: 'text', tag: 'p', content: 'average time to create a single landing page', style: { fontSize: '16px', color: '#94a3b8', lineHeight: '1.5' } }
              ]},
              { id: 'sps3', type: 'container', tag: 'div', children: [
                { id: 'sps3n', type: 'heading', tag: 'h3', content: '$50K+', style: { fontSize: '48px', fontWeight: '700', color: '#10b981' } },
                { id: 'sps3d', type: 'text', tag: 'p', content: 'annual cost for a full design team per project', style: { fontSize: '16px', color: '#94a3b8', lineHeight: '1.5' } }
              ]}
            ]}
          ]},
          { id: 'slide-solution', type: 'section', tag: 'section', style: { display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: '100vh', padding: '80px' }, meta: { name: 'Solution', ariaLabel: 'Solution overview' }, children: [
            { id: 'ss-label', type: 'text', tag: 'p', content: 'OUR SOLUTION', style: { fontSize: '14px', fontWeight: '600', color: '#34d399', letterSpacing: '0.1em', marginBottom: '24px' } },
            { id: 'ss-h2', type: 'heading', tag: 'h2', content: 'Just describe it. AI builds it.', style: { fontSize: '48px', fontWeight: '700', color: '#ffffff', maxWidth: '700px', lineHeight: '1.2', marginBottom: '40px' } },
            { id: 'ss-feats', type: 'grid', tag: 'div', style: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '20px', maxWidth: '700px' }, children: [
              { id: 'ssf1', type: 'card', tag: 'div', style: { padding: '24px', borderRadius: '12px', backgroundColor: '#1e293b', border: '1px solid #334155' }, children: [
                { id: 'ssf1i', type: 'text', tag: 'div', content: '💬', style: { fontSize: '28px', marginBottom: '12px' } },
                { id: 'ssf1t', type: 'heading', tag: 'h4', content: 'Natural Language', style: { fontSize: '16px', fontWeight: '600', color: '#ffffff', marginBottom: '8px' } },
                { id: 'ssf1d', type: 'text', tag: 'p', content: 'Describe your vision in plain English', style: { fontSize: '14px', color: '#94a3b8' } }
              ]},
              { id: 'ssf2', type: 'card', tag: 'div', style: { padding: '24px', borderRadius: '12px', backgroundColor: '#1e293b', border: '1px solid #334155' }, children: [
                { id: 'ssf2i', type: 'text', tag: 'div', content: '⚡', style: { fontSize: '28px', marginBottom: '12px' } },
                { id: 'ssf2t', type: 'heading', tag: 'h4', content: 'Instant Results', style: { fontSize: '16px', fontWeight: '600', color: '#ffffff', marginBottom: '8px' } },
                { id: 'ssf2d', type: 'text', tag: 'p', content: 'Production-ready designs in seconds', style: { fontSize: '14px', color: '#94a3b8' } }
              ]},
              { id: 'ssf3', type: 'card', tag: 'div', style: { padding: '24px', borderRadius: '12px', backgroundColor: '#1e293b', border: '1px solid #334155' }, children: [
                { id: 'ssf3i', type: 'text', tag: 'div', content: '🔄', style: { fontSize: '28px', marginBottom: '12px' } },
                { id: 'ssf3t', type: 'heading', tag: 'h4', content: 'Iterate Fast', style: { fontSize: '16px', fontWeight: '600', color: '#ffffff', marginBottom: '8px' } },
                { id: 'ssf3d', type: 'text', tag: 'p', content: 'Refine with conversational feedback', style: { fontSize: '14px', color: '#94a3b8' } }
              ]},
              { id: 'ssf4', type: 'card', tag: 'div', style: { padding: '24px', borderRadius: '12px', backgroundColor: '#1e293b', border: '1px solid #334155' }, children: [
                { id: 'ssf4i', type: 'text', tag: 'div', content: '📦', style: { fontSize: '28px', marginBottom: '12px' } },
                { id: 'ssf4t', type: 'heading', tag: 'h4', content: 'Export Anywhere', style: { fontSize: '16px', fontWeight: '600', color: '#ffffff', marginBottom: '8px' } },
                { id: 'ssf4d', type: 'text', tag: 'p', content: 'React, Vue, HTML, or Figma', style: { fontSize: '14px', color: '#94a3b8' } }
              ]}
            ]}
          ]}
        ]
      }
    });
  }

  // Pricing page
  if (msg.includes('pricing') || msg.includes('plan') || msg.includes('subscription') || msg.includes('tier')) {
    return JSON.stringify({
      message: 'I created a pricing page with three plan tiers and a comparison section. Tell me to adjust the prices, features, or add a FAQ section!',
      design: {
        id: 'root', type: 'root', tag: 'div',
        style: { display: 'flex', flexDirection: 'column', minHeight: '100vh', width: '100%', fontFamily: 'Inter, system-ui, sans-serif', backgroundColor: '#ffffff' },
        meta: { name: 'Pricing Page' },
        children: [
          { id: 'nav-1', type: 'nav', tag: 'nav', style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 48px', backgroundColor: '#ffffff', borderBottom: '1px solid #e2e8f0' }, meta: { name: 'Navigation', ariaLabel: 'Main navigation', role: 'navigation' }, children: [
            { id: 'logo', type: 'text', tag: 'span', content: 'BrandName', style: { fontSize: '20px', fontWeight: '700', color: '#10b981' } },
            { id: 'nav-r', type: 'flex', tag: 'div', style: { display: 'flex', gap: '24px', alignItems: 'center' }, children: [
              { id: 'nl1', type: 'link', tag: 'a', content: 'Features', style: { fontSize: '14px', color: '#475569', textDecoration: 'none', fontWeight: '500' } },
              { id: 'nl2', type: 'link', tag: 'a', content: 'Pricing', style: { fontSize: '14px', color: '#10b981', textDecoration: 'none', fontWeight: '600' } },
              { id: 'nl3', type: 'link', tag: 'a', content: 'Docs', style: { fontSize: '14px', color: '#475569', textDecoration: 'none', fontWeight: '500' } }
            ]}
          ]},
          { id: 'pricing-hero', type: 'section', tag: 'section', style: { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '80px 32px 48px', textAlign: 'center' }, meta: { name: 'Pricing Header', ariaLabel: 'Pricing plans' }, children: [
            { id: 'ph1', type: 'heading', tag: 'h1', content: 'Simple, transparent pricing', style: { fontSize: '48px', fontWeight: '800', color: '#0f172a', marginBottom: '16px', letterSpacing: '-0.02em' } },
            { id: 'pp1', type: 'text', tag: 'p', content: 'Choose the plan that works best for you and your team. No hidden fees.', style: { fontSize: '18px', color: '#475569', maxWidth: '500px', lineHeight: '1.7' } }
          ]},
          { id: 'pricing-grid', type: 'grid', tag: 'div', style: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px', maxWidth: '1020px', width: '100%', margin: '0 auto', padding: '32px' }, children: [
            { id: 'plan-free', type: 'card', tag: 'div', style: { padding: '36px', borderRadius: '16px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }, meta: { name: 'Free Plan' }, children: [
              { id: 'pf-name', type: 'text', tag: 'h3', content: 'Free', style: { fontSize: '20px', fontWeight: '600', color: '#0f172a', marginBottom: '8px' } },
              { id: 'pf-price', type: 'heading', tag: 'div', content: '$0', style: { fontSize: '48px', fontWeight: '800', color: '#0f172a', marginBottom: '4px' } },
              { id: 'pf-period', type: 'text', tag: 'span', content: 'forever', style: { fontSize: '14px', color: '#94a3b8', marginBottom: '24px', display: 'block' } },
              { id: 'pf-btn', type: 'button', tag: 'button', content: 'Get Started Free', style: { width: '100%', padding: '12px', backgroundColor: '#ffffff', color: '#0f172a', borderRadius: '10px', fontSize: '14px', fontWeight: '600', border: '1px solid #e2e8f0', cursor: 'pointer', marginBottom: '24px' } },
              { id: 'pf-feats', type: 'container', tag: 'div', style: { display: 'flex', flexDirection: 'column', gap: '12px' }, children: [
                { id: 'pf-f1', type: 'text', tag: 'div', content: '✓ 3 projects', style: { fontSize: '14px', color: '#475569' } },
                { id: 'pf-f2', type: 'text', tag: 'div', content: '✓ Basic templates', style: { fontSize: '14px', color: '#475569' } },
                { id: 'pf-f3', type: 'text', tag: 'div', content: '✓ Community support', style: { fontSize: '14px', color: '#475569' } },
                { id: 'pf-f4', type: 'text', tag: 'div', content: '✗ Export to code', style: { fontSize: '14px', color: '#cbd5e1' } }
              ]}
            ]},
            { id: 'plan-pro', type: 'card', tag: 'div', style: { padding: '36px', borderRadius: '16px', backgroundColor: '#0f172a', border: '2px solid #10b981', position: 'relative' }, meta: { name: 'Pro Plan' }, children: [
              { id: 'pp-badge', type: 'badge', tag: 'span', content: 'Most Popular', style: { position: 'absolute', top: '-12px', left: '50%', transform: 'translateX(-50%)', padding: '4px 16px', backgroundColor: '#10b981', color: '#ffffff', borderRadius: '20px', fontSize: '12px', fontWeight: '600' } },
              { id: 'pp-name', type: 'text', tag: 'h3', content: 'Pro', style: { fontSize: '20px', fontWeight: '600', color: '#ffffff', marginBottom: '8px' } },
              { id: 'pp-price', type: 'heading', tag: 'div', content: '$19', style: { fontSize: '48px', fontWeight: '800', color: '#ffffff', marginBottom: '4px' } },
              { id: 'pp-period', type: 'text', tag: 'span', content: 'per month', style: { fontSize: '14px', color: '#94a3b8', marginBottom: '24px', display: 'block' } },
              { id: 'pp-btn', type: 'button', tag: 'button', content: 'Start Free Trial', style: { width: '100%', padding: '12px', backgroundColor: '#10b981', color: '#ffffff', borderRadius: '10px', fontSize: '14px', fontWeight: '600', border: 'none', cursor: 'pointer', marginBottom: '24px' } },
              { id: 'pp-feats', type: 'container', tag: 'div', style: { display: 'flex', flexDirection: 'column', gap: '12px' }, children: [
                { id: 'pp-f1', type: 'text', tag: 'div', content: '✓ Unlimited projects', style: { fontSize: '14px', color: '#e2e8f0' } },
                { id: 'pp-f2', type: 'text', tag: 'div', content: '✓ All templates', style: { fontSize: '14px', color: '#e2e8f0' } },
                { id: 'pp-f3', type: 'text', tag: 'div', content: '✓ Priority support', style: { fontSize: '14px', color: '#e2e8f0' } },
                { id: 'pp-f4', type: 'text', tag: 'div', content: '✓ Export to code', style: { fontSize: '14px', color: '#e2e8f0' } }
              ]}
            ]},
            { id: 'plan-team', type: 'card', tag: 'div', style: { padding: '36px', borderRadius: '16px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }, meta: { name: 'Team Plan' }, children: [
              { id: 'pt-name', type: 'text', tag: 'h3', content: 'Team', style: { fontSize: '20px', fontWeight: '600', color: '#0f172a', marginBottom: '8px' } },
              { id: 'pt-price', type: 'heading', tag: 'div', content: '$49', style: { fontSize: '48px', fontWeight: '800', color: '#0f172a', marginBottom: '4px' } },
              { id: 'pt-period', type: 'text', tag: 'span', content: 'per month', style: { fontSize: '14px', color: '#94a3b8', marginBottom: '24px', display: 'block' } },
              { id: 'pt-btn', type: 'button', tag: 'button', content: 'Contact Sales', style: { width: '100%', padding: '12px', backgroundColor: '#ffffff', color: '#0f172a', borderRadius: '10px', fontSize: '14px', fontWeight: '600', border: '1px solid #e2e8f0', cursor: 'pointer', marginBottom: '24px' } },
              { id: 'pt-feats', type: 'container', tag: 'div', style: { display: 'flex', flexDirection: 'column', gap: '12px' }, children: [
                { id: 'pt-f1', type: 'text', tag: 'div', content: '✓ Everything in Pro', style: { fontSize: '14px', color: '#475569' } },
                { id: 'pt-f2', type: 'text', tag: 'div', content: '✓ Team collaboration', style: { fontSize: '14px', color: '#475569' } },
                { id: 'pt-f3', type: 'text', tag: 'div', content: '✓ Custom branding', style: { fontSize: '14px', color: '#475569' } },
                { id: 'pt-f4', type: 'text', tag: 'div', content: '✓ SSO & audit logs', style: { fontSize: '14px', color: '#475569' } }
              ]}
            ]}
          ]},
          { id: 'pricing-faq', type: 'section', tag: 'section', style: { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '80px 32px', backgroundColor: '#f8fafc' }, meta: { name: 'FAQ', ariaLabel: 'Frequently asked questions' }, children: [
            { id: 'faq-h2', type: 'heading', tag: 'h2', content: 'Frequently Asked Questions', style: { fontSize: '32px', fontWeight: '700', color: '#0f172a', marginBottom: '48px' } },
            { id: 'faq-list', type: 'container', tag: 'div', style: { maxWidth: '700px', width: '100%', display: 'flex', flexDirection: 'column', gap: '16px' }, children: [
              { id: 'faq1', type: 'card', tag: 'div', style: { padding: '20px 24px', borderRadius: '12px', backgroundColor: '#ffffff', border: '1px solid #e2e8f0' }, children: [
                { id: 'faq1q', type: 'text', tag: 'h4', content: 'Can I change plans later?', style: { fontSize: '16px', fontWeight: '600', color: '#0f172a', marginBottom: '8px' } },
                { id: 'faq1a', type: 'text', tag: 'p', content: 'Yes, you can upgrade or downgrade your plan at any time. Changes take effect at the next billing cycle.', style: { fontSize: '14px', color: '#475569', lineHeight: '1.6' } }
              ]},
              { id: 'faq2', type: 'card', tag: 'div', style: { padding: '20px 24px', borderRadius: '12px', backgroundColor: '#ffffff', border: '1px solid #e2e8f0' }, children: [
                { id: 'faq2q', type: 'text', tag: 'h4', content: 'Is there a free trial?', style: { fontSize: '16px', fontWeight: '600', color: '#0f172a', marginBottom: '8px' } },
                { id: 'faq2a', type: 'text', tag: 'p', content: 'Yes! All paid plans include a 14-day free trial. No credit card required to start.', style: { fontSize: '14px', color: '#475569', lineHeight: '1.6' } }
              ]},
              { id: 'faq3', type: 'card', tag: 'div', style: { padding: '20px 24px', borderRadius: '12px', backgroundColor: '#ffffff', border: '1px solid #e2e8f0' }, children: [
                { id: 'faq3q', type: 'text', tag: 'h4', content: 'What payment methods do you accept?', style: { fontSize: '16px', fontWeight: '600', color: '#0f172a', marginBottom: '8px' } },
                { id: 'faq3a', type: 'text', tag: 'p', content: 'We accept all major credit cards, PayPal, and wire transfer for annual plans.', style: { fontSize: '14px', color: '#475569', lineHeight: '1.6' } }
              ]}
            ]}
          ]},
          { id: 'footer-1', type: 'footer', tag: 'footer', style: { display: 'flex', justifyContent: 'center', padding: '32px', backgroundColor: '#ffffff', borderTop: '1px solid #e2e8f0' }, meta: { name: 'Footer', ariaLabel: 'Site footer', role: 'contentinfo' }, children: [
            { id: 'ft1', type: 'text', tag: 'p', content: '© 2026 BrandName. All rights reserved.', style: { color: '#94a3b8', fontSize: '14px' } }
          ]}
        ]
      }
    });
  }

  // Default design for any other request
  return JSON.stringify({
    message: 'I created a design based on your request. Tell me what to change — for example: "Make it darker", "Add a contact form", or "Change the layout"!',
    design: {
      id: 'root', type: 'root', tag: 'div',
      style: { display: 'flex', flexDirection: 'column', minHeight: '100vh', width: '100%', fontFamily: 'Inter, system-ui, sans-serif', backgroundColor: '#ffffff' },
      meta: { name: 'Custom Design' },
      children: [
        { id: 'nav-1', type: 'nav', tag: 'nav', style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 32px', borderBottom: '1px solid #e2e8f0', backgroundColor: '#ffffff' }, meta: { name: 'Navigation', ariaLabel: 'Main navigation', role: 'navigation' }, children: [
          { id: 'hl1', type: 'text', tag: 'span', content: 'Z.Design', style: { fontSize: '20px', fontWeight: '700', color: '#10b981' } },
          { id: 'nav-r', type: 'flex', tag: 'div', style: { display: 'flex', gap: '20px', alignItems: 'center' }, children: [
            { id: 'nl1', type: 'link', tag: 'a', content: 'Home', style: { fontSize: '14px', color: '#475569', textDecoration: 'none', fontWeight: '500' } },
            { id: 'nl2', type: 'link', tag: 'a', content: 'About', style: { fontSize: '14px', color: '#475569', textDecoration: 'none', fontWeight: '500' } },
            { id: 'nl3', type: 'link', tag: 'a', content: 'Contact', style: { fontSize: '14px', color: '#475569', textDecoration: 'none', fontWeight: '500' } },
            { id: 'hb1', type: 'button', tag: 'button', content: 'Get Started', style: { padding: '8px 20px', backgroundColor: '#10b981', color: '#ffffff', borderRadius: '8px', fontSize: '14px', fontWeight: '600', border: 'none', cursor: 'pointer' } }
          ]}
        ]},
        { id: 'hero-1', type: 'section', tag: 'section', style: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: '1', padding: '100px 32px', textAlign: 'center', background: 'linear-gradient(180deg, #f8fafc 0%, #ffffff 100%)' }, meta: { name: 'Hero', ariaLabel: 'Hero section' }, children: [
          { id: 'hb1', type: 'badge', tag: 'span', content: '✨ AI-Powered', style: { padding: '6px 16px', backgroundColor: '#d1fae5', color: '#065f46', borderRadius: '20px', fontSize: '13px', fontWeight: '500', marginBottom: '24px', display: 'inline-block' } },
          { id: 'sh1', type: 'heading', tag: 'h1', content: 'Your Design Starts Here', style: { fontSize: '48px', fontWeight: '800', color: '#0f172a', marginBottom: '20px', letterSpacing: '-0.02em' } },
          { id: 'sp1', type: 'text', tag: 'p', content: 'Tell me more about what you want and I\'ll create a custom design for you. Try things like "Make a portfolio" or "Add a pricing section"!', style: { fontSize: '18px', color: '#475569', maxWidth: '540px', lineHeight: '1.7', marginBottom: '32px' } },
          { id: 'sbtns', type: 'flex', tag: 'div', style: { display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }, children: [
            { id: 'sb1', type: 'button', tag: 'button', content: 'Start Creating', style: { padding: '14px 32px', backgroundColor: '#10b981', color: '#ffffff', borderRadius: '10px', fontSize: '16px', fontWeight: '600', border: 'none', cursor: 'pointer', boxShadow: '0 4px 12px rgba(16,185,129,0.3)' } },
            { id: 'sb2', type: 'button', tag: 'button', content: 'See Examples', style: { padding: '14px 32px', backgroundColor: '#ffffff', color: '#475569', borderRadius: '10px', fontSize: '16px', fontWeight: '500', border: '1px solid #e2e8f0', cursor: 'pointer' } }
          ]}
        ]},
        { id: 'ftr1', type: 'footer', tag: 'footer', style: { display: 'flex', justifyContent: 'center', padding: '32px', backgroundColor: '#f8fafc', borderTop: '1px solid #e2e8f0' }, meta: { name: 'Footer', ariaLabel: 'Site footer', role: 'contentinfo' }, children: [
          { id: 'ft1', type: 'text', tag: 'p', content: '© 2026 Z.Design — AI-Powered Visual Design Platform', style: { color: '#94a3b8', fontSize: '14px' } }
        ]}
      ]
    }
  });
}

// ============ Smart Contextual Fallback ============
// Used when LLM returns a response but JSON parsing AND repairLLMJson both fail.
// Generates a HIGH-QUALITY, topic-aware design based on the user's intent AND the LLM's description.

interface TopicTemplate {
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

const TOPIC_TEMPLATES: TopicTemplate[] = [
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
    primaryDark: '#4f46e5',
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

function generateContextualFallback(userMessage: string, llmMessage: string, creativeMode?: boolean): string {
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

  // Generate the contextual fallback design
  return JSON.stringify({
    message: `I created a ${t.brandName}-style design based on your request! You can customize it by telling me what to change.`,
    design: {
      id: 'root', type: 'root', tag: 'div',
      style: { display: 'flex', flexDirection: 'column', minHeight: '100vh', width: '100%', fontFamily: 'Inter, system-ui, sans-serif', backgroundColor: '#ffffff' },
      meta: { name: `${t.brandName} Design` },
      children: [
        // Navigation
        { id: 'nav-1', type: 'nav', tag: 'nav', style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 32px', backgroundColor: '#ffffff', borderBottom: '1px solid #e2e8f0', position: 'sticky', top: '0', zIndex: '50' }, meta: { name: 'Navigation', ariaLabel: 'Main navigation', role: 'navigation' }, children: [
          { id: 'logo-1', type: 'text', tag: 'span', content: t.brandName, style: { fontSize: '22px', fontWeight: '700', color: t.primaryColor } },
          { id: 'nav-links', type: 'flex', tag: 'div', style: { display: 'flex', gap: '24px', alignItems: 'center' }, children: [
            { id: 'nl1', type: 'link', tag: 'a', content: 'Features', style: { fontSize: '14px', color: '#475569', textDecoration: 'none', fontWeight: '500' } },
            { id: 'nl2', type: 'link', tag: 'a', content: 'Pricing', style: { fontSize: '14px', color: '#475569', textDecoration: 'none', fontWeight: '500' } },
            { id: 'nl3', type: 'link', tag: 'a', content: 'About', style: { fontSize: '14px', color: '#475569', textDecoration: 'none', fontWeight: '500' } },
            { id: 'nb1', type: 'button', tag: 'button', content: 'Get Started', style: { padding: '10px 24px', backgroundColor: t.primaryColor, color: '#ffffff', borderRadius: '8px', fontSize: '14px', fontWeight: '600', border: 'none', cursor: 'pointer', boxShadow: `0 2px 8px ${t.primaryColor}40` } }
          ]}
        ]},
        // Hero Section
        { id: 'hero-1', type: 'section', tag: 'section', style: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '100px 32px 80px', textAlign: 'center', backgroundColor: '#f8fafc', backgroundImage: `radial-gradient(circle at 30% 50%, ${t.primaryColor}14 0%, transparent 50%)` }, meta: { name: 'Hero', ariaLabel: 'Hero section' }, children: [
          { id: 'hb1', type: 'badge', tag: 'span', content: `${t.heroEmoji} Powered by AI`, style: { padding: '6px 16px', backgroundColor: t.accentLight, color: t.primaryDark, borderRadius: '20px', fontSize: '13px', fontWeight: '500', marginBottom: '24px', display: 'inline-block' } },
          { id: 'hh1', type: 'heading', tag: 'h1', content: creativeMode ? `Reimagine. ${t.heroEmoji} Create.` : t.heroTitle, style: { fontSize: '52px', fontWeight: '800', lineHeight: '1.1', color: '#0f172a', maxWidth: '720px', marginBottom: '20px', letterSpacing: '-0.02em' } },
          { id: 'hp1', type: 'text', tag: 'p', content: t.heroSubtitle, style: { fontSize: '18px', color: '#475569', maxWidth: '540px', lineHeight: '1.7', marginBottom: '36px' } },
          { id: 'hbtns', type: 'flex', tag: 'div', style: { display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }, children: [
            { id: 'hb2', type: 'button', tag: 'button', content: 'Get Started', style: { padding: '14px 32px', backgroundColor: t.primaryColor, color: '#ffffff', borderRadius: '10px', fontSize: '16px', fontWeight: '600', border: 'none', cursor: 'pointer', boxShadow: `0 4px 16px ${t.primaryColor}4D`, transition: 'all 0.2s ease' } },
            { id: 'hb3', type: 'button', tag: 'button', content: 'Learn More', style: { padding: '14px 32px', backgroundColor: '#ffffff', color: '#475569', borderRadius: '10px', fontSize: '16px', fontWeight: '500', border: '1px solid #e2e8f0', cursor: 'pointer', transition: 'all 0.2s ease' } }
          ]}
        ]},
        // Trusted By / Social Proof
        { id: 'logos-1', type: 'section', tag: 'section', style: { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '48px 32px', backgroundColor: '#ffffff', borderBottom: '1px solid #f1f5f9' }, meta: { name: 'Trusted By', ariaLabel: 'Trusted by section' }, children: [
          { id: 'lt1', type: 'text', tag: 'p', content: 'Trusted by teams at', style: { fontSize: '13px', color: '#94a3b8', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '24px' } },
          { id: 'lrow', type: 'flex', tag: 'div', style: { display: 'flex', gap: '48px', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap' }, children: [
            { id: 'lg1', type: 'text', tag: 'span', content: 'Acme Corp', style: { fontSize: '18px', fontWeight: '700', color: '#cbd5e1' } },
            { id: 'lg2', type: 'text', tag: 'span', content: 'TechFlow', style: { fontSize: '18px', fontWeight: '700', color: '#cbd5e1' } },
            { id: 'lg3', type: 'text', tag: 'span', content: 'Innovate', style: { fontSize: '18px', fontWeight: '700', color: '#cbd5e1' } },
            { id: 'lg4', type: 'text', tag: 'span', content: 'Quantum', style: { fontSize: '18px', fontWeight: '700', color: '#cbd5e1' } },
            { id: 'lg5', type: 'text', tag: 'span', content: 'Nebula', style: { fontSize: '18px', fontWeight: '700', color: '#cbd5e1' } }
          ]}
        ]},
        // Features Section
        { id: 'feat-1', type: 'section', tag: 'section', style: { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '96px 32px', backgroundColor: '#ffffff' }, meta: { name: 'Features', ariaLabel: 'Features section' }, children: [
          { id: 'flabel', type: 'badge', tag: 'span', content: 'FEATURES', style: { padding: '4px 12px', backgroundColor: t.accentLight, color: t.primaryDark, borderRadius: '16px', fontSize: '12px', fontWeight: '600', letterSpacing: '0.05em', marginBottom: '16px' } },
          { id: 'fh2', type: 'heading', tag: 'h2', content: 'Everything you need to succeed', style: { fontSize: '36px', fontWeight: '700', color: '#0f172a', marginBottom: '16px', letterSpacing: '-0.01em' } },
          { id: 'fsub', type: 'text', tag: 'p', content: `Powerful features designed to help you get the most out of ${t.brandName}.`, style: { fontSize: '18px', color: '#475569', maxWidth: '520px', textAlign: 'center', marginBottom: '56px', lineHeight: '1.6' } },
          { id: 'fgrid', type: 'grid', tag: 'div', style: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '28px', maxWidth: '1020px', width: '100%' }, children: t.features.map((f, i) => ({
            id: `fc${i + 1}`, type: 'card', tag: 'div', style: { padding: '32px', borderRadius: '16px', border: '1px solid #e2e8f0', backgroundColor: '#ffffff', transition: 'box-shadow 0.2s ease' }, meta: { name: `Feature Card ${i + 1}` }, children: [
              { id: `fi${i + 1}`, type: 'text', tag: 'div', content: f.icon, style: { fontSize: '32px', marginBottom: '16px' } },
              { id: `fh3${String.fromCharCode(97 + i)}`, type: 'heading', tag: 'h3', content: f.title, style: { fontSize: '18px', fontWeight: '600', color: '#0f172a', marginBottom: '8px' } },
              { id: `fp${i + 1}`, type: 'text', tag: 'p', content: f.desc, style: { fontSize: '14px', color: '#475569', lineHeight: '1.6' } }
            ]
          })) }
        ]},
        // Testimonial Section
        { id: 'testimonials-1', type: 'section', tag: 'section', style: { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '96px 32px', backgroundColor: '#f8fafc' }, meta: { name: 'Testimonials', ariaLabel: 'Testimonials section' }, children: [
          { id: 'th2', type: 'heading', tag: 'h2', content: 'What people are saying', style: { fontSize: '36px', fontWeight: '700', color: '#0f172a', marginBottom: '56px', letterSpacing: '-0.01em' } },
          { id: 'tgrid', type: 'grid', tag: 'div', style: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px', maxWidth: '1020px', width: '100%' }, children: [
            { id: 'tc1', type: 'card', tag: 'div', style: { padding: '28px', borderRadius: '16px', backgroundColor: '#ffffff', border: '1px solid #e2e8f0' }, children: [
              { id: 'tq1', type: 'text', tag: 'p', content: t.testimonial, style: { fontSize: '15px', color: '#0f172a', lineHeight: '1.6', marginBottom: '20px', fontStyle: 'italic' } },
              { id: 'ta1', type: 'flex', tag: 'div', style: { display: 'flex', alignItems: 'center', gap: '12px' }, children: [
                { id: 'tav1', type: 'avatar', tag: 'div', content: t.testimonialAuthor.split(' ').map((n: string) => n[0]).join(''), style: { width: '40px', height: '40px', borderRadius: '50%', backgroundColor: t.accentLight, color: t.primaryDark, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: '600' } },
                { id: 'tn1', type: 'text', tag: 'div', content: t.testimonialAuthor, style: { fontSize: '14px', fontWeight: '600', color: '#0f172a' } },
                { id: 'tr1', type: 'text', tag: 'span', content: t.testimonialRole, style: { fontSize: '13px', color: '#94a3b8' } }
              ]}
            ]},
            { id: 'tc2', type: 'card', tag: 'div', style: { padding: '28px', borderRadius: '16px', backgroundColor: '#ffffff', border: '1px solid #e2e8f0' }, children: [
              { id: 'tq2', type: 'text', tag: 'p', content: `"The interface is incredibly intuitive. I was up and running in under 5 minutes. Highly recommended for anyone serious about their craft."`, style: { fontSize: '15px', color: '#0f172a', lineHeight: '1.6', marginBottom: '20px', fontStyle: 'italic' } },
              { id: 'ta2', type: 'flex', tag: 'div', style: { display: 'flex', alignItems: 'center', gap: '12px' }, children: [
                { id: 'tav2', type: 'avatar', tag: 'div', content: 'MR', style: { width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#dbeafe', color: '#1e40af', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: '600' } },
                { id: 'tn2', type: 'text', tag: 'div', content: 'Marcus Rivera', style: { fontSize: '14px', fontWeight: '600', color: '#0f172a' } },
                { id: 'tr2', type: 'text', tag: 'span', content: 'Product Lead, TechFlow', style: { fontSize: '13px', color: '#94a3b8' } }
              ]}
            ]},
            { id: 'tc3', type: 'card', tag: 'div', style: { padding: '28px', borderRadius: '16px', backgroundColor: '#ffffff', border: '1px solid #e2e8f0' }, children: [
              { id: 'tq3', type: 'text', tag: 'p', content: `"We've tried many platforms but this one stands out. The attention to detail and user experience is second to none."`, style: { fontSize: '15px', color: '#0f172a', lineHeight: '1.6', marginBottom: '20px', fontStyle: 'italic' } },
              { id: 'ta3', type: 'flex', tag: 'div', style: { display: 'flex', alignItems: 'center', gap: '12px' }, children: [
                { id: 'tav3', type: 'avatar', tag: 'div', content: 'JL', style: { width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#fce7f3', color: '#9d174d', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: '600' } },
                { id: 'tn3', type: 'text', tag: 'div', content: 'Julia Lee', style: { fontSize: '14px', fontWeight: '600', color: '#0f172a' } },
                { id: 'tr3', type: 'text', tag: 'span', content: 'CTO, Innovate', style: { fontSize: '13px', color: '#94a3b8' } }
              ]}
            ]}
          ]}
        ]},
        // CTA Section
        { id: 'cta-1', type: 'section', tag: 'section', style: { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '96px 32px', background: `linear-gradient(135deg, ${t.primaryDark} 0%, ${t.primaryColor} 50%, ${t.primaryColor}99 100%)` }, meta: { name: 'Call to Action', ariaLabel: 'Call to action section' }, children: [
          { id: 'ch2', type: 'heading', tag: 'h2', content: t.ctaTitle, style: { fontSize: '40px', fontWeight: '700', color: '#ffffff', marginBottom: '16px', letterSpacing: '-0.01em' } },
          { id: 'cp1', type: 'text', tag: 'p', content: t.ctaSubtitle, style: { fontSize: '18px', color: `${t.accentLight}`, maxWidth: '500px', textAlign: 'center', marginBottom: '32px', lineHeight: '1.6' } },
          { id: 'cbtns', type: 'flex', tag: 'div', style: { display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }, children: [
            { id: 'cb1', type: 'button', tag: 'button', content: 'Get Started Free', style: { padding: '14px 32px', backgroundColor: '#ffffff', color: t.primaryDark, borderRadius: '10px', fontSize: '16px', fontWeight: '600', border: 'none', cursor: 'pointer', boxShadow: '0 4px 16px rgba(0,0,0,0.15)' } },
            { id: 'cb2', type: 'button', tag: 'button', content: 'Schedule Demo', style: { padding: '14px 32px', backgroundColor: 'transparent', color: '#ffffff', borderRadius: '10px', fontSize: '16px', fontWeight: '500', border: '2px solid rgba(255,255,255,0.4)', cursor: 'pointer' } }
          ]}
        ]},
        // Footer
        { id: 'footer-1', type: 'footer', tag: 'footer', style: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '64px 48px 32px', backgroundColor: '#0f172a' }, meta: { name: 'Footer', ariaLabel: 'Site footer', role: 'contentinfo' }, children: [
          { id: 'fcol1', type: 'container', tag: 'div', style: { display: 'flex', flexDirection: 'column', maxWidth: '280px' }, children: [
            { id: 'flogo', type: 'text', tag: 'span', content: t.brandName, style: { fontSize: '20px', fontWeight: '700', color: t.primaryColor, marginBottom: '16px' } },
            { id: 'fdesc', type: 'text', tag: 'p', content: t.footerDesc, style: { fontSize: '14px', color: '#94a3b8', lineHeight: '1.6', marginBottom: '20px' } }
          ]},
          { id: 'fcol2', type: 'container', tag: 'div', style: { display: 'flex', gap: '64px' }, children: [
            { id: 'flinks1', type: 'container', tag: 'div', style: { display: 'flex', flexDirection: 'column', gap: '12px' }, children: [
              { id: 'flt1', type: 'text', tag: 'span', content: 'Product', style: { fontSize: '14px', fontWeight: '600', color: '#ffffff', marginBottom: '4px' } },
              { id: 'fl1', type: 'link', tag: 'a', content: 'Features', style: { fontSize: '14px', color: '#94a3b8', textDecoration: 'none' } },
              { id: 'fl2', type: 'link', tag: 'a', content: 'Pricing', style: { fontSize: '14px', color: '#94a3b8', textDecoration: 'none' } },
              { id: 'fl3', type: 'link', tag: 'a', content: 'Changelog', style: { fontSize: '14px', color: '#94a3b8', textDecoration: 'none' } }
            ]},
            { id: 'flinks2', type: 'container', tag: 'div', style: { display: 'flex', flexDirection: 'column', gap: '12px' }, children: [
              { id: 'flt2', type: 'text', tag: 'span', content: 'Company', style: { fontSize: '14px', fontWeight: '600', color: '#ffffff', marginBottom: '4px' } },
              { id: 'fl4', type: 'link', tag: 'a', content: 'About', style: { fontSize: '14px', color: '#94a3b8', textDecoration: 'none' } },
              { id: 'fl5', type: 'link', tag: 'a', content: 'Blog', style: { fontSize: '14px', color: '#94a3b8', textDecoration: 'none' } },
              { id: 'fl6', type: 'link', tag: 'a', content: 'Careers', style: { fontSize: '14px', color: '#94a3b8', textDecoration: 'none' } }
            ]},
            { id: 'flinks3', type: 'container', tag: 'div', style: { display: 'flex', flexDirection: 'column', gap: '12px' }, children: [
              { id: 'flt3', type: 'text', tag: 'span', content: 'Legal', style: { fontSize: '14px', fontWeight: '600', color: '#ffffff', marginBottom: '4px' } },
              { id: 'fl7', type: 'link', tag: 'a', content: 'Privacy', style: { fontSize: '14px', color: '#94a3b8', textDecoration: 'none' } },
              { id: 'fl8', type: 'link', tag: 'a', content: 'Terms', style: { fontSize: '14px', color: '#94a3b8', textDecoration: 'none' } }
            ]}
          ]}
        ]},
        { id: 'footer-bottom', type: 'container', tag: 'div', style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 48px', backgroundColor: '#0f172a', borderTop: '1px solid #1e293b' }, children: [
          { id: 'fcopy', type: 'text', tag: 'p', content: `© 2026 ${t.brandName}. All rights reserved.`, style: { color: '#64748b', fontSize: '13px' } }
        ]}
      ]
    }
  });
}

// ============ POST Handler ============

export async function POST(request: NextRequest) {
  try {
    const body: ChatRequestBody = await request.json();
    const { message, projectId, designTree, designSystem, history, creativeMode } = body;

    if (!message || !projectId) {
      return NextResponse.json({ error: 'message and projectId are required' }, { status: 400 });
    }

    const project = await db.project.findUnique({ where: { id: projectId } });
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Store user message
    await db.chatMessage.create({
      data: { projectId, role: 'user', content: message },
    });

    // Build a concise system prompt for chat (full prompt is too large for this environment)
    const conciseSystemPrompt = `You are Z.Design AI, an expert visual design assistant. You generate designs as structured JSON.

CRITICAL JSON FORMAT RULES:
1. ALL property names MUST be in double quotes: "id", "type", "style", "content"
2. EVERY property name MUST have a colon after the closing quote: "id": "nav-1" (NOT "id": or "id=)
3. The "content" field MUST be INSIDE the node object, NOT after it
4. ALL style values MUST be quoted strings: "boxShadow": "0 4px 6px rgba(0,0,0,0.1)"
5. Use rgba without spaces in commas: "rgba(0,0,0,0.1)" NOT "rgba(0, 0, 0, 0.1)"
6. Return raw JSON only - no markdown code blocks

CORRECT EXAMPLE:
{"message": "Created a landing page", "design": {"id": "root", "type": "root", "tag": "div", "style": {"minHeight": "100vh", "fontFamily": "Inter, system-ui, sans-serif", "backgroundColor": "#ffffff"}, "children": [{"id": "nav-1", "type": "nav", "tag": "nav", "style": {"display": "flex", "justifyContent": "space-between", "padding": "16px 32px", "backgroundColor": "#ffffff", "borderBottom": "1px solid #e2e8f0"}, "children": [{"id": "logo", "type": "text", "tag": "span", "content": "BrandName", "style": {"fontSize": "20px", "fontWeight": "700", "color": "#10b981"}}, {"id": "nav-btn", "type": "button", "tag": "button", "content": "Get Started", "style": {"padding": "10px 24px", "backgroundColor": "#10b981", "color": "#ffffff", "borderRadius": "8px", "border": "none", "fontWeight": "600", "cursor": "pointer"}}]}, {"id": "hero", "type": "section", "tag": "section", "style": {"display": "flex", "flexDirection": "column", "alignItems": "center", "padding": "80px 32px", "textAlign": "center", "backgroundColor": "#f8fafc", "backgroundImage": "radial-gradient(circle at 30% 50%, rgba(16,185,129,0.08) 0%, transparent 50%)"}, "children": [{"id": "hero-h1", "type": "heading", "tag": "h1", "content": "Welcome to Our Platform", "style": {"fontSize": "clamp(32px, 5vw, 48px)", "fontWeight": "800", "color": "#0f172a", "marginBottom": "16px"}}, {"id": "hero-p", "type": "text", "tag": "p", "content": "Build amazing things with AI", "style": {"fontSize": "18px", "color": "#475569", "maxWidth": "540px", "lineHeight": "1.7"}}]}]}}

NOTICE HOW:
- "content": "BrandName" is INSIDE each node object
- Every property name has quotes AND a colon: "fontSize": "20px"
- CSS values are all quoted strings
- No spaces in rgba() values
- No trailing commas
- backgroundImage uses gradient for modern look
- fontSize uses clamp() for responsive typography

COLORS: Primary #10b981, PrimaryDark #059669, Secondary #8b5cf6, Accent #06b6d4, Text #0f172a, TextSecondary #475569, Muted #94a3b8, BG #ffffff, Surface #f8fafc, Border #e2e8f0
LAYOUT: Nav→Hero→Features→CTA→Footer (landing pages), Sidebar→Header→Stats→Charts (dashboards)

DESIGN PRINCIPLES: Modern, clean, generous whitespace, rounded corners (borderRadius 10-16px), responsive flexbox/grid layouts, proper heading hierarchy, complete sections with real content.

MODERN PATTERNS TO USE:
- Gradient backgrounds: "backgroundImage": "radial-gradient(circle at 30% 50%, rgba(16,185,129,0.08) 0%, transparent 50%)"
- Soft layered shadows: "boxShadow": "0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.06)"
- Glassmorphism nav: "backgroundColor": "rgba(255,255,255,0.8)", "backdropFilter": "blur(12px)"
- Gradient buttons: "background": "linear-gradient(135deg, #10b981, #06b6d4)"
- Responsive grids: "gridTemplateColumns": "repeat(auto-fit, minmax(280px, 1fr))"
- Fluid typography: "fontSize": "clamp(28px, 4vw, 48px)"
- maxWidth containers: "maxWidth": "1200px", "margin": "0 auto"

NEGATIVE CONSTRAINTS:
- NEVER use Tailwind shorthand - always use real CSS values: "32px" not "4xl"
- NEVER use fixed pixel widths on containers - use maxWidth + margin:"0 auto"
- NEVER use lorem ipsum - always use meaningful, contextual content
- NEVER leave style objects empty

RULES:
1. Every node needs unique "id" (e.g., "hero-section", "nav-logo")
2. Use semantic HTML tags (header, nav, main, section, footer)
3. Make designs COMPLETE and POLISHED
4. Images: use "https://placehold.co/WxH/10b981/ffffff?text=Label"
5. For landing pages: Nav → Hero → Features → CTA → Footer
6. For dashboards: Sidebar → Header → Stats → Charts
7. Double-check your JSON is valid before returning`;

    // Detect if this is a refinement request (user modifying an existing design)
    const isRefinementRequest = designTree && (designTree as { children?: unknown[] }).children?.length as number > 0;
    const refinementKeywords = ['change', 'make', 'update', 'modify', 'replace', 'remove', 'add', 'move', 'resize', 'recolor', 'recolor', 'turn', 'switch', 'swap', 'hide', 'show', 'align', 'center', 'bold', 'italic', 'color', 'font', 'size', 'width', 'height', 'padding', 'margin', 'background', 'border'];
    const isLikelyRefinement = isRefinementRequest && refinementKeywords.some(kw => message.toLowerCase().includes(kw));

    let systemPrompt: string;
    if (isLikelyRefinement) {
      // Use the refinement system prompt for targeted modifications
      systemPrompt = DESIGN_REFINEMENT_SYSTEM_PROMPT;
    } else {
      systemPrompt = conciseSystemPrompt;
    }

    // Inject design system context with proper enforcement instructions
    if (designSystem && Object.keys(designSystem).length > 0) {
      const dsName = (designSystem as Record<string, unknown>).name || 'Custom';
      systemPrompt += `\n\n=== DESIGN SYSTEM ENFORCEMENT ===\nYou MUST use the "${dsName}" design system provided below. Use ONLY its colors, fonts, and spacing tokens. Do NOT invent hex values or font families not in this system. If the user's request conflicts with the design system, follow the user but note the deviation.\n\nUSER'S DESIGN SYSTEM: ${JSON.stringify(designSystem)}`;
    }

    // Add Creative Mode to system prompt
    if (creativeMode) {
      systemPrompt += `\n\nCREATIVE MODE: Be bold and experimental! Try unique layouts, unconventional color combinations, creative typography, asymmetric layouts, and innovative design patterns. Push boundaries while maintaining usability. Generate at least 2-3 different section variations within the design. Consider bento grids, gradient meshes, glassmorphism, and neobrutalism.`;
    }

    // Build the user message content, adding context about existing design if present
    let userContent = message;
    if (isLikelyRefinement && designTree) {
      const childrenCount = (designTree as { children: unknown[] }).children.length;
      const sectionNames = (designTree as { children: Array<{ meta?: { name?: string }; id?: string }> }).children
        .map((c, i) => c.meta?.name || c.id || `section-${i}`)
        .join(', ');
      userContent = `[CURRENT DESIGN CONTEXT: ${childrenCount} top-level sections: ${sectionNames}]\n\nDesign tree: ${JSON.stringify(designTree).substring(0, 3000)}${JSON.stringify(designTree).length > 3000 ? '...[truncated]' : ''}\n\nUser request: ${message}\n\nReturn ONLY the modified subtree using the refinement format (action, targetId, node). Do NOT return the entire design tree.`;
    } else if (isRefinementRequest) {
      const childrenCount = (designTree as { children: unknown[] }).children.length;
      userContent = `[Current design exists with ${childrenCount} top-level sections. The user wants to modify it.]\n\nUser request: ${message}\n\nReturn the COMPLETE updated design tree (not just the changes).`;
    }

    // Build conversation messages from history (up to 4 most recent to save tokens)
    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: systemPrompt },
    ];

    if (history && history.length > 0) {
      const recentHistory = history.slice(-4);
      for (const msg of recentHistory) {
        messages.push({ role: msg.role, content: msg.content });
      }
    }

    messages.push({ role: 'user', content: userContent });

    // Call Z.ai LLM with timeout and retry logic
    let rawResponse: string | null = null;
    let tokensUsed = 0;
    let usedFallback = false;

    // Timeout strategy: LLM takes ~60-90s to generate a full design, so we need generous timeouts
    // First attempt gets 120s, subsequent attempts get 90s — the LLM is slow but reliable
    const LLM_TIMEOUT_FIRST = 120000; // 120s for first attempt (LLM takes ~74s on average)
    const LLM_TIMEOUT_RETRY = 90000; // 90s for retries
    const maxRetries = 2; // 2 retries (3 total attempts) — the LLM is slow but reliable

    // ALWAYS try the LLM first — it produces much better designs than fallbacks
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const zai = await getZAI();
        const timeoutMs = attempt === 0 ? LLM_TIMEOUT_FIRST : LLM_TIMEOUT_RETRY;

        // Race the LLM call against a timeout
        const completionPromise = zai.chat.completions.create({
          messages,
          thinking: { type: 'disabled' },
        });

        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('LLM timeout')), timeoutMs)
        );

        const completion = await Promise.race([completionPromise, timeoutPromise]);
        rawResponse = completion.choices[0]?.message?.content || null;
        tokensUsed = completion.usage?.total_tokens || 0;
        break; // Success, exit retry loop
      } catch (llmError) {
        console.warn(`[Chat API] Z.ai LLM attempt ${attempt + 1} failed:`, llmError instanceof Error ? llmError.message : llmError);
        if (attempt < maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, 500));
        } else {
          console.error('[Chat API] Z.ai LLM attempts failed, using fallback');
          usedFallback = true;
        }
      }
    }

    // Parse response: use LLM output or fallback
    let parsed: { message: string; design: unknown | null; parseFailed?: boolean };
    let templateUsed = false;

    if (rawResponse) {
      parsed = parseAIResponse(rawResponse);
      if (!parsed.design) {
        console.warn('[Chat API] LLM response parsed but no design extracted. Raw length:', rawResponse.length, 'First 200:', rawResponse.substring(0, 200));
        // Try repairLLMJson directly
        const repaired = repairLLMJson(rawResponse);
        if (repaired) {
          try {
            const repairedParsed = JSON.parse(repaired);
            if (repairedParsed && typeof repairedParsed === 'object') {
              const rp = repairedParsed as Record<string, unknown>;
              if (rp.design || rp.id || rp.type || rp.children) {
                parsed = {
                  message: (rp.message as string) || parsed.message,
                  design: rp.design || rp,
                };
                console.log('[Chat API] Design recovered via repairLLMJson!');
              }
            }
          } catch (repairError) {
            const errMsg = repairError instanceof Error ? repairError.message : String(repairError);
            const posMatch = errMsg.match(/position (\d+)/);
            const pos = posMatch ? parseInt(posMatch[1]) : 0;
            console.warn('[Chat API] repairLLMJson also failed:', errMsg.substring(0, 100));
            if (pos > 0) {
              console.warn('[Chat API] Error context (pos', pos, '):', repaired.substring(Math.max(0, pos - 80), pos + 80));
            }
          }
        } else {
          console.warn('[Chat API] repairLLMJson returned null - unable to repair');
        }

        // After repairLLMJson also fails, use smart contextual fallback
        if (!parsed.design && rawResponse) {
          // Extract the message from the LLM response to understand intent
          const messageMatch = rawResponse.match(/"message"\s*:\s*"([^"]+)"/);
          const llmMessage = messageMatch ? messageMatch[1] : '';

          console.log('[Chat API] Using smart contextual fallback. User message:', message.substring(0, 60), 'LLM message:', llmMessage.substring(0, 60));

          // Generate a contextual fallback based on the user's message AND the LLM's description
          const contextualFallback = generateContextualFallback(message, llmMessage, creativeMode);
          parsed = parseAIResponse(contextualFallback);

          // Mark this as a template-based design
          templateUsed = true;
        }
      } else {
        console.log('[Chat API] Design parsed successfully!');
        // Check if the parsed design is too incomplete (e.g., only a nav bar)
        // If it has fewer than 3 top-level sections, use contextual fallback instead
        const designObj = parsed.design as Record<string, unknown> | null;
        const children = (designObj?.children as unknown[]) || [];
        const msg = message.toLowerCase();
        const isLandingOrPage = msg.includes('landing') || msg.includes('page') || msg.includes('website') || msg.includes('saas') || msg.includes('app');
        if (isLandingOrPage && children.length < 3) {
          console.warn('[Chat API] Parsed design is too incomplete (' + children.length + ' children), using contextual fallback');
          const messageMatch = rawResponse?.match(/"message"\s*:\s*"([^"]+)"/);
          const llmMessage = messageMatch ? messageMatch[1] : '';
          const contextualFallback = generateContextualFallback(message, llmMessage, creativeMode);
          parsed = parseAIResponse(contextualFallback);
          templateUsed = true;
        }
      }
    } else {
      // Fallback to hardcoded design generation (LLM was completely unavailable)
      const fallbackRaw = generateFallbackDesign(message, creativeMode);
      parsed = parseAIResponse(fallbackRaw);
      usedFallback = true;
    }

    // Store assistant message
    const assistantMessage = await db.chatMessage.create({
      data: {
        projectId,
        role: 'assistant',
        content: parsed.message || 'I generated a design for you!',
        metadata: JSON.stringify({
          designUpdate: parsed.design || null,
          tokensUsed,
          usedFallback,
          creativeMode: creativeMode || false,
        }),
      },
    });

    // Update project if design was generated
    if (parsed.design) {
      await db.project.update({
        where: { id: projectId },
        data: { designJSON: JSON.stringify(parsed.design), status: 'IN_PROGRESS' },
      });
    }

    return NextResponse.json({
      id: assistantMessage.id,
      message: parsed.message || 'I generated a design for you!',
      design: parsed.design,
      projectId,
      createdAt: assistantMessage.createdAt,
      usedFallback,
      templateUsed,
      parseFailed: !parsed.design,
    });
  } catch (error) {
    console.error('[Chat API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to process chat message', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// ============ GET Handler ============

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
    }
    const messages = await db.chatMessage.findMany({ where: { projectId }, orderBy: { createdAt: 'asc' } });
    return NextResponse.json({ messages });
  } catch (error) {
    console.error('[Chat API] GET Error:', error);
    return NextResponse.json({ error: 'Failed to retrieve chat history' }, { status: 500 });
  }
}
