const fs = require('fs');

async function testPDFAPI() {
  try {
    console.log('🧪 Testing PDF Upload API directly...\n');

    // Read the PDF file
    const pdfPath = '/Users/ibbs/Downloads/Above The Clouds AW25 Drop-1.pdf';
    const fileBuffer = fs.readFileSync(pdfPath);

    // Create FormData
    const formData = new FormData();
    const file = new File([fileBuffer], 'Above The Clouds AW25 Drop-1.pdf', {
      type: 'application/pdf'
    });
    formData.append('file', file);

    console.log('📤 Sending POST request to PDF API...');

    // Test the API endpoint directly
    const response = await fetch('http://localhost:3001/api/invoices/upload-pdf', {
      method: 'POST',
      body: formData,
      headers: {
        // Note: We'd need session cookie here for auth
        'Cookie': 'next-auth.session-token=your-session-token-here'
      }
    });

    console.log('📊 Response Status:', response.status);
    console.log('📊 Response Headers:', Object.fromEntries(response.headers.entries()));

    if (response.ok) {
      const result = await response.json();
      console.log('✅ Success:', JSON.stringify(result, null, 2));
    } else {
      const error = await response.text();
      console.log('❌ Error:', error);
    }

  } catch (error) {
    console.error('💥 Test failed:', error);
  }
}

// Run in browser environment only
if (typeof window !== 'undefined') {
  testPDFAPI();
} else {
  console.log('This test needs to run in a browser environment with fetch and FormData');
}