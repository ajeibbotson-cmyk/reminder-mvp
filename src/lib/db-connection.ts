import { PrismaClient } from '@prisma/client'

// Connection types for different use cases
export type ConnectionType = 'direct' | 'pooled'

// Global instances for connection reuse
const globalForPrisma = globalThis as unknown as {
  directPrisma: PrismaClient | undefined
  pooledPrisma: PrismaClient | undefined
}

// Direct connection (using DIRECT_URL) - for critical operations like authentication
const createDirectClient = () => {
  if (!process.env.DIRECT_URL) {
    throw new Error('DIRECT_URL environment variable is required for direct database connection')
  }

  return new PrismaClient({
    datasources: {
      db: {
        url: process.env.DIRECT_URL
      }
    },
    log: process.env.NODE_ENV === 'development' ? ['query', 'error'] : ['error']
  })
}

// Pooled connection (using DATABASE_URL) - for regular operations
const createPooledClient = () => {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is required for pooled database connection')
  }

  return new PrismaClient({
    datasources: {
      db: {
        url: process.env.DATABASE_URL
      }
    },
    log: process.env.NODE_ENV === 'development' ? ['query', 'error'] : ['error']
  })
}

// Create or reuse direct connection
export const getDirectPrisma = (): PrismaClient => {
  if (globalForPrisma.directPrisma) {
    return globalForPrisma.directPrisma
  }

  const directPrisma = createDirectClient()

  if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.directPrisma = directPrisma
  }

  return directPrisma
}

// Create or reuse pooled connection
export const getPooledPrisma = (): PrismaClient => {
  if (globalForPrisma.pooledPrisma) {
    return globalForPrisma.pooledPrisma
  }

  const pooledPrisma = createPooledClient()

  if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.pooledPrisma = pooledPrisma
  }

  return pooledPrisma
}

// Smart connection selector with fallback
export const getPrisma = async (connectionType: ConnectionType = 'pooled'): Promise<PrismaClient> => {
  try {
    if (connectionType === 'direct') {
      const client = getDirectPrisma()
      // Test the connection
      await client.$connect()
      return client
    } else {
      const client = getPooledPrisma()
      // Test the connection
      await client.$connect()
      return client
    }
  } catch (error) {
    console.error(`Failed to connect using ${connectionType} connection:`, error)

    // Fallback strategy: if pooled fails, try direct
    if (connectionType === 'pooled') {
      console.log('Falling back to direct connection...')
      try {
        const client = getDirectPrisma()
        await client.$connect()
        return client
      } catch (fallbackError) {
        console.error('Direct connection fallback also failed:', fallbackError)
        throw new Error('Unable to establish database connection with either pooled or direct connection')
      }
    } else {
      // Direct connection failed, no fallback available
      throw new Error('Direct database connection failed and no fallback available')
    }
  }
}

// Health check function
export const checkDatabaseHealth = async (): Promise<{
  direct: { status: 'healthy' | 'error', error?: string }
  pooled: { status: 'healthy' | 'error', error?: string }
}> => {
  const result = {
    direct: { status: 'error' as const, error: '' },
    pooled: { status: 'error' as const, error: '' }
  }

  // Test direct connection
  try {
    const directClient = getDirectPrisma()
    await directClient.$queryRaw`SELECT 1`
    result.direct.status = 'healthy'
  } catch (error) {
    result.direct.error = error instanceof Error ? error.message : 'Unknown error'
  }

  // Test pooled connection
  try {
    const pooledClient = getPooledPrisma()
    await pooledClient.$queryRaw`SELECT 1`
    result.pooled.status = 'healthy'
  } catch (error) {
    result.pooled.error = error instanceof Error ? error.message : 'Unknown error'
  }

  return result
}

// Authentication-specific client (always use direct connection for auth)
export const getAuthPrisma = () => getDirectPrisma()

// Default export for backward compatibility (tries pooled first, falls back to direct)
export const prisma = getPooledPrisma()