#!/usr/bin/env bun
// Z.Design - PDF Export Manual Test
// Tests the PDF export functionality with a real API call

const testDesignJSON = JSON.stringify({
  id: 'root',
  type: 'root',
  tag: 'div',
  children: [
    {
      id: 'heading-1',
      type: 'heading',
      tag: 'h1',
      content: 'PDF Export Test',
      style: {
        fontSize: '48px',
        fontWeight: 'bold',
        color: '#0f172a',
        marginBottom: '24px',
        textAlign: 'center',
      },
    },
    {
      id: 'text-1',
      type: 'text',
      tag: 'p',
      content: 'This is a test of the real PDF export functionality for Z.Design.',
      style: {
        fontSize: '18px',
        lineHeight: '1.6',
        color: '#334155',
        marginBottom: '16px',
      },
    },
    {
      id: 'button-1',
      type: 'button',
      tag: 'button',
      content: 'Test Button',
      style: {
        fontSize: '16px',
        padding: '12px 24px',
        backgroundColor: '#10b981',
        color: '#ffffff',
        border: 'none',
        borderRadius: '8px',
        cursor: 'pointer',
        marginBottom: '24px',
      },
    },
    {
      id: 'section-1',
      type: 'div',
      tag: 'div',
      children: [
        {
          id: 'heading-2',
          type: 'heading',
          tag: 'h2',
          content: 'Features Tested',
          style: {
            fontSize: '32px',
            fontWeight: '600',
            color: '#0f172a',
            marginBottom: '16px',
          },
        },
        {
          id: 'text-2',
          type: 'text',
          tag: 'p',
          content: '✅ Real PDF generation with Puppeteer\n✅ Proper CSS styling and fonts\n✅ Image and color support\n✅ Page layout and formatting',
          style: {
            fontSize: '16px',
            lineHeight: '1.6',
            color: '#475569',
            marginBottom: '16px',
          },
        },
      ],
      style: {
        padding: '24px',
        backgroundColor: '#f8fafc',
        borderRadius: '8px',
        marginBottom: '24px',
      },
    },
  ],
});

async function testPDFExport() {
  console.log('🚀 Starting PDF Export Test...\n');

  try {
    console.log('📤 Sending request to PDF export API...');
    const response = await fetch('http://localhost:3000/api/export', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        projectId: 'test-project-123',
        format: 'pdf',
      }),
    });

    console.log(`📊 Response status: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Export failed:', errorText);
      return;
    }

    // Check content type
    const contentType = response.headers.get('Content-Type');
    console.log(`📋 Content-Type: ${contentType}`);

    if (contentType?.includes('application/pdf')) {
      console.log('✅ Real PDF generated successfully!');

      // Get PDF metadata from headers
      const pdfPages = response.headers.get('X-PDF-Pages');
      const pdfSize = response.headers.get('X-PDF-Size');
      const generatedAt = response.headers.get('X-PDF-Generated-At');

      console.log('\n📄 PDF Metadata:');
      console.log(`   - Pages: ${pdfPages}`);
      console.log(`   - Size: ${pdfSize} bytes (${(Number(pdfSize) / 1024).toFixed(2)} KB)`);
      console.log(`   - Generated: ${generatedAt}`);

      // Save PDF to file
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const filename = 'test-export.pdf';

      await Bun.write(filename, buffer);
      console.log(`\n💾 PDF saved to: ${filename}`);
      console.log(`📁 File size: ${(buffer.length / 1024).toFixed(2)} KB`);

      console.log('\n✅ Test completed successfully!');
    } else if (contentType?.includes('text/html')) {
      console.log('⚠️  Fallback to HTML (PDF generation failed)');
      console.log('Error:', response.headers.get('X-PDF-Error'));

      const html = await response.text();
      const filename = 'test-export-fallback.html';
      await Bun.write(filename, html);
      console.log(`📄 HTML fallback saved to: ${filename}`);
    }
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testPDFExport().catch(console.error);