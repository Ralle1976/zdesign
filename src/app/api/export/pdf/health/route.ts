// Z.Design - PDF Export Health Check API
// Validates PDF generation environment and prerequisites

import { NextResponse } from 'next/server';
import { validatePDFEnvironment } from '@/lib/export/pdf-generator';

export async function GET() {
  try {
    const validationResult = await validatePDFEnvironment();

    if (validationResult.valid) {
      return NextResponse.json({
        status: 'healthy',
        pdfGeneration: 'ready',
        message: 'PDF generation environment is properly configured',
        timestamp: new Date().toISOString(),
      });
    } else {
      return NextResponse.json({
        status: 'unhealthy',
        pdfGeneration: 'unavailable',
        message: 'PDF generation environment is not properly configured',
        error: validationResult.error,
        timestamp: new Date().toISOString(),
      }, { status: 503 });
    }
  } catch (error) {
    console.error('[PDF Health Check] Error:', error);
    return NextResponse.json({
      status: 'error',
      pdfGeneration: 'unknown',
      message: 'Failed to validate PDF environment',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}