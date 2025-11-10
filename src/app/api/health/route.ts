import { NextResponse } from 'next/server'

/**
 * GET /api/health
 * Simple health check endpoint for monitoring and E2E tests
 */
export async function GET() {
  return NextResponse.json(
    {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'reminder-api'
    },
    { status: 200 }
  )
}
