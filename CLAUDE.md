# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# UAEPay MVP - Payment Collection Platform

**E-invoicing gets your invoices delivered. UAEPay gets them paid.**

A Next.js 15 SaaS platform targeting UAE SMEs for automated invoice payment collection, designed to capture first-mover advantage before the July 2026 UAE e-invoicing mandate.

## Development Commands

```bash
# Development
npm run dev              # Start development server on localhost:3000
npm run build           # Production build with optimization
npm run start           # Production server
npm run lint            # ESLint validation

# Database Operations  
npx prisma generate     # Generate Prisma client after schema changes
npx prisma db push      # Push schema changes to database
npx prisma studio       # Visual database browser
npx prisma migrate dev  # Create and apply migrations
```

## Architecture Overview

### Tech Stack
- **Next.js 15** with App Router + React 19
- **TypeScript** strict mode throughout
- **PostgreSQL** via Supabase with connection pooling
- **Prisma ORM** for type-safe database operations
- **NextAuth.js v4** with JWT sessions
- **Tailwind CSS v4** + shadcn/ui components
- **AWS SES** for email delivery (ME South region)

### Entry Points
- **Homepage**: `src/app/page.tsx` - UAE-focused landing page
- **Dashboard**: `src/app/dashboard/page.tsx` - Main app (auth required)
- **Auth API**: `src/app/api/auth/[...nextauth]/route.ts` - NextAuth handler
- **Signup API**: `src/app/api/auth/signup/route.ts` - User/company registration

### Database Schema (Multi-tenant)
Core business models with UAE-specific requirements:
- **User/Company** - Role-based access (ADMIN/FINANCE/VIEWER) with TRN support
- **Invoice/InvoiceItem** - AED currency native, customer relationships
- **Customer** - Payment terms, contact management
- **FollowUpSequence/FollowUpLog** - Email automation with AWS SES tracking
- **Payment** - Multiple methods, reconciliation support
- **Activity** - Comprehensive audit logging

### Authentication Flow
- JWT-based sessions with NextAuth.js credentials provider
- Transactional user registration (creates company + admin user atomically)
- bcryptjs password hashing (strength 12)
- Server-side session validation for protected routes
- Company data isolation for multi-tenancy

## Environment Setup

Required environment variables:
```bash
# Database (Supabase PostgreSQL)
DATABASE_URL="postgresql://postgres.xxx:password@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres.xxx:password@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres"

# Supabase
NEXT_PUBLIC_SUPABASE_URL="https://xxx.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJ..."

# NextAuth
NEXTAUTH_SECRET="your-secret-key"
NEXTAUTH_URL="http://localhost:3000"

# AWS SES (ME South region for UAE compliance)
AWS_ACCESS_KEY_ID=""
AWS_SECRET_ACCESS_KEY=""
AWS_REGION="me-south-1"
AWS_SES_FROM_EMAIL=""
```

## Code Patterns

### Component Architecture
- Server Components by default for performance
- Client Components only when needed (`"use client"`)
- shadcn/ui compound component patterns
- TypeScript interfaces for all props

### Database Access
- Prisma singleton pattern (`src/lib/prisma.ts`)
- Transaction support for multi-table operations
- Company-scoped queries for multi-tenancy
- Connection pooling via Supabase

### Error Handling
- Toast notifications via Sonner
- Consistent HTTP status codes in API routes
- Try-catch blocks with proper logging
- User-friendly error messages

## Internationalization

### Structure (`messages/`)
- `en.json` - English (primary)
- `ar.json` - Arabic with RTL support
- Hierarchical organization: auth, navigation, dashboard, invoices, common

### UAE Business Focus
- Culturally appropriate messaging and timing
- AED currency formatting throughout
- TRN (Trade Registration Number) support
- Business customs respected in follow-up sequences

## Development Workflow

### Setup
1. Clone repository and run `npm install`
2. Configure `.env` with Supabase and AWS credentials
3. Run `npx prisma generate` to create database client
4. Start development with `npm run dev`

### Database Changes
1. Modify `prisma/schema.prisma`
2. Run `npx prisma db push` for immediate changes or `npx prisma migrate dev` for migrations
3. Run `npx prisma generate` to update TypeScript types

### Adding Components
- Use shadcn/ui CLI: `npx shadcn-ui@latest add [component]`
- Follow existing patterns in `src/components/ui/`
- Ensure TypeScript interfaces for props

## Business Context

### Market Positioning
- UAE SME target market (under AED 3M annual turnover)  
- 25% payment delay reduction goal
- First-mover advantage before July 2026 e-invoicing mandate
- Respectful, culturally-sensitive approach to payment collection

### Current Status
**Phase 0 Complete** ✅
- Foundation: Next.js, TypeScript, database, authentication
- UI component library and responsive design
- Internationalization infrastructure
- Email service integration ready

**Phase 1 Next** (Core MVP):
- Invoice management (import/manual entry)
- Automated follow-up sequences
- Payment tracking dashboard
- Real-time metrics

### Key Business Rules
- Multi-tenant data isolation (companies cannot access each other's data)
- AED currency default with UAE locale formatting
- Role-based permissions ready for implementation
- Cultural timing considerations for follow-up automation
- Audit logging for all user actions

## Testing Status

✅ **Comprehensive Testing Framework Implemented**

### Current Testing Infrastructure
- **Jest + React Testing Library**: Unit and integration tests
- **Playwright**: End-to-end testing with cross-browser support
- **Next.js Test Utilities**: API route testing
- **Test Database Setup**: Complete mocking and database integration

### Test Statistics
- **Total Tests**: 354 tests implemented
- **Passing Tests**: 286 (81% success rate)
- **Test Files**: 51 test files across the codebase
- **Coverage**: Comprehensive across all business logic and UAE-specific features

### Testing Commands
```bash
npm run test              # Run Jest unit and integration tests
npm run test:e2e          # Run Playwright end-to-end tests
npm run test:coverage     # Generate coverage reports
node scripts/test-diagnostics.js  # Analyze testing status
```

### UAE-Specific Testing
- Cultural compliance scoring validation
- UAE business hours and Islamic calendar testing
- TRN validation and AED currency formatting
- Arabic/English bilingual template testing
- Prayer time and business customs validation

## File Organization

```
src/
├── app/                    # Next.js App Router
│   ├── api/auth/          # Authentication endpoints
│   ├── auth/signin+signup/ # Auth pages
│   ├── dashboard/         # Main application
│   └── layout.tsx         # Root layout with providers
├── components/
│   ├── ui/               # shadcn/ui components
│   └── providers/        # React context providers
└── lib/                  # Core utilities
    ├── auth.ts           # NextAuth configuration
    ├── prisma.ts         # Database client
    ├── email.ts          # AWS SES integration
    └── utils.ts          # Helper functions
```

This UAE-focused platform is architected for rapid feature development with strong foundations in authentication, database design, and internationalization.