// Z.Design - PDF Export Generator Tests
// Tests for real PDF generation functionality

import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { generatePDF, validatePDFEnvironment, estimatePDFGenerationTime } from '../pdf-generator';

describe('PDF Generator', () => {
  describe('Environment Validation', () => {
    it('should validate PDF environment successfully', async () => {
      const result = await validatePDFEnvironment();
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });
  });

  describe('PDF Generation', () => {
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

    it('should generate PDF successfully', async () => {
      const result = await generatePDF(simpleDesignJSON, 'Test Design', {
        format: 'A4',
        orientation: 'portrait',
        margin: {
          top: '20px',
          right: '20px',
          bottom: '20px',
          left: '20px',
        },
      });

      expect(result.success).toBe(true);
      expect(result.pdfBuffer).toBeDefined();
      expect(result.pdfBuffer!.length).toBeGreaterThan(0);
      expect(result.metadata).toBeDefined();
      expect(result.metadata!.title).toBe('Test Design');
      expect(result.metadata!.pages).toBeGreaterThan(0);
    });

    it('should handle complex designs with multiple elements', async () => {
      const complexDesignJSON = JSON.stringify({
        id: 'root',
        type: 'root',
        tag: 'div',
        children: Array.from({ length: 50 }, (_, i) => ({
          id: `element-${i}`,
          type: i % 2 === 0 ? 'heading' : 'text',
          tag: i % 2 === 0 ? 'h2' : 'p',
          content: `Element ${i + 1}`,
          style: {
            fontSize: i % 2 === 0 ? '24px' : '16px',
            marginBottom: '16px',
          },
        })),
      });

      const result = await generatePDF(complexDesignJSON, 'Complex Design', {
        format: 'A4',
        orientation: 'portrait',
      });

      expect(result.success).toBe(true);
      expect(result.pdfBuffer).toBeDefined();
      expect(result.metadata!.pages).toBeGreaterThan(1);
    });

    it('should handle invalid JSON gracefully', async () => {
      const result = await generatePDF('{invalid json}', 'Invalid Design', {});

      // Should still succeed with fallback empty design
      expect(result.success).toBe(true);
      expect(result.pdfBuffer).toBeDefined();
    });

    it('should support different page formats', async () => {
      // Test a subset of formats to avoid timeout
      const formats: Array<'A4' | 'Letter' | 'Legal'> = ['A4', 'Letter', 'Legal'];

      for (const format of formats) {
        const result = await generatePDF(simpleDesignJSON, `Test ${format}`, {
          format,
          orientation: 'portrait',
        });

        expect(result.success).toBe(true);
        expect(result.pdfBuffer).toBeDefined();
      }
    });

    it('should support landscape orientation', async () => {
      const result = await generatePDF(simpleDesignJSON, 'Landscape Design', {
        format: 'A4',
        orientation: 'landscape',
      });

      expect(result.success).toBe(true);
      expect(result.pdfBuffer).toBeDefined();
    });
  });

  describe('Performance Estimation', () => {
    it('should estimate generation time for simple designs', () => {
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
      expect(estimatedTime).toBeLessThan(10000); // Should be under 10s
    });

    it('should estimate generation time for complex designs', () => {
      const complexDesign = JSON.stringify({
        id: 'root',
        type: 'root',
        tag: 'div',
        children: Array.from({ length: 100 }, (_, i) => ({
          id: `el-${i}`,
          type: 'text',
          tag: 'p',
          content: `Element ${i}`,
        })),
      });

      const estimatedTime = estimatePDFGenerationTime(complexDesign);
      expect(estimatedTime).toBeGreaterThan(2000);
      expect(estimatedTime).toBeLessThanOrEqual(10000); // Should cap at 10s
    });

    it('should handle invalid JSON for estimation', () => {
      const estimatedTime = estimatePDFGenerationTime('{invalid}');
      expect(estimatedTime).toBe(5000); // Should default to 5s
    });
  });

  describe('Error Handling', () => {
    it('should handle empty designs gracefully', async () => {
      const result = await generatePDF(JSON.stringify({
        id: 'root',
        type: 'root',
        tag: 'div',
        children: [],
      }), 'Empty Design', {});

      expect(result.success).toBe(true);
      expect(result.pdfBuffer).toBeDefined();
    });

    it('should handle special characters in content', async () => {
      const specialDesign = JSON.stringify({
        id: 'root',
        type: 'root',
        tag: 'div',
        children: [
          {
            id: 'special',
            type: 'text',
            tag: 'p',
            content: 'Special chars: <>&"\'🚀',
          },
        ],
      });

      const result = await generatePDF(specialDesign, 'Special Chars', {});
      expect(result.success).toBe(true);
      expect(result.pdfBuffer).toBeDefined();
    });
  });
});