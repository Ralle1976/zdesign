// Z.Design - API Health Check & Root Route

import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    name: 'Z.Design API',
    version: '1.0.0',
    description: 'AI-Powered Visual Design Platform',
    status: 'healthy',
    endpoints: {
      chat: '/api/chat',
      designGenerate: '/api/design/generate',
      designAnalyze: '/api/design/analyze',
      projects: '/api/projects',
      project: '/api/projects/[id]',
      designSystems: '/api/design-systems',
      designSystem: '/api/design-systems/[id]',
      export: '/api/export',
      templates: '/api/templates',
    },
    timestamp: new Date().toISOString(),
  });
}
