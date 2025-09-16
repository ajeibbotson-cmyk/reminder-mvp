// Test setup to ensure all dependencies are properly mocked and available

// Mock NextAuth
jest.mock('next-auth/react', () => ({
  useSession: jest.fn(() => ({
    data: {
      user: {
        id: 'test-user-1',
        name: 'Test User',
        email: 'test@example.com',
        companyId: 'test-company-1'
      },
      expires: '2024-12-31'
    },
    status: 'authenticated'
  })),
  signIn: jest.fn(),
  signOut: jest.fn(),
  SessionProvider: ({ children }: { children: React.ReactNode }) => children
}));

// Mock Next.js navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
  }),
  usePathname: () => '/en/dashboard',
  useSearchParams: () => new URLSearchParams(),
  notFound: jest.fn(),
}));

// Mock next-intl
jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => 'en',
  NextIntlClientProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// Mock Prisma
jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    company: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    user: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    invoice: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    customer: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  },
}));

// Mock AWS SES
jest.mock('@aws-sdk/client-ses', () => ({
  SESClient: jest.fn(() => ({
    send: jest.fn(),
  })),
  SendEmailCommand: jest.fn(),
}));

// Mock react-day-picker
jest.mock('react-day-picker', () => ({
  DayPicker: ({ onSelect }: { onSelect: (date: Date) => void }) => (
    <div data-testid="day-picker" onClick={() => onSelect(new Date())}>
      Mock Calendar
    </div>
  ),
}));

// Setup timezone for UAE
process.env.TZ = 'Asia/Dubai';

// Setup test environment variables
process.env.NEXTAUTH_SECRET = 'test-secret';
process.env.NEXTAUTH_URL = 'http://localhost:3000';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/reminder_test';

export {};