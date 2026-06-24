// Z.Design - PDF Export Integration Tests
// Basic integration tests for PDF generation

import { describe, it, expect, beforeAll } from 'bun:test';
import { generatePDF, validatePDFEnvironment, estimatePDFGenerationTime } from '../pdf-generator';

describe('PDF Export Integration', () => {
  let environmentValid = false;

  beforeAll(async () => {
    const validation = await validatePDFEnvironment();
    environmentValid = validation.valid;
    if (!environmentValid) {
      console.warn('PDF environment not valid, skipping PDF generation tests');
    }
  });

  describe('Environment', () => {
    it('should have valid PDF environment', async () => {
      const validation = await validatePDFEnvironment();
      expect(validation.valid).toBe(true);
    });
  });

  describe('Basic PDF Generation', () => {
    const simpleDesignJSON = JSON.stringify({
      id: 'root',
      type: 'root',
      tag: 'div',
      children: [
        {
          id: 'heading-1',
          type: 'heading',
          tag: 'h1',
          content: 'Test Design',
          style: {
            fontSize: '32px',
            fontWeight: 'bold',
            color: '#0f172a',
          },
        },
        {
          id: 'text-1',
          type: 'text',
          tag: 'p',
          content: 'This is a test design for PDF export.',
          style: {
            fontSize: '16px',
            lineHeight: '1.5',
          },
        },
      ],
    });

    it('should generate a basic PDF', async () => {
      if (!environmentValid) {
        console.warn('Skipping test - PDF environment not valid');
        return;
      }

      const result = await generatePDF(simpleDesignJSON, 'Test Design', {
        format: 'A4',
        orientation: 'portrait',
      });

      expect(result.success).toBe(true);
      expect(result.pdfBuffer).toBeDefined();
      expect(result.pdfBuffer!.length).toBeGreaterThan(0);
    });

    it('should generate PDF with metadata', async () => {
      if (!environmentValid) {
        console.warn('Skipping test - PDF environment not valid');
        return;
      }

      const result = await generatePDF(simpleDesignJSON, 'Metadata Test', {
        format: 'A4',
        orientation: 'portrait',
      });

      expect(result.success).toBe(true);
      expect(result.metadata).toBeDefined();
      expect(result.metadata!.title).toBe('Metadata Test');
      expect(result.metadata!.pages).toBeGreaterThan(0);
      expect(result.metadata!.size).toBeGreaterThan(0);
    });
  });

  describe('Performance', () => {
    it('should estimate generation time accurately', () => {
      const simpleDesign = JSON.stringify({
        id: 'root',
        type: 'root',
        tag: 'div',
        children: [
          { id: '1', type: 'text', tag: 'p', content: 'Hello' },
        ],
      });

      const estimatedTime = estimatePDFGenerationTime(simpleDesign);
      expect(estimatedTime).toBeGreaterThan(0);
      expect(estimatedTime).toBeLessThan(10000); // Under 10s
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid JSON gracefully', async () => {
      if (!environmentValid) {
        console.warn('Skipping test - PDF environment not valid');
        return;
      }

      const result = await generatePDF('{invalid json}', 'Invalid Design', {});

      // Should still succeed with fallback empty design
      expect(result.success).toBe(true);
      expect(result.pdfBuffer).toBeDefined();
    });

    it('should handle empty designs', async () => {
      if (!environmentValid) {
        console.warn('Skipping test - PDF environment not valid');
        return;
      }

      const emptyDesign = JSON.stringify({
        id: 'root',
        type: 'root',
        tag: 'div',
        children: [],
      });

      const result = await generatePDF(emptyDesign, 'Empty Design', {});
      expect(result.success).toBe(true);
      expect(result.pdfBuffer).toBeDefined();
    });
  });
});