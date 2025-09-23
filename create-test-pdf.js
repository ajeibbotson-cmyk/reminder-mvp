const fs = require('fs');

// Create a proper PDF with text content that can be parsed
const pdfContent = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>
endobj
4 0 obj
<< /Length 280 >>
stream
BT
/F1 12 Tf
50 700 Td
(Invoice Number: INV-2024-001) Tj
0 -20 Td
(Date: 2024-01-15) Tj
0 -20 Td
(Customer: ABC Trading LLC) Tj
0 -20 Td
(Email: billing@abctrading.ae) Tj
0 -20 Td
(Amount: AED 1500.00) Tj
0 -20 Td
(VAT: AED 75.00) Tj
0 -20 Td
(Total: AED 1575.00) Tj
0 -20 Td
(Due Date: 2024-02-15) Tj
0 -20 Td
(TRN: 123456789012345) Tj
ET
endstream
endobj
5 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
xref
0 6
0000000000 65535 f
0000000009 00000 n
0000000058 00000 n
0000000115 00000 n
0000000270 00000 n
0000000602 00000 n
trailer
<< /Size 6 /Root 1 0 R >>
startxref
671
%%EOF`;

fs.writeFileSync('/Users/ibbs/Development/reminder-mvp/test-invoice.pdf', pdfContent);
console.log('Test PDF with invoice content created');