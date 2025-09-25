# AWS Textract Setup Guide for PDF Smart Reconciliation

## Overview

This guide walks you through setting up AWS Textract for high-accuracy PDF invoice extraction in the Reminder payment collection platform.

## Prerequisites

- AWS Account with billing enabled
- Administrative access to AWS console
- Development environment with Node.js and npm

## Step 1: AWS Account Setup

### 1.1 Create AWS IAM User for Textract

1. Log into AWS Console
2. Navigate to IAM → Users
3. Click "Create user"
4. User name: `reminder-textract-user`
5. Select "Programmatic access" (for API keys)

### 1.2 Create IAM Policy for Textract

Create a custom policy with these permissions:

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "textract:AnalyzeDocument",
                "textract:AnalyzeExpense",
                "textract:DetectDocumentText"
            ],
            "Resource": "*"
        }
    ]
}
```

**Policy Name**: `Reminder-Textract-Policy`

### 1.3 Attach Policy to User

1. Go to IAM → Users → `reminder-textract-user`
2. Click "Add permissions" → "Attach policies directly"
3. Search for `Reminder-Textract-Policy` and attach it

### 1.4 Generate Access Keys

1. In user details, go to "Security credentials" tab
2. Click "Create access key"
3. Choose "Application running outside AWS"
4. Save both:
   - **Access Key ID**: `AKIAXXXXXXXXXXXXXXXX`
   - **Secret Access Key**: `xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

## Step 2: Environment Configuration

### 2.1 Update .env File

Add these variables to your `.env.local` file:

```bash
# AWS Textract Configuration
AWS_ACCESS_KEY_ID=AKIAXXXXXXXXXXXXXXXX
AWS_SECRET_ACCESS_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
AWS_REGION=me-south-1
AWS_TEXTRACT_ENABLED=true

# Optional: Fallback configuration
PDF_EXTRACTION_METHOD=textract
TEXTRACT_FALLBACK_ENABLED=true
```

### 2.2 Regional Considerations

**Recommended Region**: `me-south-1` (Middle East - Bahrain)
- Closest to UAE for low latency
- Data residency compliance
- Supports all Textract features

**Alternative Regions** (if me-south-1 unavailable):
- `eu-west-1` (Ireland)
- `us-east-1` (N. Virginia)

## Step 3: Test Configuration

### 3.1 Verify AWS Connection

Run the test script to verify your credentials:

```bash
node scripts/test-aws-textract-connection.js
```

### 3.2 Test with Sample Invoice

Upload a PDF through the reconciliation interface to test:

1. Start development server: `npm run dev`
2. Navigate to: `http://localhost:3000/dashboard/invoices/import`
3. Upload your "Above The Clouds" PDF
4. Check console logs for Textract processing

## Step 4: Cost Management

### 4.1 Textract Pricing (as of 2024)

**AnalyzeExpense** (recommended for invoices):
- $0.05 per page processed
- Optimized for invoices, receipts, forms
- Returns key-value pairs and tables

**AnalyzeDocument** (fallback):
- $0.015 per page for text detection
- $0.05 per page for table/form detection

### 4.2 Cost Estimation

For typical usage:
- 100 invoices/month = ~$5/month
- 500 invoices/month = ~$25/month
- 1000 invoices/month = ~$50/month

### 4.3 Set Up Billing Alerts

1. Go to AWS Billing Dashboard
2. Set up budget alert for $10-50/month threshold
3. Enable cost anomaly detection

## Step 5: Production Configuration

### 5.1 Security Best Practices

1. **Rotate Keys Regularly**: Every 90 days
2. **Use IAM Roles**: In production, prefer IAM roles over access keys
3. **Monitor Usage**: Set up CloudWatch alerts
4. **Least Privilege**: Only grant necessary permissions

### 5.2 Environment Variables for Production

```bash
# Production .env
AWS_ACCESS_KEY_ID=${TEXTRACT_ACCESS_KEY}
AWS_SECRET_ACCESS_KEY=${TEXTRACT_SECRET_KEY}
AWS_REGION=me-south-1
AWS_TEXTRACT_ENABLED=true

# Additional production settings
TEXTRACT_MAX_FILE_SIZE=10485760  # 10MB limit
TEXTRACT_TIMEOUT=30000           # 30 second timeout
TEXTRACT_RETRY_ATTEMPTS=3        # Retry failed requests
```

## Step 6: Monitoring and Troubleshooting

### 6.1 Common Issues

**Issue**: "AccessDenied" error
**Solution**: Verify IAM policy includes `textract:AnalyzeExpense`

**Issue**: "ServiceUnavailable" in me-south-1
**Solution**: Switch to `eu-west-1` or `us-east-1`

**Issue**: "File too large" error
**Solution**: Compress PDFs or implement file size validation

### 6.2 Debug Logs

Enable detailed logging in development:

```typescript
// In aws-textract-service.ts
console.log('🔍 Textract Request:', {
  region: this.region,
  fileSize: buffer.length,
  pages: 'detecting...'
});
```

### 6.3 Performance Monitoring

Track key metrics:
- **Processing Time**: Aim for <5 seconds per page
- **Success Rate**: Target >95% successful extractions
- **Cost per Invoice**: Monitor monthly spend

## Step 7: Testing Validation

### Expected Results for "Above The Clouds" Invoice

With Textract properly configured, you should extract:

✅ **Successfully Extracted Fields**:
- Customer Name: "Above The Clouds"
- Invoice Number: "V01250703"
- Currency: "EUR"
- Invoice Date: "07/15/2025"
- Payment Terms: "within 30 days"

✅ **Amount Fields**:
- Total Amount: "7978"
- Outstanding Amount: "5368.60"
- Paid Amount: "2609.40"

✅ **Confidence Scores**:
- Key fields should have >90% confidence
- Table data should have >85% confidence
- Text extraction should have >95% confidence

### Validation Checklist

- [ ] AWS credentials configured and tested
- [ ] Textract permissions granted
- [ ] Environment variables set
- [ ] Development server running
- [ ] Test PDF processed successfully
- [ ] All expected fields extracted
- [ ] Confidence scores meet thresholds
- [ ] Fallback to pdf-parse works if Textract fails

## Step 8: Go Live

Once testing is complete:

1. **Update Production Environment**: Deploy with AWS credentials
2. **Monitor First Week**: Check logs and billing
3. **User Training**: Train staff on reconciliation interface
4. **Feedback Loop**: Collect accuracy feedback from users

## Support and Resources

### AWS Documentation
- [Textract Developer Guide](https://docs.aws.amazon.com/textract/)
- [AnalyzeExpense API Reference](https://docs.aws.amazon.com/textract/latest/dg/API_AnalyzeExpense.html)

### Reminder-Specific Support
- Check `src/lib/services/aws-textract-service.ts` for implementation
- Review `src/app/api/pdf/extract-invoice/route.ts` for API integration
- Test with `scripts/test-advanced-pdf-parsers.js` for comparison

---

## Next Steps

After completing this setup:
1. Test extraction accuracy with real invoices
2. Fine-tune confidence thresholds based on results
3. Train users on the reconciliation interface
4. Monitor costs and performance in production

**Questions or Issues?** Check the troubleshooting section or review the AWS Textract service logs.