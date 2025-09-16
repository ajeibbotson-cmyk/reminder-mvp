/**
 * Real-time Data Pipeline
 * WebSocket-optimized event broadcasting system for analytics dashboard
 * Supports 100+ concurrent connections with sub-1 second latency
 */

import { EventEmitter } from 'events'
import { WebSocket, WebSocketServer } from 'ws'
import { IncomingMessage } from 'http'
import { AnalyticsEvent, AnalyticsResponse, DashboardAnalytics } from '../types/analytics'
import { advancedCachingService } from './advanced-caching-service'
import { concurrentQueryOptimizer } from './concurrent-query-optimizer'
import { performance } from 'perf_hooks'

interface WebSocketConnection {
  id: string
  ws: WebSocket
  companyId: string
  userId?: string
  subscriptions: Set<string>
  lastPing: Date
  connectionTime: Date
  messagesSent: number
  messagesReceived: number
  averageLatency: number
  isAlive: boolean
}

interface RealtimeEvent {
  id: string
  type: 'analytics_update' | 'kpi_change' | 'alert' | 'system_status'
  companyId: string
  payload: any
  timestamp: Date
  priority: 'low' | 'medium' | 'high' | 'critical'
  targetChannels: string[]
  expiresAt?: Date
}

interface SubscriptionChannel {
  name: string
  companyId: string
  lastUpdate: Date
  subscriberCount: number
  messageRate: number // messages per second
  compressionEnabled: boolean
  batchingEnabled: boolean
}

interface PipelineMetrics {
  totalConnections: number
  activeConnections: number
  messagesPerSecond: number
  averageLatency: number
  connectionDropouts: number
  errorRate: number
  bandwidthUsage: number
  cacheHitRatio: number
}

export class RealtimeDataPipeline extends EventEmitter {
  private wss: WebSocketServer | null = null
  private connections: Map<string, WebSocketConnection> = new Map()
  private channels: Map<string, SubscriptionChannel> = new Map()
  private eventQueue: RealtimeEvent[] = []
  private metrics: PipelineMetrics
  private readonly MAX_CONNECTIONS = 500
  private readonly HEARTBEAT_INTERVAL = 30000 // 30 seconds
  private readonly MESSAGE_BATCH_SIZE = 10
  private readonly COMPRESSION_THRESHOLD = 1024 // 1KB

  constructor() {
    super()
    this.setMaxListeners(1000) // Support many event listeners

    this.metrics = {
      totalConnections: 0,
      activeConnections: 0,
      messagesPerSecond: 0,
      averageLatency: 0,
      connectionDropouts: 0,
      errorRate: 0,
      bandwidthUsage: 0,
      cacheHitRatio: 0
    }

    this.initializeEventProcessing()
    this.startHeartbeatMonitoring()
    this.startMetricsCollection()
  }

  /**
   * Initialize WebSocket server
   */
  initializeWebSocketServer(server: any): void {
    this.wss = new WebSocketServer({
      server,
      path: '/api/realtime',
      perMessageDeflate: {
        threshold: this.COMPRESSION_THRESHOLD,
        concurrencyLimit: 10
      }
    })

    this.wss.on('connection', this.handleConnection.bind(this))
    this.wss.on('error', this.handleServerError.bind(this))

    console.log('Real-time data pipeline WebSocket server initialized')
  }

  /**
   * Handle new WebSocket connection
   */
  private async handleConnection(ws: WebSocket, request: IncomingMessage): Promise<void> {
    const connectionId = crypto.randomUUID()
    const userAgent = request.headers['user-agent'] || 'unknown'

    console.log(`New WebSocket connection: ${connectionId} from ${userAgent}`)

    // Check connection limits
    if (this.connections.size >= this.MAX_CONNECTIONS) {
      ws.close(1013, 'Server capacity exceeded')
      return
    }

    // Extract authentication and company info from request
    const { companyId, userId } = await this.authenticateConnection(request)
    if (!companyId) {
      ws.close(1008, 'Authentication required')
      return
    }

    // Create connection record
    const connection: WebSocketConnection = {
      id: connectionId,
      ws,
      companyId,
      userId,
      subscriptions: new Set(),
      lastPing: new Date(),
      connectionTime: new Date(),
      messagesSent: 0,
      messagesReceived: 0,
      averageLatency: 0,
      isAlive: true
    }

    this.connections.set(connectionId, connection)
    this.metrics.totalConnections++
    this.metrics.activeConnections++

    // Set up connection event handlers
    this.setupConnectionHandlers(connection)

    // Send welcome message with connection info
    this.sendMessage(connection, {
      type: 'connection_established',
      data: {
        connectionId,
        serverTime: new Date(),
        capabilities: {
          compression: true,
          batching: true,
          channels: this.getAvailableChannels(companyId)
        }
      }
    })
  }

  /**
   * Set up connection event handlers
   */
  private setupConnectionHandlers(connection: WebSocketConnection): void {
    const { ws, id } = connection

    ws.on('message', async (message) => {
      try {
        await this.handleMessage(connection, message)
      } catch (error) {
        console.error(`Message handling error for ${id}:`, error)
        this.sendError(connection, 'Message processing failed')
      }
    })

    ws.on('close', () => {
      this.handleDisconnection(connection)
    })

    ws.on('error', (error) => {
      console.error(`WebSocket error for ${id}:`, error)
      this.handleConnectionError(connection, error)
    })

    ws.on('pong', () => {
      connection.isAlive = true
      connection.lastPing = new Date()
    })
  }

  /**
   * Handle incoming message from client
   */
  private async handleMessage(connection: WebSocketConnection, message: any): Promise<void> {
    const startTime = performance.now()

    try {
      const data = JSON.parse(message.toString())
      connection.messagesReceived++

      switch (data.type) {
        case 'subscribe':
          await this.handleSubscription(connection, data.channels || [])
          break

        case 'unsubscribe':
          await this.handleUnsubscription(connection, data.channels || [])
          break

        case 'ping':
          this.sendMessage(connection, { type: 'pong', timestamp: new Date() })
          break

        case 'request_data':
          await this.handleDataRequest(connection, data)
          break

        case 'analytics_event':
          await this.handleAnalyticsEvent(connection, data)
          break

        default:
          this.sendError(connection, `Unknown message type: ${data.type}`)
      }

      // Update latency metrics
      const latency = performance.now() - startTime
      connection.averageLatency = (connection.averageLatency + latency) / 2

    } catch (error) {
      console.error('Message parsing error:', error)
      this.sendError(connection, 'Invalid message format')
    }
  }

  /**
   * Handle channel subscription
   */
  private async handleSubscription(connection: WebSocketConnection, channels: string[]): Promise<void> {
    for (const channelName of channels) {
      // Validate channel access
      if (!this.canAccessChannel(connection.companyId, channelName)) {
        this.sendError(connection, `Access denied to channel: ${channelName}`)
        continue
      }

      connection.subscriptions.add(channelName)

      // Update channel metrics
      const channelKey = `${connection.companyId}:${channelName}`
      const channel = this.channels.get(channelKey)

      if (channel) {
        channel.subscriberCount++
      } else {
        this.channels.set(channelKey, {
          name: channelName,
          companyId: connection.companyId,
          lastUpdate: new Date(),
          subscriberCount: 1,
          messageRate: 0,
          compressionEnabled: true,
          batchingEnabled: channelName.includes('batch')
        })
      }

      // Send initial data for the channel
      await this.sendChannelInitialData(connection, channelName)
    }

    this.sendMessage(connection, {
      type: 'subscription_confirmed',
      data: { channels, timestamp: new Date() }
    })
  }

  /**
   * Handle channel unsubscription
   */
  private async handleUnsubscription(connection: WebSocketConnection, channels: string[]): Promise<void> {
    for (const channelName of channels) {
      connection.subscriptions.delete(channelName)

      // Update channel metrics
      const channelKey = `${connection.companyId}:${channelName}`
      const channel = this.channels.get(channelKey)

      if (channel) {
        channel.subscriberCount = Math.max(0, channel.subscriberCount - 1)

        // Remove channel if no subscribers
        if (channel.subscriberCount === 0) {
          this.channels.delete(channelKey)
        }
      }
    }

    this.sendMessage(connection, {
      type: 'unsubscription_confirmed',
      data: { channels, timestamp: new Date() }
    })
  }

  /**
   * Handle data request from client
   */
  private async handleDataRequest(connection: WebSocketConnection, request: any): Promise<void> {
    const { dataType, filters, requestId } = request

    try {
      // Check cache first
      const cacheKey = `realtime:${connection.companyId}:${dataType}:${JSON.stringify(filters)}`
      let data = await advancedCachingService.get(cacheKey)

      if (!data) {
        // Fetch data using optimized query
        const result = await concurrentQueryOptimizer.executeAnalyticsQuery(
          `realtime-${dataType}`,
          this.generateRealtimeQuery(dataType, connection.companyId, filters),
          [connection.companyId],
          {
            priority: 'high',
            timeout: 1000, // 1 second for real-time requests
            cacheKey,
            companyId: connection.companyId,
            tags: [`realtime:${dataType}`]
          }
        )

        data = result.data

        // Cache for short duration
        await advancedCachingService.set(cacheKey, data, 'L1_MEMORY', {
          ttl: 30000, // 30 seconds for real-time data
          tags: [`realtime:${dataType}`, `company:${connection.companyId}`]
        })
      }

      this.sendMessage(connection, {
        type: 'data_response',
        requestId,
        data,
        timestamp: new Date(),
        fromCache: !!data
      })

    } catch (error) {
      console.error('Data request error:', error)
      this.sendMessage(connection, {
        type: 'data_error',
        requestId,
        error: error.message,
        timestamp: new Date()
      })
    }
  }

  /**
   * Handle analytics event from client
   */
  private async handleAnalyticsEvent(connection: WebSocketConnection, eventData: any): Promise<void> {
    const event: RealtimeEvent = {
      id: crypto.randomUUID(),
      type: eventData.eventType || 'analytics_update',
      companyId: connection.companyId,
      payload: eventData.payload,
      timestamp: new Date(),
      priority: eventData.priority || 'medium',
      targetChannels: eventData.channels || ['dashboard'],
      expiresAt: eventData.expiresAt ? new Date(eventData.expiresAt) : undefined
    }

    await this.processRealtimeEvent(event)
  }

  /**
   * Process real-time event and broadcast to subscribers
   */
  async processRealtimeEvent(event: RealtimeEvent): Promise<void> {
    try {
      // Add to event queue for processing
      this.eventQueue.push(event)

      // Process event based on priority
      if (event.priority === 'critical' || event.priority === 'high') {
        await this.processEventImmediate(event)
      } else {
        // Batch process lower priority events
        this.scheduleEventProcessing()
      }

      // Emit event for other services
      this.emit('analytics_event', event)

    } catch (error) {
      console.error('Event processing error:', error)
    }
  }

  /**
   * Process high-priority event immediately
   */
  private async processEventImmediate(event: RealtimeEvent): Promise<void> {
    const targetConnections = this.getTargetConnections(event)

    // Prepare message
    const message = {
      type: 'realtime_update',
      eventId: event.id,
      eventType: event.type,
      data: event.payload,
      timestamp: event.timestamp,
      priority: event.priority
    }

    // Send to all target connections
    const broadcastPromises = targetConnections.map(connection =>
      this.sendMessage(connection, message)
    )

    await Promise.allSettled(broadcastPromises)
  }

  /**
   * Batch process events for efficiency
   */
  private async processBatchedEvents(): Promise<void> {
    if (this.eventQueue.length === 0) return

    // Group events by company and channel
    const eventGroups = this.groupEventsByTarget(this.eventQueue)
    this.eventQueue = [] // Clear processed events

    // Process each group
    for (const [target, events] of eventGroups) {
      const [companyId, channel] = target.split(':')
      const targetConnections = this.getConnectionsByCompanyAndChannel(companyId, channel)

      if (targetConnections.length === 0) continue

      // Batch events for efficiency
      const batchedMessage = {
        type: 'batched_update',
        events: events.map(event => ({
          id: event.id,
          type: event.type,
          data: event.payload,
          timestamp: event.timestamp,
          priority: event.priority
        })),
        batchSize: events.length,
        timestamp: new Date()
      }

      // Send batched message to all target connections
      const broadcastPromises = targetConnections.map(connection =>
        this.sendMessage(connection, batchedMessage, true) // Enable compression for batched messages
      )

      await Promise.allSettled(broadcastPromises)
    }
  }

  /**
   * Send message to connection with optimization
   */
  private async sendMessage(
    connection: WebSocketConnection,
    message: any,
    compress: boolean = false
  ): Promise<boolean> {
    if (connection.ws.readyState !== WebSocket.OPEN) {
      return false
    }

    try {
      const messageString = JSON.stringify(message)
      const messageSize = Buffer.byteLength(messageString)

      // Apply compression for large messages
      const shouldCompress = compress || messageSize > this.COMPRESSION_THRESHOLD

      if (shouldCompress) {
        // WebSocket compression is handled automatically by the library
      }

      connection.ws.send(messageString)
      connection.messagesSent++

      // Update bandwidth metrics
      this.metrics.bandwidthUsage += messageSize

      return true

    } catch (error) {
      console.error(`Failed to send message to ${connection.id}:`, error)
      return false
    }
  }

  /**
   * Send error message to connection
   */
  private sendError(connection: WebSocketConnection, error: string): void {
    this.sendMessage(connection, {
      type: 'error',
      error,
      timestamp: new Date()
    })
  }

  /**
   * Handle connection disconnection
   */
  private handleDisconnection(connection: WebSocketConnection): void {
    console.log(`WebSocket disconnected: ${connection.id}`)

    // Remove from channels
    for (const channelName of connection.subscriptions) {
      const channelKey = `${connection.companyId}:${channelName}`
      const channel = this.channels.get(channelKey)

      if (channel) {
        channel.subscriberCount = Math.max(0, channel.subscriberCount - 1)
      }
    }

    // Update metrics
    this.connections.delete(connection.id)
    this.metrics.activeConnections = this.connections.size
    this.metrics.connectionDropouts++
  }

  /**
   * Handle connection error
   */
  private handleConnectionError(connection: WebSocketConnection, error: any): void {
    console.error(`Connection error for ${connection.id}:`, error)
    this.metrics.errorRate++

    // Close connection on serious errors
    if (error.code === 'ECONNRESET' || error.code === 'EPIPE') {
      connection.ws.terminate()
      this.handleDisconnection(connection)
    }
  }

  /**
   * Handle server error
   */
  private handleServerError(error: any): void {
    console.error('WebSocket server error:', error)
  }

  /**
   * Authentication and authorization
   */
  private async authenticateConnection(request: IncomingMessage): Promise<{ companyId: string | null; userId?: string }> {
    // Extract authentication from headers or query params
    const authHeader = request.headers.authorization
    const urlParams = new URL(request.url || '', 'http://localhost').searchParams

    // Placeholder authentication - would integrate with actual auth system
    const companyId = urlParams.get('companyId') || 'default-company'
    const userId = urlParams.get('userId')

    return { companyId, userId }
  }

  private canAccessChannel(companyId: string, channelName: string): boolean {
    // Validate channel access based on company and permissions
    const allowedChannels = [
      'dashboard',
      'kpis',
      'alerts',
      'invoices',
      'payments',
      'customers',
      'system_status'
    ]

    return allowedChannels.includes(channelName)
  }

  /**
   * Channel management
   */
  private getAvailableChannels(companyId: string): string[] {
    return [
      'dashboard',
      'kpis',
      'alerts',
      'invoices',
      'payments',
      'customers',
      'system_status'
    ]
  }

  private async sendChannelInitialData(connection: WebSocketConnection, channelName: string): Promise<void> {
    try {
      // Get cached initial data for the channel
      const cacheKey = `channel_init:${connection.companyId}:${channelName}`
      let initialData = await advancedCachingService.get(cacheKey)

      if (!initialData) {
        // Generate initial data based on channel type
        initialData = await this.generateChannelInitialData(connection.companyId, channelName)

        // Cache for quick subsequent connections
        await advancedCachingService.set(cacheKey, initialData, 'L2_REDIS', {
          ttl: 60000, // 1 minute
          tags: [`channel:${channelName}`, `company:${connection.companyId}`]
        })
      }

      this.sendMessage(connection, {
        type: 'channel_initial_data',
        channel: channelName,
        data: initialData,
        timestamp: new Date()
      })

    } catch (error) {
      console.error(`Failed to send initial data for channel ${channelName}:`, error)
    }
  }

  private async generateChannelInitialData(companyId: string, channelName: string): Promise<any> {
    switch (channelName) {
      case 'dashboard':
        return { metrics: {}, charts: {}, alerts: [] }
      case 'kpis':
        return { kpis: {}, trends: {} }
      case 'alerts':
        return { alerts: [], notifications: [] }
      default:
        return {}
    }
  }

  /**
   * Event processing helpers
   */
  private getTargetConnections(event: RealtimeEvent): WebSocketConnection[] {
    const targetConnections: WebSocketConnection[] = []

    for (const connection of this.connections.values()) {
      if (connection.companyId !== event.companyId) continue

      // Check if connection subscribes to any target channels
      const hasMatchingSubscription = event.targetChannels.some(channel =>
        connection.subscriptions.has(channel)
      )

      if (hasMatchingSubscription) {
        targetConnections.push(connection)
      }
    }

    return targetConnections
  }

  private getConnectionsByCompanyAndChannel(companyId: string, channel: string): WebSocketConnection[] {
    return Array.from(this.connections.values()).filter(connection =>
      connection.companyId === companyId && connection.subscriptions.has(channel)
    )
  }

  private groupEventsByTarget(events: RealtimeEvent[]): Map<string, RealtimeEvent[]> {
    const groups = new Map<string, RealtimeEvent[]>()

    for (const event of events) {
      for (const channel of event.targetChannels) {
        const key = `${event.companyId}:${channel}`

        if (!groups.has(key)) {
          groups.set(key, [])
        }

        groups.get(key)!.push(event)
      }
    }

    return groups
  }

  private generateRealtimeQuery(dataType: string, companyId: string, filters: any): string {
    // Generate optimized real-time queries based on data type
    switch (dataType) {
      case 'dashboard_metrics':
        return `
          SELECT
            COUNT(CASE WHEN status = 'SENT' THEN 1 END) as sent_invoices,
            COUNT(CASE WHEN status = 'PAID' THEN 1 END) as paid_invoices,
            SUM(CASE WHEN status = 'OVERDUE' THEN total_amount ELSE 0 END) as overdue_amount
          FROM invoices
          WHERE company_id = $1 AND is_active = true
        `

      case 'recent_payments':
        return `
          SELECT id, amount, payment_date, method
          FROM payments p
          JOIN invoices i ON p.invoice_id = i.id
          WHERE i.company_id = $1
            AND p.payment_date >= CURRENT_DATE - INTERVAL '1 day'
          ORDER BY p.payment_date DESC
          LIMIT 10
        `

      default:
        return 'SELECT 1 as placeholder'
    }
  }

  /**
   * Monitoring and lifecycle
   */
  private initializeEventProcessing(): void {
    // Process batched events every 100ms for good responsiveness
    setInterval(() => {
      this.processBatchedEvents().catch(error =>
        console.error('Batch event processing error:', error)
      )
    }, 100)
  }

  private scheduleEventProcessing(): void {
    // Events are processed by the interval in initializeEventProcessing
  }

  private startHeartbeatMonitoring(): void {
    const interval = setInterval(() => {
      const now = new Date()

      for (const connection of this.connections.values()) {
        if (!connection.isAlive) {
          console.log(`Terminating inactive connection: ${connection.id}`)
          connection.ws.terminate()
          continue
        }

        // Check for stale connections
        const timeSinceLastPing = now.getTime() - connection.lastPing.getTime()
        if (timeSinceLastPing > this.HEARTBEAT_INTERVAL * 2) {
          console.log(`Connection ${connection.id} appears stale, terminating`)
          connection.ws.terminate()
          continue
        }

        // Send ping
        connection.isAlive = false
        connection.ws.ping()
      }
    }, this.HEARTBEAT_INTERVAL)

    // Store reference for cleanup
    this.heartbeatInterval = interval
  }

  private heartbeatInterval?: NodeJS.Timeout

  private startMetricsCollection(): void {
    setInterval(() => {
      // Calculate messages per second
      const totalMessages = Array.from(this.connections.values())
        .reduce((sum, conn) => sum + conn.messagesSent + conn.messagesReceived, 0)

      this.metrics.messagesPerSecond = totalMessages / 60 // Per second over last minute

      // Calculate average latency
      const latencies = Array.from(this.connections.values())
        .map(conn => conn.averageLatency)
        .filter(latency => latency > 0)

      this.metrics.averageLatency = latencies.length > 0
        ? latencies.reduce((sum, latency) => sum + latency, 0) / latencies.length
        : 0

      // Update active connections
      this.metrics.activeConnections = this.connections.size

      // Log metrics every 5 minutes
      if (Date.now() % 300000 < 1000) {
        console.log('Real-time Pipeline Metrics:', this.metrics)
      }
    }, 1000)
  }

  /**
   * Public API methods
   */
  async broadcastToCompany(
    companyId: string,
    channel: string,
    data: any,
    priority: 'low' | 'medium' | 'high' | 'critical' = 'medium'
  ): Promise<number> {
    const event: RealtimeEvent = {
      id: crypto.randomUUID(),
      type: 'analytics_update',
      companyId,
      payload: data,
      timestamp: new Date(),
      priority,
      targetChannels: [channel]
    }

    await this.processRealtimeEvent(event)

    // Return number of connections that received the message
    return this.getConnectionsByCompanyAndChannel(companyId, channel).length
  }

  getMetrics(): PipelineMetrics {
    return { ...this.metrics }
  }

  getConnectionCount(): number {
    return this.connections.size
  }

  getChannelCount(): number {
    return this.channels.size
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    console.log('Cleaning up real-time data pipeline...')

    // Clear heartbeat monitoring
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
    }

    // Close all connections
    for (const connection of this.connections.values()) {
      connection.ws.close(1001, 'Server shutting down')
    }

    // Close WebSocket server
    if (this.wss) {
      this.wss.close()
    }

    // Clear data structures
    this.connections.clear()
    this.channels.clear()
    this.eventQueue.length = 0

    console.log('Real-time data pipeline cleanup completed')
  }
}

// Export singleton instance
export const realtimeDataPipeline = new RealtimeDataPipeline()