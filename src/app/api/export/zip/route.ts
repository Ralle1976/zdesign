// Z.Design - ZIP Export API Route
// Returns a real binary ZIP archive (index.html + styles.css + assets/ + README.md).

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  generateZIP,
  validateZIPEnvironment,
  estimateZIPGenerationTime,
} from '@/lib/export/zip-generator';

interface ZIPRequestBody {
  projectId: string;
  includeAssets?: boolean;
  includeREADME?: boolean;
  includeDesignJSON?: boolean;
}

function safeFileName(name: string): string {
  return name.replace(/\s+/g, '-').toLowerCase();
}

export async function POST(request: NextRequest) {
  try {
    const body: ZIPRequestBody = await request.json();
    const { projectId, includeAssets, includeREADME, includeDesignJSON } = body;

    if (!projectId || typeof projectId !== 'string') {
      return NextResponse.json(
        { error: 'projectId is required' },
        { status: 400 }
      );
    }

    // Fetch the project
    const project = await db.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    console.log('[ZIP Export API] Generating real ZIP archive...');

    const estimatedTime = estimateZIPGenerationTime(project.designJSON);
    console.log(`[ZIP Export API] Estimated generation time: ${estimatedTime}ms`);

    const zipResult = await generateZIP(project.designJSON, project.name, {
      includeAssets: includeAssets !== false,
      includeREADME: includeREADME !== false,
      includeDesignJSON: includeDesignJSON !== false,
    });

    if (!zipResult.success || !zipResult.zipBuffer) {
      console.error('[ZIP Export API] ZIP generation failed:', zipResult.error);
      return NextResponse.json(
        {
          error: 'ZIP generation failed',
          details: zipResult.error || 'Unknown error',
        },
        { status: 500 }
      );
    }

    console.log('[ZIP Export API] ZIP generated successfully:', zipResult.metadata);

    // Convert Buffer to Uint8Array view for NextResponse BodyInit compatibility.
    const zipBytes = new Uint8Array(zipResult.zipBuffer);

    return new NextResponse(zipBytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${safeFileName(project.name)}.zip"`,
        'Content-Length': zipBytes.length.toString(),
        'X-Export-Format': 'zip',
        'X-Export-Version': '1.0.0',
        'X-ZIP-Files': (zipResult.metadata?.fileCount ?? 0).toString(),
        'X-ZIP-Size': (zipResult.metadata?.size ?? 0).toString(),
        'X-ZIP-Generated-At': zipResult.metadata?.generatedAt || new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('[ZIP Export API] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to export design',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * Health check — confirms jszip runtime is available.
 */
export async function GET() {
  try {
    const validation = await validateZIPEnvironment();

    if (validation.valid) {
      return NextResponse.json({
        status: 'healthy',
        zipGeneration: 'ready',
        message: 'ZIP generation environment is properly configured',
        timestamp: new Date().toISOString(),
      });
    }

    return NextResponse.json(
      {
        status: 'unhealthy',
        zipGeneration: 'unavailable',
        message: 'ZIP generation environment is not properly configured',
        error: validation.error,
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  } catch (error) {
    console.error('[ZIP Health Check] Error:', error);
    return NextResponse.json(
      {
        status: 'error',
        zipGeneration: 'unknown',
        message: 'Failed to validate ZIP environment',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
