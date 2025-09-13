import { prisma } from '../prisma'

export interface ABTestVariant {
  id: string
  name: string
  description?: string
  weight: number // 0.0 to 1.0 (percentage allocation)
  emailTemplate?: {
    subject: string
    content: string
    variables?: Record<string, any>
  }
}

export interface ABTestConfig {
  id: string
  name: string
  description?: string
  companyId: string
  variants: ABTestVariant[]
  targetAudience: {
    customerSegment?: string
    invoiceStatus?: string[]
    customFilters?: Record<string, any>
  }
  successMetrics: {
    primary: 'open_rate' | 'click_rate' | 'conversion_rate' | 'response_rate'
    secondary?: string[]
  }
  minimumSampleSize: number
  significanceLevel: number // Default 0.05 (95% confidence)
  power: number // Default 0.8 (80% power)
  status: 'draft' | 'running' | 'paused' | 'completed' | 'cancelled'
  startDate: Date
  endDate?: Date
  createdAt: Date
  updatedAt: Date
}

export interface ABTestResult {
  variantId: string
  variantName: string
  totalSent: number
  delivered: number
  opened: number
  clicked: number
  converted: number
  
  // Calculated rates
  deliveryRate: number
  openRate: number
  clickRate: number
  conversionRate: number
  
  // Statistical significance
  confidenceInterval: {
    lower: number
    upper: number
  }
  pValue: number
  zScore: number
  isStatisticallySignificant: boolean
  
  // Performance relative to control
  relativeImprovement: number
  relativeLift: number
}

export interface ABTestAnalysis {
  testId: string
  testName: string
  status: 'insufficient_data' | 'running' | 'significant_winner' | 'no_clear_winner' | 'inconclusive'
  winner?: {
    variantId: string
    variantName: string
    improvement: number
    confidence: number
  }
  results: ABTestResult[]
  recommendations: string[]
  statisticalSummary: {
    totalSampleSize: number
    testDuration: number // days
    requiredSampleSize: number
    currentPower: number
    hasReachedSignificance: boolean
    shouldContinueTest: boolean
    estimatedDaysToSignificance?: number
  }
}

/**
 * A/B Testing Service with Statistical Significance Calculations
 * Provides rigorous statistical analysis for email campaign testing
 */
export class ABTestingService {
  
  /**
   * Create a new A/B test
   */
  async createABTest(config: Omit<ABTestConfig, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    try {
      // Validate test configuration
      this.validateABTestConfig(config)
      
      // Calculate minimum sample size based on expected effect size
      const calculatedSampleSize = this.calculateMinimumSampleSize(
        config.significanceLevel,
        config.power,
        0.05 // Assumed minimum detectable effect (5% improvement)
      )
      
      const testId = crypto.randomUUID()
      
      // Store A/B test configuration
      await prisma.abTestConfig.create({
        data: {
          id: testId,
          name: config.name,
          description: config.description,
          companyId: config.companyId,
          variants: JSON.stringify(config.variants),
          targetAudience: JSON.stringify(config.targetAudience),
          successMetrics: JSON.stringify(config.successMetrics),
          minimumSampleSize: Math.max(config.minimumSampleSize, calculatedSampleSize),
          significanceLevel: config.significanceLevel,
          power: config.power,
          status: config.status,
          startDate: config.startDate,
          endDate: config.endDate
        }
      })
      
      console.log(`Created A/B test ${testId} with minimum sample size: ${calculatedSampleSize}`)
      return testId
      
    } catch (error) {
      console.error('Failed to create A/B test:', error)
      throw error
    }
  }
  
  /**
   * Assign a variant to a recipient based on test configuration
   */
  async assignVariant(
    testId: string,
    recipientEmail: string,
    recipientId?: string
  ): Promise<ABTestVariant | null> {
    try {
      const test = await prisma.abTestConfig.findUnique({
        where: { id: testId }
      })
      
      if (!test || test.status !== 'running') {
        return null
      }
      
      const variants: ABTestVariant[] = JSON.parse(test.variants as string)
      
      // Check if recipient already assigned to a variant
      const existingAssignment = await prisma.abTestAssignment.findFirst({
        where: {
          testId,
          recipientEmail
        }
      })
      
      if (existingAssignment) {
        const assignedVariant = variants.find(v => v.id === existingAssignment.variantId)
        return assignedVariant || null
      }
      
      // Assign variant based on weighted random selection
      const selectedVariant = this.selectVariantByWeight(variants, recipientEmail)
      
      // Store assignment
      await prisma.abTestAssignment.create({
        data: {
          id: crypto.randomUUID(),
          testId,
          variantId: selectedVariant.id,
          recipientEmail,
          recipientId,
          assignedAt: new Date()
        }
      })
      
      return selectedVariant
      
    } catch (error) {
      console.error('Failed to assign A/B test variant:', error)
      return null
    }
  }
  
  /**
   * Track an event for A/B test analysis
   */
  async trackEvent(
    testId: string,
    recipientEmail: string,
    eventType: 'sent' | 'delivered' | 'opened' | 'clicked' | 'converted',
    eventData?: Record<string, any>
  ): Promise<void> {
    try {
      const assignment = await prisma.abTestAssignment.findFirst({
        where: {
          testId,
          recipientEmail
        }
      })
      
      if (!assignment) {
        console.warn(`No A/B test assignment found for ${recipientEmail} in test ${testId}`)
        return
      }
      
      // Track the event
      await prisma.abTestEvent.create({
        data: {
          id: crypto.randomUUID(),
          testId,
          assignmentId: assignment.id,
          eventType,
          eventData: eventData ? JSON.stringify(eventData) : null,
          timestamp: new Date()
        }
      })
      
    } catch (error) {
      console.error('Failed to track A/B test event:', error)
    }
  }
  
  /**
   * Analyze A/B test results with statistical significance
   */
  async analyzeABTest(testId: string): Promise<ABTestAnalysis> {
    try {
      const test = await prisma.abTestConfig.findUnique({
        where: { id: testId },
        include: {
          assignments: {
            include: {
              events: true
            }
          }
        }
      })
      
      if (!test) {
        throw new Error('A/B test not found')
      }
      
      const variants: ABTestVariant[] = JSON.parse(test.variants as string)
      const successMetrics = JSON.parse(test.successMetrics as string)
      
      // Calculate results for each variant
      const results: ABTestResult[] = []
      
      for (const variant of variants) {
        const variantAssignments = test.assignments.filter(a => a.variantId === variant.id)
        const variantResult = this.calculateVariantMetrics(variant, variantAssignments, successMetrics.primary)
        results.push(variantResult)
      }
      
      // Perform statistical significance testing
      const controlResult = results[0] // First variant is typically control
      const testResults = results.slice(1)
      
      for (const testResult of testResults) {
        const significance = this.calculateStatisticalSignificance(
          controlResult,
          testResult,
          test.significanceLevel
        )
        
        testResult.pValue = significance.pValue
        testResult.zScore = significance.zScore
        testResult.isStatisticallySignificant = significance.isSignificant
        testResult.confidenceInterval = significance.confidenceInterval
        testResult.relativeImprovement = significance.relativeImprovement
        testResult.relativeLift = significance.relativeLift
      }
      
      // Determine overall test status and winner
      const analysis = this.determineTestStatus(test, results)
      
      return {
        testId,
        testName: test.name,
        status: analysis.status,
        winner: analysis.winner,
        results,
        recommendations: analysis.recommendations,
        statisticalSummary: {
          totalSampleSize: results.reduce((sum, r) => sum + r.totalSent, 0),
          testDuration: Math.ceil((Date.now() - test.startDate.getTime()) / (1000 * 60 * 60 * 24)),
          requiredSampleSize: test.minimumSampleSize,
          currentPower: analysis.currentPower,
          hasReachedSignificance: results.some(r => r.isStatisticallySignificant),
          shouldContinueTest: analysis.shouldContinue,
          estimatedDaysToSignificance: analysis.estimatedDaysToSignificance
        }
      }
      
    } catch (error) {
      console.error('Failed to analyze A/B test:', error)
      throw error
    }
  }
  
  /**
   * Calculate minimum sample size for A/B test
   */
  private calculateMinimumSampleSize(
    significanceLevel: number,
    power: number,
    minimumDetectableEffect: number
  ): number {
    // Using simplified formula for two-proportion z-test
    // In production, you'd use a more sophisticated statistical library
    
    const alpha = significanceLevel
    const beta = 1 - power
    const p1 = 0.15 // Baseline conversion rate assumption (15%)
    const p2 = p1 + minimumDetectableEffect // Expected improved rate
    const pPooled = (p1 + p2) / 2
    
    // Z-scores for alpha and beta
    const zAlpha = this.getZScore(1 - alpha / 2) // Two-tailed
    const zBeta = this.getZScore(1 - beta)
    
    // Sample size calculation
    const numerator = Math.pow(zAlpha + zBeta, 2) * 2 * pPooled * (1 - pPooled)
    const denominator = Math.pow(p2 - p1, 2)
    
    const sampleSizePerVariant = Math.ceil(numerator / denominator)
    
    return sampleSizePerVariant * 2 // For two variants
  }
  
  /**
   * Get Z-score for given probability (approximation)
   */
  private getZScore(probability: number): number {
    // Simplified approximation - in production use proper statistical library
    if (probability >= 0.975) return 1.96 // 95% confidence
    if (probability >= 0.95) return 1.645 // 90% confidence
    if (probability >= 0.90) return 1.282 // 80% confidence
    return 1.96 // Default to 95%
  }
  
  /**
   * Calculate statistical significance between two variants
   */
  private calculateStatisticalSignificance(
    control: ABTestResult,
    test: ABTestResult,
    significanceLevel: number
  ): {
    pValue: number
    zScore: number
    isSignificant: boolean
    confidenceInterval: { lower: number; upper: number }
    relativeImprovement: number
    relativeLift: number
  } {
    // Using two-proportion z-test
    const p1 = control.openRate / 100 // Convert percentage to decimal
    const n1 = control.totalSent
    const p2 = test.openRate / 100
    const n2 = test.totalSent
    
    // Pooled proportion
    const pPooled = ((p1 * n1) + (p2 * n2)) / (n1 + n2)
    
    // Standard error
    const se = Math.sqrt(pPooled * (1 - pPooled) * (1/n1 + 1/n2))
    
    // Z-score
    const zScore = (p2 - p1) / se
    
    // P-value (two-tailed)
    const pValue = 2 * (1 - this.normalCDF(Math.abs(zScore)))
    
    // Confidence interval for difference
    const marginOfError = 1.96 * se // 95% confidence
    const difference = p2 - p1
    const confidenceInterval = {
      lower: (difference - marginOfError) * 100,
      upper: (difference + marginOfError) * 100
    }
    
    // Relative metrics
    const relativeImprovement = p1 > 0 ? ((p2 - p1) / p1) * 100 : 0
    const relativeLift = p2 - p1
    
    return {
      pValue,
      zScore,
      isSignificant: pValue < significanceLevel,
      confidenceInterval,
      relativeImprovement,
      relativeLift
    }
  }
  
  /**
   * Approximate normal cumulative distribution function
   */
  private normalCDF(x: number): number {
    // Approximation using error function
    const a1 =  0.254829592
    const a2 = -0.284496736
    const a3 =  1.421413741
    const a4 = -1.453152027
    const a5 =  1.061405429
    const p  =  0.3275911
    
    const sign = x < 0 ? -1 : 1
    x = Math.abs(x) / Math.sqrt(2.0)
    
    const t = 1.0 / (1.0 + p * x)
    const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x)
    
    return 0.5 * (1.0 + sign * y)
  }
  
  /**
   * Select variant based on weighted distribution
   */
  private selectVariantByWeight(variants: ABTestVariant[], recipientEmail: string): ABTestVariant {
    // Use email hash for consistent assignment
    const hash = this.hashString(recipientEmail)
    const random = hash % 1000000 / 1000000 // 0 to 1
    
    let cumulativeWeight = 0
    for (const variant of variants) {
      cumulativeWeight += variant.weight
      if (random <= cumulativeWeight) {
        return variant
      }
    }
    
    return variants[variants.length - 1] // Fallback to last variant
  }
  
  /**
   * Simple string hash function
   */
  private hashString(str: string): number {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32-bit integer
    }
    return Math.abs(hash)
  }
  
  /**
   * Calculate metrics for a specific variant
   */
  private calculateVariantMetrics(
    variant: ABTestVariant,
    assignments: any[],
    primaryMetric: string
  ): ABTestResult {
    let totalSent = 0
    let delivered = 0
    let opened = 0
    let clicked = 0
    let converted = 0
    
    for (const assignment of assignments) {
      const events = assignment.events || []
      const hasEvent = (eventType: string) => events.some((e: any) => e.eventType === eventType)
      
      if (hasEvent('sent')) totalSent++
      if (hasEvent('delivered')) delivered++
      if (hasEvent('opened')) opened++
      if (hasEvent('clicked')) clicked++
      if (hasEvent('converted')) converted++
    }
    
    const deliveryRate = totalSent > 0 ? (delivered / totalSent) * 100 : 0
    const openRate = delivered > 0 ? (opened / delivered) * 100 : 0
    const clickRate = opened > 0 ? (clicked / opened) * 100 : 0
    const conversionRate = totalSent > 0 ? (converted / totalSent) * 100 : 0
    
    return {
      variantId: variant.id,
      variantName: variant.name,
      totalSent,
      delivered,
      opened,
      clicked,
      converted,
      deliveryRate,
      openRate,
      clickRate,
      conversionRate,
      confidenceInterval: { lower: 0, upper: 0 }, // Will be calculated later
      pValue: 1.0,
      zScore: 0,
      isStatisticallySignificant: false,
      relativeImprovement: 0,
      relativeLift: 0
    }
  }
  
  /**
   * Determine overall test status and recommendations
   */
  private determineTestStatus(test: any, results: ABTestResult[]): {
    status: ABTestAnalysis['status']
    winner?: ABTestAnalysis['winner']
    recommendations: string[]
    currentPower: number
    shouldContinue: boolean
    estimatedDaysToSignificance?: number
  } {
    const totalSampleSize = results.reduce((sum, r) => sum + r.totalSent, 0)
    const hasEnoughData = totalSampleSize >= test.minimumSampleSize
    
    const significantResults = results.filter(r => r.isStatisticallySignificant)
    const bestPerformer = results.reduce((best, current) => 
      current.openRate > best.openRate ? current : best
    )
    
    let status: ABTestAnalysis['status'] = 'running'
    let winner: ABTestAnalysis['winner'] | undefined
    const recommendations: string[] = []
    
    if (!hasEnoughData) {
      status = 'insufficient_data'
      recommendations.push(`Need ${test.minimumSampleSize - totalSampleSize} more samples to reach statistical power`)
    } else if (significantResults.length > 0) {
      status = 'significant_winner'
      const winningVariant = significantResults.reduce((best, current) => 
        current.relativeImprovement > best.relativeImprovement ? current : best
      )
      
      winner = {
        variantId: winningVariant.variantId,
        variantName: winningVariant.variantName,
        improvement: winningVariant.relativeImprovement,
        confidence: (1 - winningVariant.pValue) * 100
      }
      
      recommendations.push(`${winner.variantName} is the clear winner with ${winner.improvement.toFixed(2)}% improvement`)
      recommendations.push('Consider implementing this variant for all future campaigns')
    } else if (hasEnoughData) {
      status = 'no_clear_winner'
      recommendations.push('No variant shows statistically significant improvement')
      recommendations.push('Consider running test longer or testing more dramatic differences')
    }
    
    // Calculate current power (simplified)
    const currentPower = Math.min(0.8, totalSampleSize / test.minimumSampleSize)
    const shouldContinue = !hasEnoughData && status === 'running'
    
    return {
      status,
      winner,
      recommendations,
      currentPower,
      shouldContinue,
      estimatedDaysToSignificance: shouldContinue ? 
        Math.ceil((test.minimumSampleSize - totalSampleSize) / (totalSampleSize / 7)) : // Assume weekly rate
        undefined
    }
  }
  
  /**
   * Validate A/B test configuration
   */
  private validateABTestConfig(config: Omit<ABTestConfig, 'id' | 'createdAt' | 'updatedAt'>): void {
    if (config.variants.length < 2) {
      throw new Error('A/B test must have at least 2 variants')
    }
    
    const totalWeight = config.variants.reduce((sum, v) => sum + v.weight, 0)
    if (Math.abs(totalWeight - 1.0) > 0.001) {
      throw new Error('Variant weights must sum to 1.0')
    }
    
    if (config.significanceLevel <= 0 || config.significanceLevel >= 1) {
      throw new Error('Significance level must be between 0 and 1')
    }
    
    if (config.power <= 0 || config.power >= 1) {
      throw new Error('Power must be between 0 and 1')
    }
  }
}

// Export singleton instance
export const abTestingService = new ABTestingService()