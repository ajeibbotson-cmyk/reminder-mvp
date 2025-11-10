import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

// Validation schema for settings updates
const settingsSchema = z.object({
  // Company Information
  name: z.string().min(1).optional(),
  trn: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  defaultVatRate: z.number().min(0).max(100).optional(),

  // Email Settings
  emailSettings: z.object({
    fromName: z.string().optional(),
    replyTo: z.string().email().optional(),
    signature: z.string().optional(),
  }).optional(),

  // Business Hours (UAE specific)
  businessHours: z.object({
    timezone: z.string().optional(),
    workingDays: z.array(z.number().min(0).max(6)).optional(), // 0 = Sunday
    startTime: z.string().optional(), // "09:00"
    endTime: z.string().optional(), // "18:00"
  }).optional(),

  // General Settings
  settings: z.object({
    currency: z.string().optional(),
    dateFormat: z.string().optional(),
    language: z.enum(['en', 'ar']).optional(),
  }).optional(),
});

/**
 * GET /api/settings
 * Fetch company settings for the current user's company
 */
export async function GET(request: NextRequest) {
  try {
    // Get authenticated session
    const session = await getServerSession(authOptions);

    if (!session?.user?.companyId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Fetch company data
    const company = await prisma.company.findUnique({
      where: {
        id: session.user.companyId,
      },
      select: {
        id: true,
        name: true,
        trn: true,
        address: true,
        defaultVatRate: true,
        emailSettings: true,
        businessHours: true,
        settings: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!company) {
      return NextResponse.json(
        { error: 'Company not found' },
        { status: 404 }
      );
    }

    // Return settings with defaults
    return NextResponse.json({
      ...company,
      // Ensure emailSettings has structure
      emailSettings: company.emailSettings || {
        fromName: company.name,
        replyTo: '',
        signature: '',
      },
      // Ensure businessHours has structure (UAE defaults)
      businessHours: company.businessHours || {
        timezone: 'Asia/Dubai',
        workingDays: [0, 1, 2, 3, 4], // Sunday to Thursday
        startTime: '09:00',
        endTime: '18:00',
      },
      // Ensure settings has structure
      settings: company.settings || {
        currency: 'AED',
        dateFormat: 'DD/MM/YYYY',
        language: 'en',
      },
    });
  } catch (error) {
    console.error('Settings GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch settings' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/settings
 * Update company settings
 */
export async function PATCH(request: NextRequest) {
  try {
    // Get authenticated session
    const session = await getServerSession(authOptions);

    if (!session?.user?.companyId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check if user has admin role
    if (session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Forbidden - Admin access required' },
        { status: 403 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validatedData = settingsSchema.parse(body);

    // Prepare update data
    const updateData: any = {
      updatedAt: new Date(),
    };

    // Add fields that are direct columns
    if (validatedData.name !== undefined) {
      updateData.name = validatedData.name;
    }
    if (validatedData.trn !== undefined) {
      updateData.trn = validatedData.trn;
    }
    if (validatedData.address !== undefined) {
      updateData.address = validatedData.address;
    }
    if (validatedData.defaultVatRate !== undefined) {
      updateData.defaultVatRate = validatedData.defaultVatRate;
    }

    // Add JSON fields
    if (validatedData.emailSettings !== undefined) {
      updateData.emailSettings = validatedData.emailSettings;
    }
    if (validatedData.businessHours !== undefined) {
      updateData.businessHours = validatedData.businessHours;
    }
    if (validatedData.settings !== undefined) {
      updateData.settings = validatedData.settings;
    }

    // Update company
    const updatedCompany = await prisma.company.update({
      where: {
        id: session.user.companyId,
      },
      data: updateData,
      select: {
        id: true,
        name: true,
        trn: true,
        address: true,
        defaultVatRate: true,
        emailSettings: true,
        businessHours: true,
        settings: true,
        updatedAt: true,
      },
    });

    // Log activity
    await prisma.activity.create({
      data: {
        id: crypto.randomUUID(),
        companyId: session.user.companyId,
        userId: session.user.id,
        type: 'settings_updated',
        description: `Settings updated by ${session.user.name || session.user.email}`,
        metadata: {
          updatedFields: Object.keys(validatedData),
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: updatedCompany,
    });
  } catch (error) {
    console.error('Settings PATCH error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to update settings' },
      { status: 500 }
    );
  }
}
