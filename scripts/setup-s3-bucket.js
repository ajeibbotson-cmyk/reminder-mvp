#!/usr/bin/env node

/**
 * Setup S3 bucket for Textract async processing
 */

require('dotenv').config()
const { S3Client, CreateBucketCommand, PutBucketCorsCommand } = require('@aws-sdk/client-s3')

async function setupS3Bucket() {
  const bucketName = process.env.AWS_S3_BUCKET_NAME || 'reminder-mvp-textract-pdfs'
  const region = process.env.AWS_S3_REGION || 'us-east-1'

  const s3Client = new S3Client({
    region,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
    },
  })

  try {
    console.log(`\n🪣 Creating S3 bucket: ${bucketName} in ${region}...\n`)

    // Create bucket
    const createCommand = new CreateBucketCommand({
      Bucket: bucketName,
    })

    try {
      await s3Client.send(createCommand)
      console.log('✅ Bucket created successfully')
    } catch (error) {
      if (error.name === 'BucketAlreadyOwnedByYou') {
        console.log('✅ Bucket already exists and is owned by you')
      } else if (error.name === 'BucketAlreadyExists') {
        console.log('⚠️  Bucket already exists')
      } else {
        throw error
      }
    }

    // Set CORS for web uploads (if needed in future)
    console.log('\n📋 Setting CORS configuration...')
    const corsCommand = new PutBucketCorsCommand({
      Bucket: bucketName,
      CORSConfiguration: {
        CORSRules: [
          {
            AllowedHeaders: ['*'],
            AllowedMethods: ['GET', 'PUT', 'POST', 'DELETE'],
            AllowedOrigins: ['*'],
            ExposeHeaders: ['ETag'],
            MaxAgeSeconds: 3000,
          },
        ],
      },
    })

    await s3Client.send(corsCommand)
    console.log('✅ CORS configuration set')

    console.log('\n' + '='.repeat(80))
    console.log('\n🎉 S3 bucket setup complete!\n')
    console.log('Bucket details:')
    console.log(`  Name:   ${bucketName}`)
    console.log(`  Region: ${region}`)
    console.log(`  URL:    https://${bucketName}.s3.${region}.amazonaws.com`)
    console.log('\n' + '='.repeat(80) + '\n')

  } catch (error) {
    console.error('\n❌ S3 setup failed:', error.message)
    console.error('\nDetails:', error)
    process.exit(1)
  }
}

setupS3Bucket().catch(console.error)
