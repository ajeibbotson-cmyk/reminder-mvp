import { NextRequest, NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { getAuthPrisma } from "@/lib/prisma";
import { handleApiError, successResponse, logError, ValidationError } from '@/lib/errors';
import { randomUUID } from 'crypto';

export async function POST(request: NextRequest) {
  try {
    const { email, password, name, company } = await request.json();

    // Validate required fields
    if (!email || !password || !name || !company) {
      throw new ValidationError("All fields are required");
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new ValidationError("Invalid email format", "email");
    }

    // Validate password strength
    if (password.length < 8) {
      throw new ValidationError("Password must be at least 8 characters", "password");
    }

    // Use direct connection for authentication operations
    const authPrisma = getAuthPrisma();

    // Check if user already exists
    const existingUser = await authPrisma.users.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new ValidationError("User already exists with this email", "email");
    }

    // Hash password
    const hashedPassword = await hash(password, 12);

    // Create company and user in a transaction using direct connection
    const result = await authPrisma.$transaction(async (tx) => {
      // Create company
      const newCompany = await tx.companies.create({
        data: {
          id: randomUUID(),
          name: company,
          updated_at: new Date(),
        },
      });

      // Create user
      const newUser = await tx.users.create({
        data: {
          id: randomUUID(),
          email,
          name,
          password: hashedPassword,
          company_id: newCompany.id,
          role: "ADMIN", // First user is admin
          updated_at: new Date(),
        },
      });

      return { user: newUser, company: newCompany };
    });

    return successResponse(
      {
        user: {
          id: result.user.id,
          email: result.user.email,
          name: result.user.name,
        }
      },
      "Account created successfully"
    );

  } catch (error) {
    logError('POST /api/auth/signup', error, {
      email: 'redacted_for_security',
      company: 'redacted_for_security'
    });
    return handleApiError(error);
  }
}