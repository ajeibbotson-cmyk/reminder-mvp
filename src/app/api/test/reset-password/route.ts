import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

export async function POST() {
  try {
    const TEST_EMAIL = 'smoke-test@example.com'
    const TEST_PASSWORD = 'SmokeTest123!'

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { email: TEST_EMAIL }
    })

    if (!existingUser) {
      return NextResponse.json({
        success: false,
        error: 'Test user does not exist'
      }, { status: 404 })
    }

    // Update password
    const hashedPassword = await bcrypt.hash(TEST_PASSWORD, 12)
    await prisma.user.update({
      where: { id: existingUser.id },
      data: {
        password: hashedPassword
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Password reset successfully',
      email: TEST_EMAIL,
      userId: existingUser.id,
      companyId: existingUser.companyId
    })

  } catch (error) {
    console.error('Password reset error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
