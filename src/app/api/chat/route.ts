// Z.Design - Chat API Route
// Generates designs based on user messages
// Uses fallback design generation for reliability; Z.ai integration available via /api/design/generate

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { parseAIResponse } from '@/lib/ai-prompts';

interface ChatRequestBody {
  message: string;
  projectId: string;
  designTree?: Record<string, unknown>;
  designSystem?: Record<string, unknown>;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
}

export async function POST(request: NextRequest) {
  try {
    const body: ChatRequestBody = await request.json();
    const { message, projectId } = body;

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

    // Generate design based on message content
    const rawResponse = generateDesignFromMessage(message);
    const parsed = parseAIResponse(rawResponse);

    // Store assistant message
    const assistantMessage = await db.chatMessage.create({
      data: {
        projectId,
        role: 'assistant',
        content: parsed.message || 'I generated a design for you!',
        metadata: JSON.stringify({ designUpdate: parsed.design || null, tokensUsed: 0 }),
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
    });
  } catch (error) {
    console.error('[Chat API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to process chat message', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

function generateDesignFromMessage(userMessage: string): string {
  const msg = userMessage.toLowerCase();
  
  if (msg.includes('landing') || msg.includes('hero') || msg.includes('page') || msg.includes('website') || msg.includes('saas')) {
    return JSON.stringify({
      message: 'I created a landing page with a navigation bar, hero section, features grid, and call-to-action. You can customize it by telling me what to change!',
      design: {
        id: 'root', type: 'root', tag: 'div',
        style: { display: 'flex', flexDirection: 'column', minHeight: '100vh', width: '100%', fontFamily: 'Inter, system-ui, sans-serif' },
        meta: { name: 'Landing Page' },
        children: [
          { id: 'nav-1', type: 'nav', tag: 'nav', style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 32px', backgroundColor: '#ffffff', borderBottom: '1px solid #e5e7eb' }, meta: { name: 'Navigation' }, children: [
            { id: 'logo-1', type: 'text', tag: 'span', content: 'Z.Design', style: { fontSize: '20px', fontWeight: '700', color: '#10b981' } },
            { id: 'nav-links', type: 'flex', tag: 'div', style: { display: 'flex', gap: '24px', alignItems: 'center' }, children: [
              { id: 'nl1', type: 'link', tag: 'a', content: 'Features', style: { fontSize: '14px', color: '#6b7280', textDecoration: 'none' } },
              { id: 'nl2', type: 'link', tag: 'a', content: 'Pricing', style: { fontSize: '14px', color: '#6b7280', textDecoration: 'none' } },
              { id: 'nb1', type: 'button', tag: 'button', content: 'Get Started', style: { padding: '8px 20px', backgroundColor: '#10b981', color: '#ffffff', borderRadius: '8px', fontSize: '14px', fontWeight: '600', border: 'none', cursor: 'pointer' } }
            ]}
          ]},
          { id: 'hero-1', type: 'section', tag: 'section', style: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 32px', textAlign: 'center', backgroundColor: '#f0fdf4' }, meta: { name: 'Hero' }, children: [
            { id: 'hb1', type: 'badge', tag: 'span', content: '✨ AI-Powered Design', style: { padding: '6px 16px', backgroundColor: '#d1fae5', color: '#065f46', borderRadius: '20px', fontSize: '13px', fontWeight: '500', marginBottom: '24px' } },
            { id: 'hh1', type: 'heading', tag: 'h1', content: 'Design Beautiful Websites With AI', style: { fontSize: '48px', fontWeight: '800', lineHeight: '1.1', color: '#111827', maxWidth: '700px', marginBottom: '20px' } },
            { id: 'hp1', type: 'text', tag: 'p', content: 'Create stunning designs, prototypes, and websites through natural conversation. Powered by Z.ai.', style: { fontSize: '18px', color: '#6b7280', maxWidth: '500px', lineHeight: '1.6', marginBottom: '32px' } },
            { id: 'hbtns', type: 'flex', tag: 'div', style: { display: 'flex', gap: '12px' }, children: [
              { id: 'hb2', type: 'button', tag: 'button', content: 'Start Designing', style: { padding: '12px 28px', backgroundColor: '#10b981', color: '#ffffff', borderRadius: '10px', fontSize: '16px', fontWeight: '600', border: 'none', cursor: 'pointer', boxShadow: '0 4px 12px rgba(16,185,129,0.3)' } },
              { id: 'hb3', type: 'button', tag: 'button', content: 'View Templates', style: { padding: '12px 28px', backgroundColor: '#ffffff', color: '#374151', borderRadius: '10px', fontSize: '16px', fontWeight: '500', border: '1px solid #d1d5db', cursor: 'pointer' } }
            ]}
          ]},
          { id: 'feat-1', type: 'section', tag: 'section', style: { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '80px 32px', backgroundColor: '#ffffff' }, meta: { name: 'Features' }, children: [
            { id: 'fh2', type: 'heading', tag: 'h2', content: 'Powerful Features', style: { fontSize: '32px', fontWeight: '700', color: '#111827', marginBottom: '48px' } },
            { id: 'fgrid', type: 'grid', tag: 'div', style: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px', maxWidth: '960px', width: '100%' }, children: [
              { id: 'fc1', type: 'card', tag: 'div', style: { padding: '28px', borderRadius: '12px', border: '1px solid #e5e7eb' }, children: [
                { id: 'fi1', type: 'text', tag: 'div', content: '🎨', style: { fontSize: '28px', marginBottom: '12px' } },
                { id: 'fh3a', type: 'heading', tag: 'h3', content: 'AI Design Engine', style: { fontSize: '18px', fontWeight: '600', color: '#111827', marginBottom: '8px' } },
                { id: 'fp1', type: 'text', tag: 'p', content: 'Generate complete designs from natural language', style: { fontSize: '14px', color: '#6b7280', lineHeight: '1.5' } }
              ]},
              { id: 'fc2', type: 'card', tag: 'div', style: { padding: '28px', borderRadius: '12px', border: '1px solid #e5e7eb' }, children: [
                { id: 'fi2', type: 'text', tag: 'div', content: '🎤', style: { fontSize: '28px', marginBottom: '12px' } },
                { id: 'fh3b', type: 'heading', tag: 'h3', content: 'Voice Control', style: { fontSize: '18px', fontWeight: '600', color: '#111827', marginBottom: '8px' } },
                { id: 'fp2', type: 'text', tag: 'p', content: 'Design with your voice — speak and see changes', style: { fontSize: '14px', color: '#6b7280', lineHeight: '1.5' } }
              ]},
              { id: 'fc3', type: 'card', tag: 'div', style: { padding: '28px', borderRadius: '12px', border: '1px solid #e5e7eb' }, children: [
                { id: 'fi3', type: 'text', tag: 'div', content: '👥', style: { fontSize: '28px', marginBottom: '12px' } },
                { id: 'fh3c', type: 'heading', tag: 'h3', content: 'Real-time Collab', style: { fontSize: '18px', fontWeight: '600', color: '#111827', marginBottom: '8px' } },
                { id: 'fp3', type: 'text', tag: 'p', content: 'Work together with your team in real-time', style: { fontSize: '14px', color: '#6b7280', lineHeight: '1.5' } }
              ]}
            ]}
          ]},
          { id: 'cta-1', type: 'section', tag: 'section', style: { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '64px 32px', backgroundColor: '#10b981' }, children: [
            { id: 'ch2', type: 'heading', tag: 'h2', content: 'Ready to Start Designing?', style: { fontSize: '32px', fontWeight: '700', color: '#ffffff', marginBottom: '12px' } },
            { id: 'cp1', type: 'text', tag: 'p', content: 'Join thousands who use Z.Design to create faster.', style: { fontSize: '16px', color: '#d1fae5', marginBottom: '24px' } },
            { id: 'cb1', type: 'button', tag: 'button', content: 'Get Started Free', style: { padding: '12px 32px', backgroundColor: '#ffffff', color: '#10b981', borderRadius: '10px', fontSize: '16px', fontWeight: '600', border: 'none', cursor: 'pointer' } }
          ]},
          { id: 'footer-1', type: 'footer', tag: 'footer', style: { display: 'flex', justifyContent: 'center', padding: '24px 32px', backgroundColor: '#111827' }, children: [
            { id: 'ft1', type: 'text', tag: 'p', content: '© 2026 Z.Design — AI-Powered Visual Design Platform', style: { color: '#9ca3af', fontSize: '14px' } }
          ]}
        ]
      }
    });
  }

  if (msg.includes('dashboard') || msg.includes('analytics') || msg.includes('admin')) {
    return JSON.stringify({
      message: 'I created a dashboard layout with a sidebar, metric cards, and a chart area. Tell me what data you want to display!',
      design: {
        id: 'root', type: 'root', tag: 'div',
        style: { display: 'flex', minHeight: '100vh', width: '100%', fontFamily: 'Inter, system-ui, sans-serif' },
        meta: { name: 'Dashboard' },
        children: [
          { id: 'sb1', type: 'sidebar', tag: 'aside', style: { width: '240px', minHeight: '100vh', backgroundColor: '#111827', padding: '24px 16px', display: 'flex', flexDirection: 'column' }, children: [
            { id: 'sbl', type: 'text', tag: 'div', content: '📊 Dashboard', style: { fontSize: '18px', fontWeight: '700', color: '#10b981', marginBottom: '32px', padding: '0 8px' } },
            { id: 'sbi1', type: 'text', tag: 'div', content: '📈 Overview', style: { padding: '10px 12px', borderRadius: '8px', backgroundColor: '#1f2937', color: '#10b981', fontSize: '14px', marginBottom: '4px' } },
            { id: 'sbi2', type: 'text', tag: 'div', content: '📋 Projects', style: { padding: '10px 12px', borderRadius: '8px', color: '#9ca3af', fontSize: '14px', marginBottom: '4px' } },
            { id: 'sbi3', type: 'text', tag: 'div', content: '👥 Team', style: { padding: '10px 12px', borderRadius: '8px', color: '#9ca3af', fontSize: '14px', marginBottom: '4px' } },
            { id: 'sbi4', type: 'text', tag: 'div', content: '⚙️ Settings', style: { padding: '10px 12px', borderRadius: '8px', color: '#9ca3af', fontSize: '14px' } }
          ]},
          { id: 'main1', type: 'container', tag: 'main', style: { flex: '1', padding: '32px', backgroundColor: '#f9fafb', display: 'flex', flexDirection: 'column', gap: '24px' }, children: [
            { id: 'mh1', type: 'heading', tag: 'h1', content: 'Dashboard', style: { fontSize: '24px', fontWeight: '700', color: '#111827' } },
            { id: 'mgrid', type: 'grid', tag: 'div', style: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }, children: [
              { id: 'mc1', type: 'card', tag: 'div', style: { padding: '20px', borderRadius: '12px', backgroundColor: '#ffffff', border: '1px solid #e5e7eb' }, children: [
                { id: 'ml1', type: 'text', tag: 'p', content: 'Total Users', style: { fontSize: '13px', color: '#6b7280', marginBottom: '4px' } },
                { id: 'mv1', type: 'heading', tag: 'h3', content: '12,345', style: { fontSize: '28px', fontWeight: '700', color: '#111827' } },
                { id: 'mc1c', type: 'text', tag: 'span', content: '↑ 12.5%', style: { fontSize: '13px', color: '#10b981' } }
              ]},
              { id: 'mc2', type: 'card', tag: 'div', style: { padding: '20px', borderRadius: '12px', backgroundColor: '#ffffff', border: '1px solid #e5e7eb' }, children: [
                { id: 'ml2', type: 'text', tag: 'p', content: 'Revenue', style: { fontSize: '13px', color: '#6b7280', marginBottom: '4px' } },
                { id: 'mv2', type: 'heading', tag: 'h3', content: '$48.2K', style: { fontSize: '28px', fontWeight: '700', color: '#111827' } },
                { id: 'mc2c', type: 'text', tag: 'span', content: '↑ 8.1%', style: { fontSize: '13px', color: '#10b981' } }
              ]},
              { id: 'mc3', type: 'card', tag: 'div', style: { padding: '20px', borderRadius: '12px', backgroundColor: '#ffffff', border: '1px solid #e5e7eb' }, children: [
                { id: 'ml3', type: 'text', tag: 'p', content: 'Active Now', style: { fontSize: '13px', color: '#6b7280', marginBottom: '4px' } },
                { id: 'mv3', type: 'heading', tag: 'h3', content: '573', style: { fontSize: '28px', fontWeight: '700', color: '#111827' } },
                { id: 'mc3c', type: 'text', tag: 'span', content: '↑ 2.4%', style: { fontSize: '13px', color: '#10b981' } }
              ]},
              { id: 'mc4', type: 'card', tag: 'div', style: { padding: '20px', borderRadius: '12px', backgroundColor: '#ffffff', border: '1px solid #e5e7eb' }, children: [
                { id: 'ml4', type: 'text', tag: 'p', content: 'Conversion', style: { fontSize: '13px', color: '#6b7280', marginBottom: '4px' } },
                { id: 'mv4', type: 'heading', tag: 'h3', content: '3.2%', style: { fontSize: '28px', fontWeight: '700', color: '#111827' } },
                { id: 'mc4c', type: 'text', tag: 'span', content: '↓ 0.4%', style: { fontSize: '13px', color: '#ef4444' } }
              ]}
            ]},
            { id: 'chart1', type: 'card', tag: 'div', style: { padding: '24px', borderRadius: '12px', backgroundColor: '#ffffff', border: '1px solid #e5e7eb', minHeight: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center' }, children: [
              { id: 'cp1', type: 'text', tag: 'p', content: '📊 Chart Area — Ask me to add specific charts!', style: { color: '#9ca3af', fontSize: '16px' } }
            ]}
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
      style: { display: 'flex', flexDirection: 'column', minHeight: '100vh', width: '100%', fontFamily: 'Inter, system-ui, sans-serif' },
      meta: { name: 'Custom Design' },
      children: [
        { id: 'hdr1', type: 'header', tag: 'header', style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 32px', borderBottom: '1px solid #e5e7eb' }, children: [
          { id: 'hl1', type: 'text', tag: 'span', content: 'Z.Design', style: { fontSize: '20px', fontWeight: '700', color: '#10b981' } },
          { id: 'hb1', type: 'button', tag: 'button', content: 'Get Started', style: { padding: '8px 20px', backgroundColor: '#10b981', color: '#ffffff', borderRadius: '8px', fontSize: '14px', fontWeight: '600', border: 'none', cursor: 'pointer' } }
        ]},
        { id: 'sec1', type: 'section', tag: 'section', style: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: '1', padding: '64px 32px', textAlign: 'center' }, children: [
          { id: 'sh1', type: 'heading', tag: 'h1', content: 'Your Design Starts Here', style: { fontSize: '40px', fontWeight: '800', color: '#111827', marginBottom: '16px' } },
          { id: 'sp1', type: 'text', tag: 'p', content: 'Tell me more about what you want and I\'ll customize this for you!', style: { fontSize: '18px', color: '#6b7280', maxWidth: '500px', lineHeight: '1.6', marginBottom: '24px' } },
          { id: 'sb1', type: 'button', tag: 'button', content: 'Customize', style: { padding: '12px 28px', backgroundColor: '#10b981', color: '#ffffff', borderRadius: '10px', fontSize: '16px', fontWeight: '600', border: 'none', cursor: 'pointer' } }
        ]},
        { id: 'ftr1', type: 'footer', tag: 'footer', style: { display: 'flex', justifyContent: 'center', padding: '24px', backgroundColor: '#f9fafb', borderTop: '1px solid #e5e7eb' }, children: [
          { id: 'ft1', type: 'text', tag: 'p', content: '© 2026 Z.Design — AI-Powered Visual Design Platform', style: { color: '#9ca3af', fontSize: '14px' } }
        ]}
      ]
    }
  });
}

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
