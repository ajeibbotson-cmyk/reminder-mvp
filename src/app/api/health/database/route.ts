import { NextRequest, NextResponse } from 'next/server'
import { checkDatabaseHealth, getDirectPrisma, getPooledPrisma } from '@/lib/prisma'

// Database health check endpoint
export async function GET(request: NextRequest) {
  try {
    console.log('Starting database health check...')

    // Get connection health status
    const healthStatus = await checkDatabaseHealth()

    // Additional connection tests
    const timestamp = new Date().toISOString()

    // Test direct connection with a simple query
    let directQueryResult = null
    try {
      const directPrisma = getDirectPrisma()
      const result = await directPrisma.$queryRaw`SELECT NOW() as current_time, 'direct' as connection_type`
      directQueryResult = { status: 'success', data: result }
    } catch (error) {
      directQueryResult = {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }

    // Test pooled connection with a simple query
    let pooledQueryResult = null
    try {
      const pooledPrisma = getPooledPrisma()
      const result = await pooledPrisma.$queryRaw`SELECT NOW() as current_time, 'pooled' as connection_type`
      pooledQueryResult = { status: 'success', data: result }
    } catch (error) {
      pooledQueryResult = {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }

    // Environment check
    const environmentInfo = {
      NODE_ENV: process.env.NODE_ENV,
      DATABASE_URL: process.env.DATABASE_URL ? 'Set' : 'Not set',
      DIRECT_URL: process.env.DIRECT_URL ? 'Set' : 'Not set',
      hasDirectUrlConfig: !!process.env.DIRECT_URL,
      hasDatabaseUrlConfig: !!process.env.DATABASE_URL
    }

    const response = {
      timestamp,
      status: 'completed',
      environment: environmentInfo,
      connections: {
        direct: {
          health: healthStatus.direct,
          queryTest: directQueryResult
        },
        pooled: {
          health: healthStatus.pooled,
          queryTest: pooledQueryResult
        }
      },
      summary: {
        directWorking: healthStatus.direct.status === 'healthy' && directQueryResult?.status === 'success',
        pooledWorking: healthStatus.pooled.status === 'healthy' && pooledQueryResult?.status === 'success',
        recommendation: getRecommendation(healthStatus, directQueryResult, pooledQueryResult)
      }
    }

    // Set appropriate HTTP status based on connection health
    const httpStatus = response.summary.directWorking || response.summary.pooledWorking ? 200 : 503

    return NextResponse.json(response, { status: httpStatus })

  } catch (error) {
    console.error('Database health check failed:', error)

    return NextResponse.json(
      {
        timestamp: new Date().toISOString(),
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        environment: {
          NODE_ENV: process.env.NODE_ENV,
          DATABASE_URL: process.env.DATABASE_URL ? 'Set' : 'Not set',
          DIRECT_URL: process.env.DIRECT_URL ? 'Set' : 'Not set'
        }
      },
      { status: 500 }
    )
  }
}

function getRecommendation(
  healthStatus: any,
  directResult: any,
  pooledResult: any
): string {
  const directWorks = healthStatus.direct.status === 'healthy' && directResult?.status === 'success'
  const pooledWorks = healthStatus.pooled.status === 'healthy' && pooledResult?.status === 'success'

  if (directWorks && pooledWorks) {
    return 'Both connections working normally'
  } else if (directWorks && !pooledWorks) {
    return 'Direct connection works, pooled connection has issues. Use direct connection for authentication operations.'
  } else if (!directWorks && pooledWorks) {
    return 'Pooled connection works, direct connection has issues. Check DIRECT_URL configuration.'
  } else {
    return 'Both connections have issues. Check database credentials and network connectivity.'
  }
}