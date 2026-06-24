// Z.Design - Template Seed API Route
// POST: Seed the database with built-in templates

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

const BUILT_IN_TEMPLATES = [
  // 1. SaaS Landing Page
  {
    name: 'SaaS Landing Page',
    description: 'A modern SaaS landing page with hero section, feature grid, pricing table, and call-to-action. Perfect for software product launches.',
    category: 'SaaS',
    thumbnail: null,
    tags: ['saas', 'landing', 'pricing', 'hero', 'startup'],
    downloads: 2847,
    rating: 4.8,
    designJSON: JSON.stringify({
      id: 'root',
      type: 'root',
      tag: 'div',
      style: { display: 'flex', flexDirection: 'column', minHeight: '100vh', width: '100%', fontFamily: 'Inter, system-ui, sans-serif', backgroundColor: '#ffffff' },
      children: [
        {
          id: 'nav',
          type: 'nav',
          tag: 'nav',
          style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 48px', borderBottom: '1px solid #e2e8f0', backgroundColor: '#ffffff', position: 'sticky', top: '0', zIndex: 50 },
          children: [
            { id: 'logo', type: 'text', tag: 'span', content: 'FlowSync', style: { fontSize: '24px', fontWeight: '800', background: 'linear-gradient(135deg, #10b981, #14b8a6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' } },
            { id: 'nav-links', type: 'flex', tag: 'div', style: { display: 'flex', gap: '32px', alignItems: 'center' },
              children: [
                { id: 'nl1', type: 'link', tag: 'a', content: 'Features', style: { fontSize: '15px', color: '#475569', textDecoration: 'none' } },
                { id: 'nl2', type: 'link', tag: 'a', content: 'Pricing', style: { fontSize: '15px', color: '#475569', textDecoration: 'none' } },
                { id: 'nl3', type: 'link', tag: 'a', content: 'About', style: { fontSize: '15px', color: '#475569', textDecoration: 'none' } },
                { id: 'cta-btn', type: 'button', tag: 'button', content: 'Get Started', style: { backgroundColor: '#10b981', color: '#ffffff', padding: '10px 24px', borderRadius: '8px', fontSize: '14px', fontWeight: '600', border: 'none', cursor: 'pointer' } },
              ]
            }
          ]
        },
        {
          id: 'hero',
          type: 'section',
          tag: 'section',
          style: { display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '80px 48px 60px', background: 'linear-gradient(180deg, #ecfdf5 0%, #ffffff 100%)' },
          children: [
            { id: 'badge', type: 'badge', tag: 'span', content: '🚀 Now in Beta — Try Free', style: { backgroundColor: '#ecfdf5', color: '#059669', padding: '6px 16px', borderRadius: '9999px', fontSize: '13px', fontWeight: '600', marginBottom: '24px' } },
            { id: 'hero-title', type: 'heading', tag: 'h1', content: 'Streamline Your\nWorkflow with AI', style: { fontSize: '64px', fontWeight: '800', lineHeight: '1.1', color: '#0f172a', maxWidth: '800px', letterSpacing: '-0.02em', whiteSpace: 'pre-line' } },
            { id: 'hero-sub', type: 'text', tag: 'p', content: 'The all-in-one platform that helps teams collaborate, automate, and deliver faster. Powered by intelligent automation.', style: { fontSize: '20px', color: '#64748b', maxWidth: '600px', marginTop: '24px', lineHeight: '1.6' } },
            { id: 'hero-cta', type: 'flex', tag: 'div', style: { display: 'flex', gap: '16px', marginTop: '40px', alignItems: 'center' },
              children: [
                { id: 'cta1', type: 'button', tag: 'button', content: 'Start Free Trial', style: { backgroundColor: '#10b981', color: '#ffffff', padding: '14px 32px', borderRadius: '10px', fontSize: '16px', fontWeight: '600', border: 'none', cursor: 'pointer', boxShadow: '0 4px 14px rgba(16,185,129,0.4)' } },
                { id: 'cta2', type: 'button', tag: 'button', content: 'Watch Demo →', style: { backgroundColor: 'transparent', color: '#0f172a', padding: '14px 32px', borderRadius: '10px', fontSize: '16px', fontWeight: '600', border: '1px solid #e2e8f0', cursor: 'pointer' } },
              ]
            },
          ]
        },
        {
          id: 'features',
          type: 'section',
          tag: 'section',
          style: { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '80px 48px' },
          children: [
            { id: 'feat-label', type: 'text', tag: 'p', content: 'FEATURES', style: { fontSize: '13px', fontWeight: '700', color: '#10b981', letterSpacing: '0.1em', textTransform: 'uppercase' } },
            { id: 'feat-title', type: 'heading', tag: 'h2', content: 'Everything you need to ship faster', style: { fontSize: '40px', fontWeight: '700', color: '#0f172a', marginTop: '12px', textAlign: 'center' } },
            {
              id: 'feat-grid',
              type: 'grid',
              tag: 'div',
              style: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '32px', marginTop: '48px', maxWidth: '1100px', width: '100%' },
              children: [
                { id: 'f1', type: 'card', tag: 'div', style: { padding: '32px', borderRadius: '16px', border: '1px solid #e2e8f0', backgroundColor: '#ffffff' },
                  children: [
                    { id: 'f1-icon', type: 'icon', tag: 'div', content: '⚡', style: { fontSize: '32px', marginBottom: '16px' } },
                    { id: 'f1-title', type: 'heading', tag: 'h3', content: 'Lightning Fast', style: { fontSize: '20px', fontWeight: '600', color: '#0f172a' } },
                    { id: 'f1-desc', type: 'text', tag: 'p', content: 'Deploy in seconds with our optimized build pipeline and global CDN.', style: { fontSize: '15px', color: '#64748b', marginTop: '8px', lineHeight: '1.5' } },
                  ]
                },
                { id: 'f2', type: 'card', tag: 'div', style: { padding: '32px', borderRadius: '16px', border: '1px solid #e2e8f0', backgroundColor: '#ffffff' },
                  children: [
                    { id: 'f2-icon', type: 'icon', tag: 'div', content: '🤖', style: { fontSize: '32px', marginBottom: '16px' } },
                    { id: 'f2-title', type: 'heading', tag: 'h3', content: 'AI-Powered', style: { fontSize: '20px', fontWeight: '600', color: '#0f172a' } },
                    { id: 'f2-desc', type: 'text', tag: 'p', content: 'Smart automation that learns from your workflow and suggests optimizations.', style: { fontSize: '15px', color: '#64748b', marginTop: '8px', lineHeight: '1.5' } },
                  ]
                },
                { id: 'f3', type: 'card', tag: 'div', style: { padding: '32px', borderRadius: '16px', border: '1px solid #e2e8f0', backgroundColor: '#ffffff' },
                  children: [
                    { id: 'f3-icon', type: 'icon', tag: 'div', content: '🔒', style: { fontSize: '32px', marginBottom: '16px' } },
                    { id: 'f3-title', type: 'heading', tag: 'h3', content: 'Enterprise Security', style: { fontSize: '20px', fontWeight: '600', color: '#0f172a' } },
                    { id: 'f3-desc', type: 'text', tag: 'p', content: 'SOC 2 compliant with end-to-end encryption and role-based access.', style: { fontSize: '15px', color: '#64748b', marginTop: '8px', lineHeight: '1.5' } },
                  ]
                },
              ]
            }
          ]
        },
        {
          id: 'pricing',
          type: 'section',
          tag: 'section',
          style: { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '80px 48px', backgroundColor: '#f8fafc' },
          children: [
            { id: 'pr-label', type: 'text', tag: 'p', content: 'PRICING', style: { fontSize: '13px', fontWeight: '700', color: '#10b981', letterSpacing: '0.1em', textTransform: 'uppercase' } },
            { id: 'pr-title', type: 'heading', tag: 'h2', content: 'Simple, transparent pricing', style: { fontSize: '40px', fontWeight: '700', color: '#0f172a', marginTop: '12px' } },
            {
              id: 'pr-grid',
              type: 'grid',
              tag: 'div',
              style: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px', marginTop: '48px', maxWidth: '1000px', width: '100%' },
              children: [
                { id: 'plan1', type: 'card', tag: 'div', style: { padding: '32px', borderRadius: '16px', border: '1px solid #e2e8f0', backgroundColor: '#ffffff', textAlign: 'center' },
                  children: [
                    { id: 'p1-name', type: 'text', tag: 'p', content: 'Starter', style: { fontSize: '14px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase' } },
                    { id: 'p1-price', type: 'heading', tag: 'div', content: '$0', style: { fontSize: '48px', fontWeight: '800', color: '#0f172a', marginTop: '8px' } },
                    { id: 'p1-period', type: 'text', tag: 'span', content: '/month', style: { fontSize: '14px', color: '#94a3b8' } },
                    { id: 'p1-btn', type: 'button', tag: 'button', content: 'Get Started', style: { width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0', backgroundColor: '#ffffff', color: '#0f172a', fontWeight: '600', fontSize: '14px', marginTop: '24px', cursor: 'pointer' } },
                  ]
                },
                { id: 'plan2', type: 'card', tag: 'div', style: { padding: '32px', borderRadius: '16px', border: '2px solid #10b981', backgroundColor: '#ffffff', textAlign: 'center', boxShadow: '0 4px 14px rgba(16,185,129,0.15)' },
                  children: [
                    { id: 'p2-popular', type: 'badge', tag: 'span', content: 'Most Popular', style: { backgroundColor: '#ecfdf5', color: '#059669', padding: '4px 12px', borderRadius: '9999px', fontSize: '12px', fontWeight: '600' } },
                    { id: 'p2-name', type: 'text', tag: 'p', content: 'Pro', style: { fontSize: '14px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', marginTop: '8px' } },
                    { id: 'p2-price', type: 'heading', tag: 'div', content: '$29', style: { fontSize: '48px', fontWeight: '800', color: '#0f172a', marginTop: '8px' } },
                    { id: 'p2-period', type: 'text', tag: 'span', content: '/month', style: { fontSize: '14px', color: '#94a3b8' } },
                    { id: 'p2-btn', type: 'button', tag: 'button', content: 'Start Free Trial', style: { width: '100%', padding: '12px', borderRadius: '8px', border: 'none', backgroundColor: '#10b981', color: '#ffffff', fontWeight: '600', fontSize: '14px', marginTop: '24px', cursor: 'pointer', boxShadow: '0 4px 14px rgba(16,185,129,0.4)' } },
                  ]
                },
                { id: 'plan3', type: 'card', tag: 'div', style: { padding: '32px', borderRadius: '16px', border: '1px solid #e2e8f0', backgroundColor: '#ffffff', textAlign: 'center' },
                  children: [
                    { id: 'p3-name', type: 'text', tag: 'p', content: 'Enterprise', style: { fontSize: '14px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase' } },
                    { id: 'p3-price', type: 'heading', tag: 'div', content: '$99', style: { fontSize: '48px', fontWeight: '800', color: '#0f172a', marginTop: '8px' } },
                    { id: 'p3-period', type: 'text', tag: 'span', content: '/month', style: { fontSize: '14px', color: '#94a3b8' } },
                    { id: 'p3-btn', type: 'button', tag: 'button', content: 'Contact Sales', style: { width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0', backgroundColor: '#ffffff', color: '#0f172a', fontWeight: '600', fontSize: '14px', marginTop: '24px', cursor: 'pointer' } },
                  ]
                },
              ]
            }
          ]
        },
        {
          id: 'footer',
          type: 'footer',
          tag: 'footer',
          style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '24px 48px', borderTop: '1px solid #e2e8f0', backgroundColor: '#ffffff' },
          children: [
            { id: 'foot-logo', type: 'text', tag: 'span', content: 'FlowSync', style: { fontSize: '18px', fontWeight: '700', color: '#0f172a' } },
            { id: 'foot-copy', type: 'text', tag: 'p', content: '© 2026 FlowSync. All rights reserved.', style: { fontSize: '13px', color: '#94a3b8' } },
          ]
        }
      ]
    }),
  },

  // 2. Analytics Dashboard
  {
    name: 'Analytics Dashboard',
    description: 'A comprehensive analytics dashboard with sidebar navigation, metric cards, chart areas, and data table. Ideal for data-driven applications.',
    category: 'Dashboard',
    thumbnail: null,
    tags: ['dashboard', 'analytics', 'metrics', 'charts', 'admin'],
    downloads: 2156,
    rating: 4.7,
    designJSON: JSON.stringify({
      id: 'root',
      type: 'root',
      tag: 'div',
      style: { display: 'flex', minHeight: '100vh', width: '100%', fontFamily: 'Inter, system-ui, sans-serif', backgroundColor: '#f1f5f9' },
      children: [
        {
          id: 'sidebar',
          type: 'sidebar',
          tag: 'aside',
          style: { display: 'flex', flexDirection: 'column', width: '240px', backgroundColor: '#0f172a', padding: '24px 16px', minHeight: '100vh', flexShrink: 0 },
          children: [
            { id: 'sb-logo', type: 'text', tag: 'span', content: '📊 Analytics', style: { fontSize: '20px', fontWeight: '700', color: '#ffffff', padding: '0 8px 24px' } },
            { id: 'sb-nav', type: 'nav', tag: 'nav', style: { display: 'flex', flexDirection: 'column', gap: '4px' },
              children: [
                { id: 'sn1', type: 'link', tag: 'a', content: '📈 Dashboard', style: { display: 'block', padding: '10px 12px', borderRadius: '8px', color: '#ffffff', fontSize: '14px', backgroundColor: '#1e293b', fontWeight: '500', textDecoration: 'none' } },
                { id: 'sn2', type: 'link', tag: 'a', content: '👥 Users', style: { display: 'block', padding: '10px 12px', borderRadius: '8px', color: '#94a3b8', fontSize: '14px', textDecoration: 'none' } },
                { id: 'sn3', type: 'link', tag: 'a', content: '💰 Revenue', style: { display: 'block', padding: '10px 12px', borderRadius: '8px', color: '#94a3b8', fontSize: '14px', textDecoration: 'none' } },
                { id: 'sn4', type: 'link', tag: 'a', content: '📦 Products', style: { display: 'block', padding: '10px 12px', borderRadius: '8px', color: '#94a3b8', fontSize: '14px', textDecoration: 'none' } },
                { id: 'sn5', type: 'link', tag: 'a', content: '⚙️ Settings', style: { display: 'block', padding: '10px 12px', borderRadius: '8px', color: '#94a3b8', fontSize: '14px', textDecoration: 'none' } },
              ]
            }
          ]
        },
        {
          id: 'main',
          type: 'container',
          tag: 'main',
          style: { display: 'flex', flexDirection: 'column', flex: 1, padding: '32px', gap: '24px', overflow: 'auto' },
          children: [
            {
              id: 'top-bar',
              type: 'flex',
              tag: 'div',
              style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
              children: [
                { id: 'page-title', type: 'heading', tag: 'h1', content: 'Dashboard', style: { fontSize: '28px', fontWeight: '700', color: '#0f172a' } },
                { id: 'date-range', type: 'button', tag: 'button', content: 'Last 30 days ↓', style: { padding: '8px 16px', borderRadius: '8px', border: '1px solid #e2e8f0', backgroundColor: '#ffffff', fontSize: '14px', color: '#475569', cursor: 'pointer' } },
              ]
            },
            {
              id: 'metric-cards',
              type: 'grid',
              tag: 'div',
              style: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px' },
              children: [
                { id: 'mc1', type: 'card', tag: 'div', style: { padding: '24px', borderRadius: '12px', backgroundColor: '#ffffff', border: '1px solid #e2e8f0' },
                  children: [
                    { id: 'mc1-label', type: 'text', tag: 'p', content: 'Total Revenue', style: { fontSize: '13px', color: '#64748b', fontWeight: '500' } },
                    { id: 'mc1-val', type: 'heading', tag: 'div', content: '$45,231', style: { fontSize: '32px', fontWeight: '700', color: '#0f172a', marginTop: '4px' } },
                    { id: 'mc1-change', type: 'text', tag: 'span', content: '+20.1%', style: { fontSize: '13px', color: '#10b981', fontWeight: '600' } },
                  ]
                },
                { id: 'mc2', type: 'card', tag: 'div', style: { padding: '24px', borderRadius: '12px', backgroundColor: '#ffffff', border: '1px solid #e2e8f0' },
                  children: [
                    { id: 'mc2-label', type: 'text', tag: 'p', content: 'Active Users', style: { fontSize: '13px', color: '#64748b', fontWeight: '500' } },
                    { id: 'mc2-val', type: 'heading', tag: 'div', content: '2,350', style: { fontSize: '32px', fontWeight: '700', color: '#0f172a', marginTop: '4px' } },
                    { id: 'mc2-change', type: 'text', tag: 'span', content: '+15.3%', style: { fontSize: '13px', color: '#10b981', fontWeight: '600' } },
                  ]
                },
                { id: 'mc3', type: 'card', tag: 'div', style: { padding: '24px', borderRadius: '12px', backgroundColor: '#ffffff', border: '1px solid #e2e8f0' },
                  children: [
                    { id: 'mc3-label', type: 'text', tag: 'p', content: 'Conversion Rate', style: { fontSize: '13px', color: '#64748b', fontWeight: '500' } },
                    { id: 'mc3-val', type: 'heading', tag: 'div', content: '3.2%', style: { fontSize: '32px', fontWeight: '700', color: '#0f172a', marginTop: '4px' } },
                    { id: 'mc3-change', type: 'text', tag: 'span', content: '+2.1%', style: { fontSize: '13px', color: '#10b981', fontWeight: '600' } },
                  ]
                },
                { id: 'mc4', type: 'card', tag: 'div', style: { padding: '24px', borderRadius: '12px', backgroundColor: '#ffffff', border: '1px solid #e2e8f0' },
                  children: [
                    { id: 'mc4-label', type: 'text', tag: 'p', content: 'Avg. Session', style: { fontSize: '13px', color: '#64748b', fontWeight: '500' } },
                    { id: 'mc4-val', type: 'heading', tag: 'div', content: '4m 32s', style: { fontSize: '32px', fontWeight: '700', color: '#0f172a', marginTop: '4px' } },
                    { id: 'mc4-change', type: 'text', tag: 'span', content: '-0.4%', style: { fontSize: '13px', color: '#ef4444', fontWeight: '600' } },
                  ]
                },
              ]
            },
            {
              id: 'charts-row',
              type: 'grid',
              tag: 'div',
              style: { display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px' },
              children: [
                { id: 'chart1', type: 'card', tag: 'div', style: { padding: '24px', borderRadius: '12px', backgroundColor: '#ffffff', border: '1px solid #e2e8f0' },
                  children: [
                    { id: 'ch1-title', type: 'heading', tag: 'h3', content: 'Revenue Overview', style: { fontSize: '16px', fontWeight: '600', color: '#0f172a' } },
                    { id: 'ch1-area', type: 'chart', tag: 'div', style: { height: '240px', marginTop: '16px', backgroundColor: '#f8fafc', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' },
                      children: [
                        { id: 'ch1-ph', type: 'text', tag: 'span', content: '📈 Chart Area', style: { color: '#94a3b8', fontSize: '14px' } },
                      ]
                    },
                  ]
                },
                { id: 'chart2', type: 'card', tag: 'div', style: { padding: '24px', borderRadius: '12px', backgroundColor: '#ffffff', border: '1px solid #e2e8f0' },
                  children: [
                    { id: 'ch2-title', type: 'heading', tag: 'h3', content: 'Traffic Sources', style: { fontSize: '16px', fontWeight: '600', color: '#0f172a' } },
                    { id: 'ch2-area', type: 'chart', tag: 'div', style: { height: '240px', marginTop: '16px', backgroundColor: '#f8fafc', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' },
                      children: [
                        { id: 'ch2-ph', type: 'text', tag: 'span', content: '🍩 Donut Chart', style: { color: '#94a3b8', fontSize: '14px' } },
                      ]
                    },
                  ]
                },
              ]
            },
          ]
        }
      ]
    }),
  },

  // 3. Mobile App Onboarding
  {
    name: 'Mobile App Onboarding',
    description: 'A beautiful 4-screen mobile onboarding flow with illustrations, progress indicators, and smooth transitions. Great for app first-run experience.',
    category: 'App UI',
    thumbnail: null,
    tags: ['mobile', 'onboarding', 'app', 'tutorial', 'flow'],
    downloads: 1834,
    rating: 4.6,
    designJSON: JSON.stringify({
      id: 'root',
      type: 'root',
      tag: 'div',
      style: { display: 'flex', minHeight: '100vh', width: '100%', fontFamily: 'Inter, system-ui, sans-serif', backgroundColor: '#ffffff', justifyContent: 'center', alignItems: 'center' },
      children: [
        {
          id: 'phone-frame',
          type: 'container',
          tag: 'div',
          style: { width: '375px', minHeight: '812px', display: 'flex', flexDirection: 'column', position: 'relative', borderRadius: '40px', overflow: 'hidden', boxShadow: '0 25px 50px rgba(0,0,0,0.15)', border: '8px solid #1e293b' },
          children: [
            {
              id: 'screen1',
              type: 'section',
              tag: 'section',
              style: { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '60px 32px 40px', flex: 1, background: 'linear-gradient(180deg, #ecfdf5 0%, #ffffff 60%)' },
              children: [
                { id: 's1-dots', type: 'flex', tag: 'div', style: { display: 'flex', gap: '8px', marginBottom: '48px' },
                  children: [
                    { id: 'd1', type: 'icon', tag: 'div', content: '', style: { width: '24px', height: '6px', borderRadius: '3px', backgroundColor: '#10b981' } },
                    { id: 'd2', type: 'icon', tag: 'div', content: '', style: { width: '6px', height: '6px', borderRadius: '3px', backgroundColor: '#d1d5db' } },
                    { id: 'd3', type: 'icon', tag: 'div', content: '', style: { width: '6px', height: '6px', borderRadius: '3px', backgroundColor: '#d1d5db' } },
                    { id: 'd4', type: 'icon', tag: 'div', content: '', style: { width: '6px', height: '6px', borderRadius: '3px', backgroundColor: '#d1d5db' } },
                  ]
                },
                { id: 's1-illust', type: 'image', tag: 'div', style: { width: '240px', height: '240px', borderRadius: '24px', background: 'linear-gradient(135deg, #10b981, #14b8a6)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '40px' },
                  children: [
                    { id: 's1-ph', type: 'text', tag: 'span', content: '🚀', style: { fontSize: '80px' } },
                  ]
                },
                { id: 's1-title', type: 'heading', tag: 'h2', content: 'Welcome to FitTrack', style: { fontSize: '28px', fontWeight: '700', color: '#0f172a', textAlign: 'center' } },
                { id: 's1-desc', type: 'text', tag: 'p', content: 'Your personal fitness companion that helps you build healthy habits one step at a time.', style: { fontSize: '16px', color: '#64748b', textAlign: 'center', marginTop: '12px', lineHeight: '1.5' } },
              ]
            },
            {
              id: 's1-bottom',
              type: 'flex',
              tag: 'div',
              style: { display: 'flex', flexDirection: 'column', padding: '24px 32px 48px', gap: '16px' },
              children: [
                { id: 's1-btn', type: 'button', tag: 'button', content: 'Get Started', style: { width: '100%', padding: '16px', borderRadius: '14px', backgroundColor: '#10b981', color: '#ffffff', fontSize: '16px', fontWeight: '600', border: 'none', cursor: 'pointer', boxShadow: '0 4px 14px rgba(16,185,129,0.4)' } },
                { id: 's1-skip', type: 'link', tag: 'a', content: 'Skip for now', style: { textAlign: 'center', fontSize: '14px', color: '#94a3b8', textDecoration: 'none' } },
              ]
            }
          ]
        }
      ]
    }),
  },

  // 4. E-Commerce Product Page
  {
    name: 'E-Commerce Product Page',
    description: 'A product detail page with image gallery, pricing, variant selector, reviews section, and add-to-cart functionality. Perfect for online stores.',
    category: 'E-Commerce',
    thumbnail: null,
    tags: ['ecommerce', 'product', 'shop', 'store', 'retail'],
    downloads: 3012,
    rating: 4.9,
    designJSON: JSON.stringify({
      id: 'root',
      type: 'root',
      tag: 'div',
      style: { display: 'flex', flexDirection: 'column', minHeight: '100vh', width: '100%', fontFamily: 'Inter, system-ui, sans-serif', backgroundColor: '#ffffff' },
      children: [
        {
          id: 'top-nav',
          type: 'nav',
          tag: 'nav',
          style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 48px', borderBottom: '1px solid #e2e8f0' },
          children: [
            { id: 'nav-logo', type: 'text', tag: 'span', content: 'MODA', style: { fontSize: '22px', fontWeight: '800', letterSpacing: '0.15em', color: '#0f172a' } },
            { id: 'nav-icons', type: 'flex', tag: 'div', style: { display: 'flex', gap: '20px', alignItems: 'center' },
              children: [
                { id: 'ni1', type: 'link', tag: 'a', content: '🔍', style: { fontSize: '18px', textDecoration: 'none' } },
                { id: 'ni2', type: 'link', tag: 'a', content: '🛒', style: { fontSize: '18px', textDecoration: 'none' } },
                { id: 'ni3', type: 'link', tag: 'a', content: '👤', style: { fontSize: '18px', textDecoration: 'none' } },
              ]
            }
          ]
        },
        {
          id: 'product-section',
          type: 'section',
          tag: 'section',
          style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '48px', padding: '48px', maxWidth: '1200px', margin: '0 auto', width: '100%' },
          children: [
            {
              id: 'product-image',
              type: 'container',
              tag: 'div',
              style: { display: 'flex', flexDirection: 'column', gap: '16px' },
              children: [
                { id: 'main-img', type: 'image', tag: 'div', style: { width: '100%', height: '500px', borderRadius: '16px', background: 'linear-gradient(135deg, #ecfdf5, #f0fdfa)', display: 'flex', alignItems: 'center', justifyContent: 'center' },
                  children: [
                    { id: 'img-ph', type: 'text', tag: 'span', content: '👟', style: { fontSize: '120px' } },
                  ]
                },
                { id: 'thumb-row', type: 'flex', tag: 'div', style: { display: 'flex', gap: '12px' },
                  children: [
                    { id: 'th1', type: 'image', tag: 'div', style: { width: '80px', height: '80px', borderRadius: '10px', border: '2px solid #10b981', backgroundColor: '#ecfdf5' } },
                    { id: 'th2', type: 'image', tag: 'div', style: { width: '80px', height: '80px', borderRadius: '10px', border: '1px solid #e2e8f0', backgroundColor: '#f8fafc' } },
                    { id: 'th3', type: 'image', tag: 'div', style: { width: '80px', height: '80px', borderRadius: '10px', border: '1px solid #e2e8f0', backgroundColor: '#f8fafc' } },
                  ]
                }
              ]
            },
            {
              id: 'product-info',
              type: 'container',
              tag: 'div',
              style: { display: 'flex', flexDirection: 'column', gap: '20px' },
              children: [
                { id: 'pi-brand', type: 'text', tag: 'p', content: 'MODA SPORTS', style: { fontSize: '13px', fontWeight: '600', color: '#10b981', letterSpacing: '0.1em', textTransform: 'uppercase' } },
                { id: 'pi-name', type: 'heading', tag: 'h1', content: 'Ultra Comfort Running Shoe', style: { fontSize: '32px', fontWeight: '700', color: '#0f172a' } },
                { id: 'pi-rating', type: 'flex', tag: 'div', style: { display: 'flex', gap: '8px', alignItems: 'center' },
                  children: [
                    { id: 'stars', type: 'text', tag: 'span', content: '★★★★★', style: { color: '#f59e0b', fontSize: '16px' } },
                    { id: 'rev-count', type: 'text', tag: 'span', content: '(2,847 reviews)', style: { color: '#94a3b8', fontSize: '14px' } },
                  ]
                },
                { id: 'pi-price', type: 'heading', tag: 'div', content: '$129.00', style: { fontSize: '36px', fontWeight: '700', color: '#0f172a' } },
                { id: 'pi-desc', type: 'text', tag: 'p', content: 'Experience unmatched comfort with our signature cloud-foam technology. Designed for runners who demand both performance and style.', style: { fontSize: '16px', color: '#64748b', lineHeight: '1.6' } },
                { id: 'pi-divider', type: 'divider', tag: 'hr', style: { border: 'none', borderTop: '1px solid #e2e8f0', margin: '4px 0' } },
                { id: 'pi-size-label', type: 'text', tag: 'p', content: 'Size', style: { fontSize: '14px', fontWeight: '600', color: '#0f172a' } },
                { id: 'pi-sizes', type: 'flex', tag: 'div', style: { display: 'flex', gap: '10px' },
                  children: [
                    { id: 'sz1', type: 'button', tag: 'button', content: '7', style: { width: '48px', height: '48px', borderRadius: '10px', border: '1px solid #e2e8f0', backgroundColor: '#ffffff', fontSize: '14px', fontWeight: '500', cursor: 'pointer' } },
                    { id: 'sz2', type: 'button', tag: 'button', content: '8', style: { width: '48px', height: '48px', borderRadius: '10px', border: '2px solid #10b981', backgroundColor: '#ecfdf5', fontSize: '14px', fontWeight: '600', cursor: 'pointer', color: '#059669' } },
                    { id: 'sz3', type: 'button', tag: 'button', content: '9', style: { width: '48px', height: '48px', borderRadius: '10px', border: '1px solid #e2e8f0', backgroundColor: '#ffffff', fontSize: '14px', fontWeight: '500', cursor: 'pointer' } },
                    { id: 'sz4', type: 'button', tag: 'button', content: '10', style: { width: '48px', height: '48px', borderRadius: '10px', border: '1px solid #e2e8f0', backgroundColor: '#ffffff', fontSize: '14px', fontWeight: '500', cursor: 'pointer' } },
                  ]
                },
                { id: 'pi-cart-btn', type: 'button', tag: 'button', content: 'Add to Cart — $129.00', style: { width: '100%', padding: '16px', borderRadius: '12px', backgroundColor: '#10b981', color: '#ffffff', fontSize: '16px', fontWeight: '600', border: 'none', cursor: 'pointer', marginTop: '8px', boxShadow: '0 4px 14px rgba(16,185,129,0.4)' } },
              ]
            }
          ]
        }
      ]
    }),
  },

  // 5. Portfolio Website
  {
    name: 'Portfolio Website',
    description: 'A creative portfolio website with hero section, project grid, about area, and contact form. Showcase your best work beautifully.',
    category: 'Portfolio',
    thumbnail: null,
    tags: ['portfolio', 'creative', 'personal', 'showcase', 'projects'],
    downloads: 2567,
    rating: 4.5,
    designJSON: JSON.stringify({
      id: 'root',
      type: 'root',
      tag: 'div',
      style: { display: 'flex', flexDirection: 'column', minHeight: '100vh', width: '100%', fontFamily: 'Inter, system-ui, sans-serif', backgroundColor: '#0f172a', color: '#ffffff' },
      children: [
        {
          id: 'nav',
          type: 'nav',
          tag: 'nav',
          style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 48px' },
          children: [
            { id: 'logo', type: 'text', tag: 'span', content: 'Alex.design', style: { fontSize: '20px', fontWeight: '700', color: '#ffffff' } },
            { id: 'nav-links', type: 'flex', tag: 'div', style: { display: 'flex', gap: '32px' },
              children: [
                { id: 'nl1', type: 'link', tag: 'a', content: 'Work', style: { color: '#94a3b8', fontSize: '14px', textDecoration: 'none' } },
                { id: 'nl2', type: 'link', tag: 'a', content: 'About', style: { color: '#94a3b8', fontSize: '14px', textDecoration: 'none' } },
                { id: 'nl3', type: 'link', tag: 'a', content: 'Contact', style: { color: '#94a3b8', fontSize: '14px', textDecoration: 'none' } },
              ]
            }
          ]
        },
        {
          id: 'hero',
          type: 'section',
          tag: 'section',
          style: { display: 'flex', flexDirection: 'column', padding: '120px 48px 80px' },
          children: [
            { id: 'hero-label', type: 'text', tag: 'p', content: 'Creative Designer & Developer', style: { fontSize: '14px', fontWeight: '600', color: '#10b981', letterSpacing: '0.05em' } },
            { id: 'hero-title', type: 'heading', tag: 'h1', content: 'I craft digital\nexperiences that\ninspire.', style: { fontSize: '72px', fontWeight: '800', lineHeight: '1.05', marginTop: '24px', letterSpacing: '-0.03em', whiteSpace: 'pre-line' } },
            { id: 'hero-cta', type: 'button', tag: 'button', content: 'View My Work →', style: { marginTop: '40px', padding: '14px 32px', borderRadius: '10px', backgroundColor: '#10b981', color: '#ffffff', fontSize: '16px', fontWeight: '600', border: 'none', cursor: 'pointer' } },
          ]
        },
        {
          id: 'projects',
          type: 'section',
          tag: 'section',
          style: { display: 'flex', flexDirection: 'column', padding: '80px 48px' },
          children: [
            { id: 'proj-title', type: 'heading', tag: 'h2', content: 'Selected Work', style: { fontSize: '36px', fontWeight: '700', marginBottom: '48px' } },
            {
              id: 'proj-grid',
              type: 'grid',
              tag: 'div',
              style: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '32px' },
              children: [
                { id: 'p1', type: 'card', tag: 'div', style: { borderRadius: '16px', overflow: 'hidden', backgroundColor: '#1e293b' },
                  children: [
                    { id: 'p1-img', type: 'image', tag: 'div', style: { height: '280px', background: 'linear-gradient(135deg, #10b981, #0d9488)', display: 'flex', alignItems: 'center', justifyContent: 'center' },
                      children: [
                        { id: 'p1-ph', type: 'text', tag: 'span', content: '🎨', style: { fontSize: '64px' } },
                      ]
                    },
                    { id: 'p1-info', type: 'container', tag: 'div', style: { padding: '24px' },
                      children: [
                        { id: 'p1-name', type: 'heading', tag: 'h3', content: 'Brand Identity System', style: { fontSize: '20px', fontWeight: '600' } },
                        { id: 'p1-cat', type: 'text', tag: 'p', content: 'Branding • Design System', style: { fontSize: '14px', color: '#94a3b8', marginTop: '4px' } },
                      ]
                    }
                  ]
                },
                { id: 'p2', type: 'card', tag: 'div', style: { borderRadius: '16px', overflow: 'hidden', backgroundColor: '#1e293b' },
                  children: [
                    { id: 'p2-img', type: 'image', tag: 'div', style: { height: '280px', background: 'linear-gradient(135deg, #f59e0b, #ef4444)', display: 'flex', alignItems: 'center', justifyContent: 'center' },
                      children: [
                        { id: 'p2-ph', type: 'text', tag: 'span', content: '📱', style: { fontSize: '64px' } },
                      ]
                    },
                    { id: 'p2-info', type: 'container', tag: 'div', style: { padding: '24px' },
                      children: [
                        { id: 'p2-name', type: 'heading', tag: 'h3', content: 'Mobile Banking App', style: { fontSize: '20px', fontWeight: '600' } },
                        { id: 'p2-cat', type: 'text', tag: 'p', content: 'Mobile • Fintech', style: { fontSize: '14px', color: '#94a3b8', marginTop: '4px' } },
                      ]
                    }
                  ]
                },
              ]
            }
          ]
        },
        {
          id: 'contact',
          type: 'section',
          tag: 'section',
          style: { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '80px 48px', textAlign: 'center' },
          children: [
            { id: 'c-title', type: 'heading', tag: 'h2', content: "Let's work together", style: { fontSize: '40px', fontWeight: '700' } },
            { id: 'c-email', type: 'link', tag: 'a', content: 'hello@alex.design', style: { fontSize: '20px', color: '#10b981', marginTop: '16px', textDecoration: 'none' } },
          ]
        }
      ]
    }),
  },

  // 6. Marketing Campaign
  {
    name: 'Marketing Campaign',
    description: 'An email-style marketing layout with bold hero, feature highlights, testimonials, and strong call-to-action sections. Drive conversions.',
    category: 'Marketing',
    thumbnail: null,
    tags: ['marketing', 'campaign', 'email', 'newsletter', 'cta'],
    downloads: 1456,
    rating: 4.4,
    designJSON: JSON.stringify({
      id: 'root',
      type: 'root',
      tag: 'div',
      style: { display: 'flex', flexDirection: 'column', minHeight: '100vh', width: '100%', fontFamily: 'Inter, system-ui, sans-serif', backgroundColor: '#ffffff', alignItems: 'center' },
      children: [
        {
          id: 'email-wrapper',
          type: 'container',
          tag: 'div',
          style: { maxWidth: '600px', width: '100%', margin: '0 auto' },
          children: [
            {
              id: 'm-hero',
              type: 'section',
              tag: 'section',
              style: { padding: '60px 40px', textAlign: 'center', background: 'linear-gradient(135deg, #10b981, #0d9488)', borderRadius: '0 0 24px 24px' },
              children: [
                { id: 'mh-logo', type: 'text', tag: 'span', content: 'GREENGROW', style: { fontSize: '14px', fontWeight: '700', color: '#ffffff', letterSpacing: '0.15em', opacity: 0.9 } },
                { id: 'mh-title', type: 'heading', tag: 'h1', content: '🌱 Spring Sale is Here!', style: { fontSize: '36px', fontWeight: '800', color: '#ffffff', marginTop: '24px', lineHeight: '1.2' } },
                { id: 'mh-sub', type: 'text', tag: 'p', content: 'Up to 50% off on all organic products. Limited time offer.', style: { fontSize: '18px', color: '#d1fae5', marginTop: '16px', lineHeight: '1.5' } },
                { id: 'mh-btn', type: 'button', tag: 'button', content: 'Shop Now →', style: { marginTop: '32px', padding: '14px 40px', borderRadius: '10px', backgroundColor: '#ffffff', color: '#059669', fontSize: '16px', fontWeight: '700', border: 'none', cursor: 'pointer' } },
              ]
            },
            {
              id: 'm-features',
              type: 'section',
              tag: 'section',
              style: { padding: '40px' },
              children: [
                { id: 'mf-title', type: 'heading', tag: 'h2', content: 'What makes us different', style: { fontSize: '24px', fontWeight: '700', color: '#0f172a', textAlign: 'center' } },
                {
                  id: 'mf-list',
                  type: 'flex',
                  tag: 'div',
                  style: { display: 'flex', flexDirection: 'column', gap: '24px', marginTop: '32px' },
                  children: [
                    { id: 'mf1', type: 'card', tag: 'div', style: { display: 'flex', gap: '16px', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0' },
                      children: [
                        { id: 'mf1-icon', type: 'icon', tag: 'div', content: '🌿', style: { fontSize: '28px', flexShrink: 0 } },
                        { id: 'mf1-text', type: 'container', tag: 'div', style: { display: 'flex', flexDirection: 'column' },
                          children: [
                            { id: 'mf1-t', type: 'heading', tag: 'h3', content: '100% Organic', style: { fontSize: '16px', fontWeight: '600', color: '#0f172a' } },
                            { id: 'mf1-d', type: 'text', tag: 'p', content: 'All products sourced from certified organic farms.', style: { fontSize: '14px', color: '#64748b', marginTop: '4px' } },
                          ]
                        }
                      ]
                    },
                    { id: 'mf2', type: 'card', tag: 'div', style: { display: 'flex', gap: '16px', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0' },
                      children: [
                        { id: 'mf2-icon', type: 'icon', tag: 'div', content: '🚚', style: { fontSize: '28px', flexShrink: 0 } },
                        { id: 'mf2-text', type: 'container', tag: 'div', style: { display: 'flex', flexDirection: 'column' },
                          children: [
                            { id: 'mf2-t', type: 'heading', tag: 'h3', content: 'Free Shipping', style: { fontSize: '16px', fontWeight: '600', color: '#0f172a' } },
                            { id: 'mf2-d', type: 'text', tag: 'p', content: 'Free delivery on orders over $30. No hidden fees.', style: { fontSize: '14px', color: '#64748b', marginTop: '4px' } },
                          ]
                        }
                      ]
                    },
                  ]
                }
              ]
            },
            {
              id: 'm-cta',
              type: 'section',
              tag: 'section',
              style: { padding: '48px 40px', textAlign: 'center', backgroundColor: '#f0fdf4', borderRadius: '16px', margin: '0 40px 40px' },
              children: [
                { id: 'cta-text', type: 'heading', tag: 'h2', content: 'Ready to go green?', style: { fontSize: '28px', fontWeight: '700', color: '#0f172a' } },
                { id: 'cta-sub', type: 'text', tag: 'p', content: 'Join 50,000+ happy customers', style: { fontSize: '16px', color: '#64748b', marginTop: '8px' } },
                { id: 'cta-btn', type: 'button', tag: 'button', content: 'Get 50% Off', style: { marginTop: '24px', padding: '14px 40px', borderRadius: '10px', backgroundColor: '#10b981', color: '#ffffff', fontSize: '16px', fontWeight: '700', border: 'none', cursor: 'pointer', boxShadow: '0 4px 14px rgba(16,185,129,0.4)' } },
              ]
            }
          ]
        }
      ]
    }),
  },

  // 7. Admin Panel
  {
    name: 'Admin Panel',
    description: 'A powerful admin panel with sidebar navigation, data table, action buttons, and status indicators. Build management interfaces quickly.',
    category: 'Dashboard',
    thumbnail: null,
    tags: ['admin', 'panel', 'table', 'management', 'crud'],
    downloads: 1923,
    rating: 4.6,
    designJSON: JSON.stringify({
      id: 'root',
      type: 'root',
      tag: 'div',
      style: { display: 'flex', minHeight: '100vh', width: '100%', fontFamily: 'Inter, system-ui, sans-serif', backgroundColor: '#f1f5f9' },
      children: [
        {
          id: 'sidebar',
          type: 'sidebar',
          tag: 'aside',
          style: { display: 'flex', flexDirection: 'column', width: '260px', backgroundColor: '#ffffff', borderRight: '1px solid #e2e8f0', padding: '24px 16px', minHeight: '100vh', flexShrink: 0 },
          children: [
            { id: 'sb-logo', type: 'flex', tag: 'div', style: { display: 'flex', alignItems: 'center', gap: '10px', padding: '0 8px 24px' },
              children: [
                { id: 'sb-icon', type: 'icon', tag: 'div', content: '', style: { width: '32px', height: '32px', borderRadius: '8px', background: 'linear-gradient(135deg, #10b981, #14b8a6)', flexShrink: 0 } },
                { id: 'sb-name', type: 'text', tag: 'span', content: 'AdminHub', style: { fontSize: '18px', fontWeight: '700', color: '#0f172a' } },
              ]
            },
            { id: 'sb-section-label', type: 'text', tag: 'p', content: 'MAIN', style: { fontSize: '11px', fontWeight: '700', color: '#94a3b8', letterSpacing: '0.1em', padding: '0 12px', marginTop: '8px' } },
            { id: 'sb-nav', type: 'nav', tag: 'nav', style: { display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '8px' },
              children: [
                { id: 'sn1', type: 'link', tag: 'a', content: '📊 Dashboard', style: { display: 'block', padding: '10px 12px', borderRadius: '8px', color: '#10b981', fontSize: '14px', backgroundColor: '#ecfdf5', fontWeight: '600', textDecoration: 'none' } },
                { id: 'sn2', type: 'link', tag: 'a', content: '👥 Users', style: { display: 'block', padding: '10px 12px', borderRadius: '8px', color: '#64748b', fontSize: '14px', textDecoration: 'none' } },
                { id: 'sn3', type: 'link', tag: 'a', content: '📝 Posts', style: { display: 'block', padding: '10px 12px', borderRadius: '8px', color: '#64748b', fontSize: '14px', textDecoration: 'none' } },
                { id: 'sn4', type: 'link', tag: 'a', content: '💬 Comments', style: { display: 'block', padding: '10px 12px', borderRadius: '8px', color: '#64748b', fontSize: '14px', textDecoration: 'none' } },
              ]
            }
          ]
        },
        {
          id: 'main',
          type: 'container',
          tag: 'main',
          style: { display: 'flex', flexDirection: 'column', flex: 1, padding: '32px', gap: '24px', overflow: 'auto' },
          children: [
            {
              id: 'top-bar',
              type: 'flex',
              tag: 'div',
              style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
              children: [
                { id: 'page-title', type: 'heading', tag: 'h1', content: 'Users', style: { fontSize: '28px', fontWeight: '700', color: '#0f172a' } },
                { id: 'add-btn', type: 'button', tag: 'button', content: '+ Add User', style: { padding: '10px 20px', borderRadius: '8px', backgroundColor: '#10b981', color: '#ffffff', fontSize: '14px', fontWeight: '600', border: 'none', cursor: 'pointer' } },
              ]
            },
            {
              id: 'data-table',
              type: 'card',
              tag: 'div',
              style: { borderRadius: '12px', border: '1px solid #e2e8f0', backgroundColor: '#ffffff', overflow: 'hidden' },
              children: [
                {
                  id: 'table-header',
                  type: 'flex',
                  tag: 'div',
                  style: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 120px', padding: '12px 20px', backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontSize: '13px', fontWeight: '600', color: '#64748b' },
                  children: [
                    { id: 'th1', type: 'text', tag: 'span', content: 'Name' },
                    { id: 'th2', type: 'text', tag: 'span', content: 'Email' },
                    { id: 'th3', type: 'text', tag: 'span', content: 'Role' },
                    { id: 'th4', type: 'text', tag: 'span', content: 'Status' },
                  ]
                },
                {
                  id: 'row1',
                  type: 'flex',
                  tag: 'div',
                  style: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 120px', padding: '14px 20px', borderBottom: '1px solid #f1f5f9', alignItems: 'center', fontSize: '14px' },
                  children: [
                    { id: 'r1-name', type: 'text', tag: 'span', content: 'Sarah Chen', style: { fontWeight: '500', color: '#0f172a' } },
                    { id: 'r1-email', type: 'text', tag: 'span', content: 'sarah@example.com', style: { color: '#64748b' } },
                    { id: 'r1-role', type: 'text', tag: 'span', content: 'Admin', style: { color: '#0f172a' } },
                    { id: 'r1-status', type: 'badge', tag: 'span', content: 'Active', style: { backgroundColor: '#ecfdf5', color: '#059669', padding: '4px 10px', borderRadius: '9999px', fontSize: '12px', fontWeight: '600' } },
                  ]
                },
                {
                  id: 'row2',
                  type: 'flex',
                  tag: 'div',
                  style: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 120px', padding: '14px 20px', borderBottom: '1px solid #f1f5f9', alignItems: 'center', fontSize: '14px' },
                  children: [
                    { id: 'r2-name', type: 'text', tag: 'span', content: 'Mike Johnson', style: { fontWeight: '500', color: '#0f172a' } },
                    { id: 'r2-email', type: 'text', tag: 'span', content: 'mike@example.com', style: { color: '#64748b' } },
                    { id: 'r2-role', type: 'text', tag: 'span', content: 'Editor', style: { color: '#0f172a' } },
                    { id: 'r2-status', type: 'badge', tag: 'span', content: 'Active', style: { backgroundColor: '#ecfdf5', color: '#059669', padding: '4px 10px', borderRadius: '9999px', fontSize: '12px', fontWeight: '600' } },
                  ]
                },
                {
                  id: 'row3',
                  type: 'flex',
                  tag: 'div',
                  style: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 120px', padding: '14px 20px', alignItems: 'center', fontSize: '14px' },
                  children: [
                    { id: 'r3-name', type: 'text', tag: 'span', content: 'Lisa Park', style: { fontWeight: '500', color: '#0f172a' } },
                    { id: 'r3-email', type: 'text', tag: 'span', content: 'lisa@example.com', style: { color: '#64748b' } },
                    { id: 'r3-role', type: 'text', tag: 'span', content: 'Viewer', style: { color: '#0f172a' } },
                    { id: 'r3-status', type: 'badge', tag: 'span', content: 'Inactive', style: { backgroundColor: '#fef2f2', color: '#dc2626', padding: '4px 10px', borderRadius: '9999px', fontSize: '12px', fontWeight: '600' } },
                  ]
                },
              ]
            }
          ]
        }
      ]
    }),
  },

  // 8. Startup Pitch Deck
  {
    name: 'Startup Pitch Deck',
    description: 'A 6-slide startup pitch deck with problem/solution, market size, business model, team, and ask slides. Present your startup with confidence.',
    category: 'Landing Pages',
    thumbnail: null,
    tags: ['pitch', 'deck', 'startup', 'presentation', 'investor'],
    downloads: 1678,
    rating: 4.5,
    designJSON: JSON.stringify({
      id: 'root',
      type: 'root',
      tag: 'div',
      style: { display: 'flex', flexDirection: 'column', minHeight: '100vh', width: '100%', fontFamily: 'Inter, system-ui, sans-serif', backgroundColor: '#0f172a', color: '#ffffff' },
      children: [
        {
          id: 'slide1',
          type: 'section',
          tag: 'section',
          style: { display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', padding: '80px', textAlign: 'center', background: 'linear-gradient(180deg, #0f172a 0%, #1e293b 100%)' },
          children: [
            { id: 's1-label', type: 'badge', tag: 'span', content: 'SEED ROUND 2026', style: { backgroundColor: '#10b981', color: '#ffffff', padding: '6px 16px', borderRadius: '9999px', fontSize: '12px', fontWeight: '700', letterSpacing: '0.05em' } },
            { id: 's1-title', type: 'heading', tag: 'h1', content: 'GreenTech', style: { fontSize: '80px', fontWeight: '800', marginTop: '32px', letterSpacing: '-0.03em', background: 'linear-gradient(135deg, #10b981, #14b8a6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' } },
            { id: 's1-sub', type: 'text', tag: 'p', content: 'AI-Powered Sustainable Energy Management', style: { fontSize: '24px', color: '#94a3b8', marginTop: '16px' } },
            { id: 's1-founder', type: 'text', tag: 'p', content: 'Presented by Jane Doe, CEO', style: { fontSize: '16px', color: '#64748b', marginTop: '40px' } },
          ]
        },
        {
          id: 'slide2',
          type: 'section',
          tag: 'section',
          style: { display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: '100vh', padding: '80px', background: '#0f172a' },
          children: [
            { id: 's2-label', type: 'text', tag: 'p', content: 'THE PROBLEM', style: { fontSize: '13px', fontWeight: '700', color: '#10b981', letterSpacing: '0.1em' } },
            { id: 's2-title', type: 'heading', tag: 'h2', content: 'Energy waste costs businesses $200B+ annually', style: { fontSize: '48px', fontWeight: '700', marginTop: '16px', lineHeight: '1.15', maxWidth: '800px' } },
            { id: 's2-stats', type: 'grid', tag: 'div', style: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '32px', marginTop: '48px', maxWidth: '900px' },
              children: [
                { id: 'st1', type: 'card', tag: 'div', style: { padding: '24px', borderRadius: '12px', border: '1px solid #1e293b', backgroundColor: '#1e293b' },
                  children: [
                    { id: 'st1-val', type: 'heading', tag: 'div', content: '40%', style: { fontSize: '40px', fontWeight: '800', color: '#10b981' } },
                    { id: 'st1-label', type: 'text', tag: 'p', content: 'of commercial energy is wasted', style: { fontSize: '14px', color: '#94a3b8', marginTop: '8px' } },
                  ]
                },
                { id: 'st2', type: 'card', tag: 'div', style: { padding: '24px', borderRadius: '12px', border: '1px solid #1e293b', backgroundColor: '#1e293b' },
                  children: [
                    { id: 'st2-val', type: 'heading', tag: 'div', content: '$200B', style: { fontSize: '40px', fontWeight: '800', color: '#10b981' } },
                    { id: 'st2-label', type: 'text', tag: 'p', content: 'annual waste in the US alone', style: { fontSize: '14px', color: '#94a3b8', marginTop: '8px' } },
                  ]
                },
                { id: 'st3', type: 'card', tag: 'div', style: { padding: '24px', borderRadius: '12px', border: '1px solid #1e293b', backgroundColor: '#1e293b' },
                  children: [
                    { id: 'st3-val', type: 'heading', tag: 'div', content: '8.5Gt', style: { fontSize: '40px', fontWeight: '800', color: '#10b981' } },
                    { id: 'st3-label', type: 'text', tag: 'p', content: 'CO₂ emissions from waste', style: { fontSize: '14px', color: '#94a3b8', marginTop: '8px' } },
                  ]
                },
              ]
            },
          ]
        },
        {
          id: 'slide3',
          type: 'section',
          tag: 'section',
          style: { display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', padding: '80px', textAlign: 'center', background: '#0f172a' },
          children: [
            { id: 's3-label', type: 'text', tag: 'p', content: 'OUR SOLUTION', style: { fontSize: '13px', fontWeight: '700', color: '#10b981', letterSpacing: '0.1em' } },
            { id: 's3-title', type: 'heading', tag: 'h2', content: 'AI that optimizes energy usage in real-time', style: { fontSize: '48px', fontWeight: '700', marginTop: '16px', lineHeight: '1.15' } },
            { id: 's3-desc', type: 'text', tag: 'p', content: 'Our platform uses machine learning to analyze building systems, predict usage patterns, and automatically reduce waste — saving 30% on average.', style: { fontSize: '20px', color: '#94a3b8', marginTop: '24px', maxWidth: '700px', lineHeight: '1.5' } },
            { id: 's3-btn', type: 'button', tag: 'button', content: 'See How It Works →', style: { marginTop: '40px', padding: '14px 32px', borderRadius: '10px', backgroundColor: '#10b981', color: '#ffffff', fontSize: '16px', fontWeight: '600', border: 'none', cursor: 'pointer' } },
          ]
        },
      ]
    }),
  },
];

export async function POST() {
  try {
    // Check if templates already exist
    const existingCount = await db.template.count();

    if (existingCount > 0) {
      return NextResponse.json({
        message: 'Templates already seeded',
        count: existingCount,
        skipped: true,
      });
    }

    // Seed all built-in templates
    const created = [];
    for (const template of BUILT_IN_TEMPLATES) {
      const record = await db.template.create({
        data: {
          name: template.name,
          description: template.description,
          category: template.category,
          designJSON: template.designJSON,
          thumbnail: template.thumbnail,
          tags: JSON.stringify(template.tags),
          downloads: template.downloads,
          rating: template.rating,
          isPublic: true,
        },
      });
      // @ts-expect-error pre-existing: created array inferred as never[]
      created.push(record);
    }

    return NextResponse.json({
      message: 'Templates seeded successfully',
      count: created.length,
      skipped: false,
    });
  } catch (error) {
    console.error('[Template Seed API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to seed templates' },
      { status: 500 }
    );
  }
}
