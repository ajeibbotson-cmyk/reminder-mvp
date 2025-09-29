import { Customer } from '@prisma/client'
import { prisma } from '@/lib/prisma'

export interface ExtractedCustomerData {
  name: string
  email?: string
  phone?: string
  trn?: string
  address?: string
  contactPerson?: string
  source: 'spreadsheet' | 'pdf'
  sourceFile: string
  confidence: number
  rawData: Record<string, any>
}

export interface CustomerMatchResult {
  extracted: ExtractedCustomerData
  existingCustomer?: Customer
  matchScore: number
  matchType: 'exact' | 'fuzzy' | 'manual_review' | 'new'
  duplicates: Customer[]
}

export interface CustomerExtractionSummary {
  totalExtracted: number
  exactMatches: number
  fuzzyMatches: number
  newCustomers: number
  duplicatesFound: number
  manualReviewRequired: number
  errors: Array<{
    file: string
    error: string
    data?: any
  }>
}

export class CustomerExtractionService {
  private companyId: string

  constructor(companyId: string) {
    this.companyId = companyId
  }

  /**
   * Extract customer data from spreadsheet files
   */
  extractFromSpreadsheet(
    data: Record<string, any>[],
    fileName: string,
    fieldMappings: Record<string, string>
  ): ExtractedCustomerData[] {
    const extracted: ExtractedCustomerData[] = []

    for (const row of data) {
      try {
        const customerData: ExtractedCustomerData = {
          name: this.extractValue(row, fieldMappings['customerName'] || 'customer_name') ||
                this.extractValue(row, fieldMappings['name'] || 'name') ||
                'Unknown Customer',
          email: this.extractValue(row, fieldMappings['customerEmail'] || 'customer_email') ||
                 this.extractValue(row, fieldMappings['email'] || 'email'),
          phone: this.extractValue(row, fieldMappings['customerPhone'] || 'customer_phone') ||
                 this.extractValue(row, fieldMappings['phone'] || 'phone'),
          trn: this.extractValue(row, fieldMappings['customerTrn'] || 'customer_trn') ||
               this.extractValue(row, fieldMappings['trn'] || 'trn'),
          address: this.extractValue(row, fieldMappings['customerAddress'] || 'customer_address') ||
                   this.extractValue(row, fieldMappings['address'] || 'address'),
          contactPerson: this.extractValue(row, fieldMappings['contactPerson'] || 'contact_person'),
          source: 'spreadsheet',
          sourceFile: fileName,
          confidence: this.calculateConfidence(row, fieldMappings),
          rawData: row
        }

        // Clean and validate data
        customerData.name = this.cleanName(customerData.name)
        if (customerData.email) {
          customerData.email = this.cleanEmail(customerData.email)
        }
        if (customerData.phone) {
          customerData.phone = this.cleanPhone(customerData.phone)
        }
        if (customerData.trn) {
          customerData.trn = this.cleanTRN(customerData.trn)
        }

        // Only include customers with minimum required data
        if (customerData.name && customerData.name !== 'Unknown Customer') {
          extracted.push(customerData)
        }
      } catch (error) {
        console.error('Error extracting customer from row:', error, row)
        // Continue processing other rows
      }
    }

    return extracted
  }

  /**
   * Extract customer data from PDF files (basic implementation)
   */
  extractFromPDF(
    pdfText: string,
    fileName: string
  ): ExtractedCustomerData[] {
    const extracted: ExtractedCustomerData[] = []

    try {
      // Basic text extraction patterns for UAE invoices
      const nameMatch = pdfText.match(/(?:Bill\s+To|Customer|Client)[\s:]+([A-Za-z\s&.-]+?)(?:\n|$)/i)
      const emailMatch = pdfText.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i)
      const phoneMatch = pdfText.match(/(?:\+971|00971|971)?[\s-]?[5-9][\d\s-]{8}/g)
      const trnMatch = pdfText.match(/TRN[\s:]*(\d{15})/i)

      if (nameMatch) {
        const customerData: ExtractedCustomerData = {
          name: this.cleanName(nameMatch[1].trim()),
          email: emailMatch ? this.cleanEmail(emailMatch[1]) : undefined,
          phone: phoneMatch ? this.cleanPhone(phoneMatch[0]) : undefined,
          trn: trnMatch ? this.cleanTRN(trnMatch[1]) : undefined,
          source: 'pdf',
          sourceFile: fileName,
          confidence: this.calculatePDFConfidence(nameMatch, emailMatch, phoneMatch, trnMatch),
          rawData: { originalText: pdfText }
        }

        extracted.push(customerData)
      }
    } catch (error) {
      console.error('Error extracting customer from PDF:', error)
    }

    return extracted
  }

  /**
   * Match extracted customers against existing database
   */
  async matchCustomers(extracted: ExtractedCustomerData[]): Promise<CustomerMatchResult[]> {
    const results: CustomerMatchResult[] = []

    // Get all existing customers for the company
    const existingCustomers = await prisma.customers.findMany({
      where: { companyId: this.companyId }
    })

    for (const extractedData of extracted) {
      const matchResult = await this.findBestMatch(extractedData, existingCustomers)
      results.push(matchResult)
    }

    return results
  }

  /**
   * Find best match for extracted customer data
   */
  private async findBestMatch(
    extracted: ExtractedCustomerData,
    existingCustomers: Customer[]
  ): Promise<CustomerMatchResult> {
    const matches: Array<{ customer: Customer; score: number }> = []

    for (const existing of existingCustomers) {
      const score = this.calculateMatchScore(extracted, existing)
      if (score > 0.3) { // Minimum threshold for considering a match
        matches.push({ customer: existing, score })
      }
    }

    // Sort by score descending
    matches.sort((a, b) => b.score - a.score)

    if (matches.length === 0) {
      return {
        extracted,
        matchScore: 0,
        matchType: 'new',
        duplicates: []
      }
    }

    const bestMatch = matches[0]
    const duplicates = matches.slice(1, 4).map(m => m.customer) // Top 3 additional matches

    let matchType: CustomerMatchResult['matchType']
    if (bestMatch.score >= 0.95) {
      matchType = 'exact'
    } else if (bestMatch.score >= 0.7) {
      matchType = 'fuzzy'
    } else {
      matchType = 'manual_review'
    }

    return {
      extracted,
      existingCustomer: bestMatch.customer,
      matchScore: bestMatch.score,
      matchType,
      duplicates
    }
  }

  /**
   * Calculate match score between extracted and existing customer
   */
  private calculateMatchScore(extracted: ExtractedCustomerData, existing: Customer): number {
    let score = 0
    let factors = 0

    // Name matching (most important factor)
    if (extracted.name && existing.name) {
      const nameScore = this.calculateStringSimilarity(
        extracted.name.toLowerCase(),
        existing.name.toLowerCase()
      )
      score += nameScore * 0.4
      factors += 0.4
    }

    // Email matching (high importance)
    if (extracted.email && existing.email) {
      if (extracted.email.toLowerCase() === existing.email.toLowerCase()) {
        score += 0.3
      }
      factors += 0.3
    }

    // Phone matching (medium importance)
    if (extracted.phone && existing.phone) {
      const phoneScore = this.calculatePhoneSimilarity(extracted.phone, existing.phone)
      score += phoneScore * 0.2
      factors += 0.2
    }

    // TRN matching (high importance for businesses)
    if (extracted.trn && existing.trn) {
      if (extracted.trn === existing.trn) {
        score += 0.25
      }
      factors += 0.25
    }

    // Normalize score by total factors considered
    return factors > 0 ? score / factors : 0
  }

  /**
   * Calculate string similarity using Levenshtein distance
   */
  private calculateStringSimilarity(str1: string, str2: string): number {
    const maxLength = Math.max(str1.length, str2.length)
    if (maxLength === 0) return 1

    const distance = this.levenshteinDistance(str1, str2)
    return (maxLength - distance) / maxLength
  }

  /**
   * Calculate phone number similarity
   */
  private calculatePhoneSimilarity(phone1: string, phone2: string): number {
    // Normalize phone numbers for comparison
    const normalized1 = phone1.replace(/\D/g, '').slice(-9) // Last 9 digits
    const normalized2 = phone2.replace(/\D/g, '').slice(-9)

    return normalized1 === normalized2 ? 1 : 0
  }

  /**
   * Levenshtein distance implementation
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null))

    for (let i = 0; i <= str1.length; i++) {
      matrix[0][i] = i
    }

    for (let j = 0; j <= str2.length; j++) {
      matrix[j][0] = j
    }

    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const substitutionCost = str1[i - 1] === str2[j - 1] ? 0 : 1
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1, // insertion
          matrix[j - 1][i] + 1, // deletion
          matrix[j - 1][i - 1] + substitutionCost // substitution
        )
      }
    }

    return matrix[str2.length][str1.length]
  }

  /**
   * Create new customers from unmatched extracted data
   */
  async createNewCustomers(
    matchResults: CustomerMatchResult[],
    userId: string
  ): Promise<Customer[]> {
    const newCustomers: Customer[] = []

    const toCreate = matchResults.filter(result => result.matchType === 'new')

    for (const result of toCreate) {
      try {
        const customerData = {
          name: result.extracted.name,
          email: result.extracted.email,
          phone: result.extracted.phone,
          trn: result.extracted.trn,
          address: result.extracted.address,
          contactPerson: result.extracted.contactPerson,
          companyId: this.companyId,
          isActive: true,
          createdBy: userId,
          createdAt: new Date(),
          updatedAt: new Date()
        }

        const customer = await prisma.customers.create({
          data: customerData
        })

        newCustomers.push(customer)
      } catch (error) {
        console.error('Error creating customer:', error, result.extracted)
      }
    }

    return newCustomers
  }

  /**
   * Generate extraction summary
   */
  generateSummary(matchResults: CustomerMatchResult[]): CustomerExtractionSummary {
    return {
      totalExtracted: matchResults.length,
      exactMatches: matchResults.filter(r => r.matchType === 'exact').length,
      fuzzyMatches: matchResults.filter(r => r.matchType === 'fuzzy').length,
      newCustomers: matchResults.filter(r => r.matchType === 'new').length,
      duplicatesFound: matchResults.reduce((sum, r) => sum + r.duplicates.length, 0),
      manualReviewRequired: matchResults.filter(r => r.matchType === 'manual_review').length,
      errors: []
    }
  }

  // Private helper methods
  private extractValue(row: Record<string, any>, field: string): string | undefined {
    const value = row[field] || row[field.toLowerCase()] || row[field.toUpperCase()]
    return value ? String(value).trim() : undefined
  }

  private cleanName(name: string): string {
    return name.trim()
      .replace(/\s+/g, ' ')
      .replace(/[^\w\s&.-]/g, '')
      .substring(0, 100)
  }

  private cleanEmail(email: string): string | undefined {
    const cleaned = email.toLowerCase().trim()
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(cleaned) ? cleaned : undefined
  }

  private cleanPhone(phone: string): string | undefined {
    let cleaned = phone.replace(/\D/g, '')

    // Handle UAE phone numbers
    if (cleaned.startsWith('971')) {
      cleaned = '+' + cleaned
    } else if (cleaned.startsWith('00971')) {
      cleaned = '+' + cleaned.substring(2)
    } else if (cleaned.length === 9) {
      cleaned = '+971' + cleaned
    }

    const uaePhoneRegex = /^\+971[5-9]\d{8}$/
    return uaePhoneRegex.test(cleaned) ? cleaned : phone.trim()
  }

  private cleanTRN(trn: string): string | undefined {
    const cleaned = trn.replace(/\D/g, '')
    return cleaned.length === 15 ? cleaned : undefined
  }

  private calculateConfidence(row: Record<string, any>, fieldMappings: Record<string, string>): number {
    let score = 0.5 // Base score

    // Check for required fields
    if (this.extractValue(row, fieldMappings['customerName'] || 'customer_name')) score += 0.2
    if (this.extractValue(row, fieldMappings['customerEmail'] || 'customer_email')) score += 0.15
    if (this.extractValue(row, fieldMappings['customerPhone'] || 'customer_phone')) score += 0.1
    if (this.extractValue(row, fieldMappings['customerTrn'] || 'customer_trn')) score += 0.05

    return Math.min(score, 1.0)
  }

  private calculatePDFConfidence(
    nameMatch: RegExpMatchArray | null,
    emailMatch: RegExpMatchArray | null,
    phoneMatch: RegExpMatchArray | null,
    trnMatch: RegExpMatchArray | null
  ): number {
    let score = 0.3 // Base score for PDF extraction

    if (nameMatch) score += 0.3
    if (emailMatch) score += 0.2
    if (phoneMatch) score += 0.15
    if (trnMatch) score += 0.05

    return Math.min(score, 1.0)
  }
}

/**
 * Utility function to create customer extraction service
 */
export function createCustomerExtractionService(companyId: string): CustomerExtractionService {
  return new CustomerExtractionService(companyId)
}