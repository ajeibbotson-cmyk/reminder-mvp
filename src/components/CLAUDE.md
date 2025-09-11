# CLAUDE.md - Components

This file provides guidance for working with UAEPay UI components and design system.

## Component Architecture

### Design System - shadcn/ui
UAEPay uses shadcn/ui components with "new-york" style and custom theme configuration.

#### Adding New Components
```bash
npx shadcn-ui@latest add [component-name]
```

#### Available Components
**Currently Implemented:**
- `Button` - Multiple variants (default, destructive, outline, secondary, ghost, link)
- `Card` - Flexible layout with Header, Content, Description, Title
- `Input` - Form inputs with validation states
- `Label` - Form labels with proper accessibility
- `Dialog` - Modal dialogs and sheets
- `DropdownMenu` - Action menus and navigation
- `Form` - React Hook Form integration
- `Badge` - Status indicators and tags
- `Table` - Data tables with sorting capabilities
- `Sonner` - Toast notifications

### Component Patterns

#### Server vs Client Components
```typescript
// Server Component (default)
export default function ServerComponent() {
  return <div>Server-rendered content</div>
}

// Client Component (when needed)
"use client"
export default function ClientComponent() {
  const [state, setState] = useState()
  return <div>Interactive content</div>
}
```

#### TypeScript Props Interface
```typescript
interface ComponentProps {
  title: string
  description?: string
  children: React.ReactNode
  variant?: 'default' | 'destructive' | 'outline'
  className?: string
}

export default function Component({ 
  title, 
  description, 
  children,
  variant = 'default',
  className 
}: ComponentProps) {
  return (
    <div className={cn("base-styles", className)}>
      <h2>{title}</h2>
      {description && <p>{description}</p>}
      {children}
    </div>
  )
}
```

#### Compound Component Pattern
Follow shadcn/ui patterns for related components:
```typescript
// Card compound component usage
<Card>
  <CardHeader>
    <CardTitle>Title</CardTitle>
    <CardDescription>Description</CardDescription>
  </CardHeader>
  <CardContent>
    Content here
  </CardContent>
</Card>
```

### Styling Conventions

#### Tailwind CSS Classes
- **Spacing**: Use consistent spacing scale (px, 2, 4, 6, 8, 12, 16, 20, 24)
- **Colors**: Use CSS custom properties for theme colors
- **Responsive**: Mobile-first with breakpoints (sm, md, lg, xl)

#### CSS Custom Properties
Theme colors available:
```css
--background
--foreground
--card / --card-foreground
--primary / --primary-foreground
--secondary / --secondary-foreground
--muted / --muted-foreground
--accent / --accent-foreground
--destructive / --destructive-foreground
--border
--input
--ring
```

#### Class Name Utility
Always use the `cn` utility for conditional classes:
```typescript
import { cn } from "@/lib/utils"

<div className={cn(
  "base-classes",
  variant === 'large' && "large-classes",
  className
)} />
```

### Form Components

#### React Hook Form Integration
```typescript
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
})

export default function FormComponent() {
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema)
  })

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </form>
    </Form>
  )
}
```

### Provider Components

#### Session Provider (`providers/session-provider.tsx`)
Wraps the app with NextAuth session context:
```typescript
"use client"
import { SessionProvider } from "next-auth/react"

export default function Providers({ 
  children,
  session 
}: {
  children: React.ReactNode
  session?: Session | null
}) {
  return <SessionProvider session={session}>{children}</SessionProvider>
}
```

### UAE-Specific Component Considerations

#### RTL (Right-to-Left) Support
Prepare components for Arabic language support:
```typescript
// Use logical properties for RTL compatibility
className="ms-4 me-2" // instead of ml-4 mr-2
className="ps-6 pe-4" // instead of pl-6 pr-4
```

#### Currency Display
Create a currency component for consistent AED formatting:
```typescript
interface CurrencyProps {
  amount: number
  currency?: string
  locale?: string
}

export function Currency({ 
  amount, 
  currency = 'AED', 
  locale = 'en-AE' 
}: CurrencyProps) {
  return (
    <span>
      {new Intl.NumberFormat(locale, {
        style: 'currency',
        currency
      }).format(amount)}
    </span>
  )
}
```

#### Date Formatting
Handle UAE date preferences:
```typescript
export function DateDisplay({ 
  date, 
  locale = 'en-AE' 
}: {
  date: Date
  locale?: string
}) {
  return (
    <span>
      {new Intl.DateTimeFormat(locale, {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }).format(date)}
    </span>
  )
}
```

### Accessibility Guidelines

- Always provide proper ARIA labels
- Ensure keyboard navigation works
- Use semantic HTML elements
- Maintain color contrast ratios
- Support screen readers

### Performance Best Practices

- Use React.memo for expensive components
- Implement proper loading states
- Lazy load heavy components
- Optimize images with Next.js Image component
- Minimize bundle size with tree shaking

### Component Organization

```
src/components/
├── ui/                 # shadcn/ui base components
├── providers/          # Context providers  
├── forms/             # Form-specific components (future)
├── charts/            # Data visualization (future)
├── layout/            # Layout components (future)
└── business/          # UAE business-specific components (future)
```

### Future Component Additions

**Business Components (Planned):**
- `InvoiceCard` - Invoice display with UAE formatting
- `PaymentStatus` - Status badges with Arabic support
- `FollowUpTimeline` - Email sequence visualization  
- `TRNInput` - UAE Trade Registration Number input
- `AEDInput` - Currency input with AED formatting