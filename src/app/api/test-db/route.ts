import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    // Test basic database connectivity
    const userCount = await prisma.user.count()

    // Get a sample user (without password)
    const sampleUser = await prisma.user.findFirst({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true
      }
    })

    return NextResponse.json({
      status: 'connected',
      userCount,
      sampleUser,
      databaseHost: process.env.DATABASE_URL?.split('@')[1]?.split(':')[0] || 'unknown'
    })
  } catch (error: any) {
    return NextResponse.json({
      status: 'error',
      error: error.message,
      databaseHost: process.env.DATABASE_URL?.split('@')[1]?.split(':')[0] || 'unknown'
    }, { status: 500 })
  }
}
