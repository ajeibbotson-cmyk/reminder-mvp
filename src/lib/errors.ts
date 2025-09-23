import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { ZodError } from 'zod'

export class AppError extends Error {
  constructor(
    public message: string,
    public statusCode: number = 500,
    public code?: string
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export class ValidationError extends AppError {
  constructor(message: string, public field?: string) {
    super(message, 400, 'VALIDATION_ERROR')
    this.name = 'ValidationError'
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(`${resource} not found`, 404, 'NOT_FOUND')
    this.name = 'NotFoundError'
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized access') {
    super(message, 401, 'UNAUTHORIZED')
    this.name = 'UnauthorizedError'
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Access forbidden') {
    super(message, 403, 'FORBIDDEN')
    this.name = 'ForbiddenError'
  }
}

export function handleApiError(error: unknown): NextResponse {
  console.error('API Error:', error)

  // Handle known app errors
  if (error instanceof AppError) {
    return NextResponse.json(
      { 
        success: false,
        error: error.message, 
        code: error.code 
      },
      { status: error.statusCode }
    )
  }

  // Handle Zod validation errors
  if (error instanceof ZodError) {
    const fieldErrors = (error.errors || []).map(err => ({
      field: (err.path || []).join('.'),
      message: err.message || 'Validation error'
    }))

    return NextResponse.json(
      {
        success: false,
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: fieldErrors
      },
      { status: 400 }
    )
  }

  // Handle Prisma errors
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case 'P2002':
        // Unique constraint violation
        const target = error.meta?.target as string[] || []
        const field = target[0] || 'field'
        return NextResponse.json(
          { 
            success: false,
            error: `A record with this ${field} already exists`, 
            code: 'DUPLICATE_ERROR',
            field 
          },
          { status: 409 }
        )
      
      case 'P2025':
        // Record not found
        return NextResponse.json(
          { 
            success: false,
            error: 'Record not found', 
            code: 'NOT_FOUND' 
          },
          { status: 404 }
        )
      
      case 'P2003':
        // Foreign key constraint violation
        return NextResponse.json(
          { 
            success: false,
            error: 'Invalid reference to related record', 
            code: 'FOREIGN_KEY_ERROR' 
          },
          { status: 400 }
        )
      
      default:
        console.error('Prisma error:', error.code, error.message)
        return NextResponse.json(
          { 
            success: false,
            error: 'Database operation failed', 
            code: 'DATABASE_ERROR' 
          },
          { status: 500 }
        )
    }
  }

  // Handle Prisma validation errors
  if (error instanceof Prisma.PrismaClientValidationError) {
    return NextResponse.json(
      { 
        success: false,
        error: 'Invalid data provided', 
        code: 'VALIDATION_ERROR' 
      },
      { status: 400 }
    )
  }

  // Handle generic errors
  if (error instanceof Error) {
    return NextResponse.json(
      { 
        success: false,
        error: error.message, 
        code: 'INTERNAL_ERROR' 
      },
      { status: 500 }
    )
  }

  // Fallback for unknown errors
  return NextResponse.json(
    { 
      success: false,
      error: 'An unexpected error occurred', 
      code: 'UNKNOWN_ERROR' 
    },
    { status: 500 }
  )
}

// Success response helper
export function successResponse<T>(data: T, message?: string): NextResponse {
  return NextResponse.json({
    success: true,
    data,
    message
  })
}

// Logging utility
export function logError(context: string, error: unknown, additionalData?: any) {
  const timestamp = new Date().toISOString()
  const errorInfo = {
    timestamp,
    context,
    error: error instanceof Error ? {
      name: error.name,
      message: error.message,
      stack: error.stack
    } : error,
    additionalData
  }
  
  console.error('Application Error:', JSON.stringify(errorInfo, null, 2))
}