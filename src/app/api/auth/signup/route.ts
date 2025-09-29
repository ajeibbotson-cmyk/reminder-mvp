import { NextRequest, NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { handleApiError, successResponse, logError, ValidationError } from '@/lib/errors';

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


    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new ValidationError("User already exists with this email", "email");
    }

    // Hash password
    const hashedPassword = await hash(password, 12);

    // Create company and user in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create company
      const newCompany = await tx.companies.create({
        data: {
          id: crypto.randomUUID(),
          name: company,
        },
      });

      // Create user
      const newUser = await tx.users.create({
        data: {
          id: crypto.randomUUID(),
          email,
          name,
          password: hashedPassword,
          company_id: newCompany.id,
          role: "ADMIN", // First user is admin
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
      email: request.body?.email || 'unknown',
      company: request.body?.company || 'unknown'
    });
    return handleApiError(error);
  }
}