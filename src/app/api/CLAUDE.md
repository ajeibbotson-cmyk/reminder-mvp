# CLAUDE.md - API Routes

This file provides guidance for working with Reminder API routes and backend logic.

## API Architecture

### Current Endpoints
- **`auth/[...nextauth]/route.ts`** - NextAuth.js authentication handler
- **`auth/signup/route.ts`** - User and company registration

### Route Handler Patterns

#### Standard Response Format
```typescript
// Success response
return NextResponse.json(
  { message: "Success message", data: result },
  { status: 201 }
);

// Error response  
return NextResponse.json(
  { message: "Error message" },
  { status: 400 }
);
```

#### Error Handling Pattern
```typescript
export async function POST(request: NextRequest) {
  try {
    // Validate input
    if (!email || !password) {
      return NextResponse.json(
        { message: "Required fields missing" },
        { status: 400 }
      );
    }

    // Business logic here
    
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("API Error:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
```

### Authentication Middleware

#### Session Validation
Use `getServerSession` for protected routes:
```typescript
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const session = await getServerSession(authOptions);
if (!session) {
  return NextResponse.json(
    { message: "Unauthorized" },
    { status: 401 }
  );
}
```

#### Company Data Isolation
Always filter by company for multi-tenant security:
```typescript
const invoices = await prisma.invoice.findMany({
  where: {
    companyId: session.user.companyId
  }
});
```

### Database Transaction Pattern

For operations affecting multiple tables:
```typescript
const result = await prisma.$transaction(async (tx) => {
  const company = await tx.company.create({ data: companyData });
  const user = await tx.user.create({ 
    data: { ...userData, companyId: company.id }
  });
  return { user, company };
});
```

### Input Validation

Use consistent validation patterns:
```typescript
// Email validation
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
if (!emailRegex.test(email)) {
  return NextResponse.json(
    { message: "Invalid email format" },
    { status: 400 }
  );
}

// Password strength (minimum 8 characters)
if (password.length < 8) {
  return NextResponse.json(
    { message: "Password must be at least 8 characters" },
    { status: 400 }
  );
}
```

## Future API Endpoints (Planned)

### Invoice Management
- `POST /api/invoices` - Create invoice
- `GET /api/invoices` - List company invoices
- `PUT /api/invoices/[id]` - Update invoice
- `POST /api/invoices/import` - Bulk import

### Customer Management  
- `POST /api/customers` - Create customer
- `GET /api/customers` - List company customers
- `PUT /api/customers/[id]` - Update customer

### Follow-up System
- `POST /api/follow-ups/sequences` - Create follow-up sequence
- `POST /api/follow-ups/send` - Trigger follow-up
- `GET /api/follow-ups/logs` - View email logs

### Payment Tracking
- `POST /api/payments` - Record payment
- `GET /api/payments` - Payment history
- `POST /api/payments/reconcile` - Match payments to invoices

## UAE-Specific Considerations

### Currency Handling
- Always use AED as default currency
- Format amounts with 2 decimal places
- Validate currency codes against supported list

### TRN Validation
```typescript
// UAE Trade Registration Number format
const trnRegex = /^[0-9]{15}$/;
if (trn && !trnRegex.test(trn)) {
  return NextResponse.json(
    { message: "Invalid TRN format" },
    { status: 400 }
  );
}
```

### Cultural Timing
- Respect UAE business hours (Sunday-Thursday, 9 AM - 6 PM)
- Account for Islamic holidays and weekends
- Implement respectful follow-up delays

## Error Logging

Use structured logging for production monitoring:
```typescript
console.error("API Error:", {
  endpoint: request.url,
  method: request.method,
  error: error.message,
  stack: error.stack,
  userId: session?.user?.id,
  companyId: session?.user?.companyId
});
```

## Performance Considerations

- Use database connection pooling (already configured via Supabase)
- Implement pagination for list endpoints
- Cache frequently accessed data
- Use database indexes for query optimization
- Consider rate limiting for production