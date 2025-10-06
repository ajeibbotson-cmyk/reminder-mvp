# AWS Setup for Textract Async PDF Extraction

## Required AWS Services

1. **AWS Textract** - Multi-page PDF text detection
2. **AWS S3** - Temporary PDF storage for Textract processing
3. **IAM User** - Credentials with proper permissions

## S3 Bucket Setup

### Create Bucket

1. Go to AWS Console → S3
2. Click "Create bucket"
3. Enter bucket name: `reminder-mvp-textract-pdfs`
4. Select region: `us-east-1` (same as Textract)
5. **Block Public Access**: Keep all enabled (bucket is private)
6. Click "Create bucket"

### Configure Lifecycle Policy (Optional - Auto-cleanup)

To automatically delete PDFs after 1 day:

1. Go to bucket → Management tab
2. Create lifecycle rule:
   - Rule name: "Auto-delete processed PDFs"
   - Apply to all objects
   - Expire current versions after: **1 day**
3. Save

## IAM Permissions Required

The IAM user needs these permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "TextractAccess",
      "Effect": "Allow",
      "Action": [
        "textract:StartDocumentTextDetection",
        "textract:GetDocumentTextDetection"
      ],
      "Resource": "*"
    },
    {
      "Sid": "S3BucketAccess",
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject"
      ],
      "Resource": "arn:aws:s3:::reminder-mvp-textract-pdfs/*"
    }
  ]
}
```

### Update IAM User Policy

1. Go to IAM → Users → `useReminder`
2. Add permissions → Attach policies directly
3. Create inline policy with the JSON above
4. Name it: `TextractS3Access`
5. Save

## Environment Variables

Add to `.env`:

```bash
# AWS Textract Configuration
AWS_TEXTRACT_ENABLED="true"
PDF_EXTRACTION_METHOD="textract"
TEXTRACT_FALLBACK_ENABLED="true"
AWS_S3_BUCKET_NAME="reminder-mvp-textract-pdfs"
AWS_S3_REGION="us-east-1"
```

## Testing

After setup, test with:

```bash
# Upload a test PDF via the app
# Check S3 bucket for temporary files
# Verify Textract job completion
# Confirm automatic S3 cleanup
```

## Cost Estimates

- **Textract**: $1.50 per 1,000 pages
- **S3 Storage**: $0.023 per GB/month (minimal with auto-delete)
- **S3 Requests**: PUT/GET operations negligible cost

For 400 invoices (avg 2 pages each):
- 800 pages × $0.0015 = **$1.20 per upload**
- Seasonal cost (4 uploads/year): **~$5/year**
