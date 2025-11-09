import { PrismaClient } from '@prisma/client'
import {
  getPrisma,
  getDirectPrisma,
  getPooledPrisma,
  getAuthPrisma,
  checkDatabaseHealth,
  type ConnectionType
} from './db-connection'

// Re-export the connection utilities for easy access
export {
  getPrisma,
  getDirectPrisma,
  getPooledPrisma,
  getAuthPrisma,
  checkDatabaseHealth,
  type ConnectionType
}

// Legacy prisma client for backward compatibility
// CRITICAL FIX: Use DIRECT_URL because DATABASE_URL pooler (port 6543) has connectivity issues
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: {
      db: {
        url: process.env.DIRECT_URL || process.env.DATABASE_URL
      }
    },
    log: process.env.NODE_ENV === 'development' ? ['query', 'error'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma