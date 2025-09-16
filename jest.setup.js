require('@testing-library/jest-dom')

// Mock Next.js web globals
global.Request = global.Request || class Request {
  constructor(input, init) {
    this.url = input
    this.method = init?.method || 'GET'
    this.headers = new Map(Object.entries(init?.headers || {}))
    this.body = init?.body || null
  }
}

global.Response = global.Response || class Response {
  constructor(body, init) {
    this.body = body
    this.status = init?.status || 200
    this.statusText = init?.statusText || 'OK'
    this.headers = new Map(Object.entries(init?.headers || {}))
  }

  async json() {
    return JSON.parse(this.body || '{}')
  }

  async text() {
    return this.body || ''
  }

  static json(data, init) {
    return new Response(JSON.stringify(data), {
      ...init,
      headers: { 'Content-Type': 'application/json', ...init?.headers }
    })
  }
}

global.Headers = global.Headers || Map

// Mock Next.js router
jest.mock('next/router', () => ({
  useRouter() {
    return {
      route: '/',
      pathname: '/',
      query: {},
      asPath: '/',
      push: jest.fn(),
      replace: jest.fn(),
      reload: jest.fn(),
      back: jest.fn(),
      prefetch: jest.fn(() => Promise.resolve()),
      beforePopState: jest.fn(),
      events: {
        on: jest.fn(),
        off: jest.fn(),
        emit: jest.fn(),
      },
    }
  }
}))

// Mock NextAuth
jest.mock('next-auth/react', () => ({
  useSession: jest.fn(() => ({
    data: null,
    status: 'loading'
  })),
  signIn: jest.fn(),
  signOut: jest.fn(),
  SessionProvider: ({ children }) => children,
}))

// Mock next-intl
jest.mock('next-intl', () => ({
  useTranslations: jest.fn(() => (key) => key),
  useLocale: jest.fn(() => 'en'),
}))

// Create comprehensive Prisma mock
const createPrismaModelMock = () => ({
  findUnique: jest.fn(),
  findMany: jest.fn(),
  findFirst: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  updateMany: jest.fn(),
  delete: jest.fn(),
  deleteMany: jest.fn(),
  count: jest.fn(),
  aggregate: jest.fn(),
  groupBy: jest.fn(),
  upsert: jest.fn()
})

const mockPrisma = {
  $queryRaw: jest.fn(),
  $executeRaw: jest.fn(),
  $transaction: jest.fn(fn => fn(mockPrisma)),
  activity: createPrismaModelMock(),
  activities: createPrismaModelMock(),
  user: createPrismaModelMock(),
  users: createPrismaModelMock(),
  company: createPrismaModelMock(),
  companies: createPrismaModelMock(),
  invoice: createPrismaModelMock(),
  invoices: createPrismaModelMock(),
  invoiceItem: createPrismaModelMock(),
  invoiceItems: createPrismaModelMock(),
  customer: createPrismaModelMock(),
  customers: createPrismaModelMock(),
  payment: createPrismaModelMock(),
  payments: createPrismaModelMock(),
  followUpSequence: createPrismaModelMock(),
  followUpSequences: createPrismaModelMock(),
  emailLog: createPrismaModelMock(),
  emailLogs: createPrismaModelMock(),
}

jest.mock('@/lib/prisma', () => ({
  prisma: mockPrisma,
  default: mockPrisma
}))

jest.mock('./src/lib/prisma', () => ({
  prisma: mockPrisma,
  default: mockPrisma
}))

// Mock email service
jest.mock('@/lib/email-service', () => ({
  getDefaultEmailService: jest.fn(() => ({
    sendEmail: jest.fn(() => Promise.resolve({ messageId: 'test-123' })),
    validateEmail: jest.fn(() => true),
    sendTemplatedEmail: jest.fn(() => Promise.resolve({ messageId: 'test-456' })),
  })),
  EmailService: jest.fn(),
}))

// Setup test environment variables
process.env.NEXTAUTH_SECRET = 'test-secret'
process.env.NEXTAUTH_URL = 'http://localhost:3000'
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/reminder_test'