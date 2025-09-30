import { NextRequest, NextResponse } from "next/server";
import { getAuthPrisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    console.log('Test signup endpoint called')

    const body = await request.json();
    console.log('Request body received:', {
      hasEmail: !!body.email,
      hasPassword: !!body.password,
      hasName: !!body.name,
      hasCompany: !!body.company
    })

    const { email, password, name, company } = body;

    // Test basic validation
    if (!email || !password || !name || !company) {
      console.log('Validation failed: missing fields')
      return NextResponse.json(
        { error: "Missing required fields", received: { email: !!email, password: !!password, name: !!name, company: !!company } },
        { status: 400 }
      );
    }

    // Test database connection
    console.log('Testing database connection...')
    const authPrisma = getAuthPrisma();

    // Simple query test
    const testQuery = await authPrisma.$queryRaw`SELECT 1 as test`;
    console.log('Database test query result:', testQuery)

    // Test user lookup (without creating)
    console.log('Testing user lookup...')
    const existingUser = await authPrisma.users.findUnique({
      where: { email },
    });
    console.log('Existing user check:', { exists: !!existingUser })

    return NextResponse.json({
      success: true,
      message: "Test endpoint working",
      data: {
        validationPassed: true,
        databaseConnected: true,
        userExists: !!existingUser,
        testQuery
      }
    });

  } catch (error) {
    console.error('Test signup error:', error)

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}