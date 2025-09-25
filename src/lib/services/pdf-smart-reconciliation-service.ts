/**
 * PDF Smart Reconciliation Service
 * Integrates PDF text extraction with smart field mapping and confidence scoring
 */

export interface PDFExtractionResult {
  field: string
  value: string | null
  confidence: number
  rawValue?: string
  pattern?: string
  boundingBox?: {
    x: number
    y: number
    width: number
    height: number
  }
}

export interface ReconciliationResult {
  extractedFields: PDFExtractionResult[]
  confidence: number
  sourceFile: string
  extractionStats: {
    totalFields: number
    extractedFields: number
    highConfidenceFields: number
    mediumConfidenceFields: number
    lowConfidenceFields: number
  }
}

class PDFSmartReconciliationService {
  /**
   * Extract and reconcile data from PDF file
   */
  async extractAndReconcile(pdfFile: File): Promise<ReconciliationResult> {
    try {
      console.log(`🔍 Starting PDF reconciliation for: ${pdfFile.name}`)

      // Step 1: Extract invoice data using enhanced API (Textract or fallback)
      const extractedFields = await this.extractInvoiceFromPDF(pdfFile)

      console.log(`📝 Extracted ${extractedFields.length} fields from PDF`)

      // Step 2: Calculate overall reconciliation confidence
      const overallConfidence = this.calculateOverallConfidence(extractedFields)

      // Step 3: Generate extraction statistics
      const extractionStats = this.calculateExtractionStats(extractedFields)

      console.log(`✅ PDF reconciliation complete: ${overallConfidence}% confidence`)

      return {
        extractedFields,
        confidence: overallConfidence,
        sourceFile: pdfFile.name,
        extractionStats
      }

    } catch (error) {
      console.error('PDF reconciliation error:', error)
      throw new Error(`Failed to reconcile PDF: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Extract invoice data from PDF using enhanced API
   */
  private async extractInvoiceFromPDF(pdfFile: File): Promise<PDFExtractionResult[]> {
    const formData = new FormData()
    formData.append('file', pdfFile)

    const response = await fetch('/api/pdf/extract-invoice', {
      method: 'POST',
      body: formData
    })

    if (!response.ok) {
      throw new Error(`PDF invoice extraction failed: ${response.statusText}`)
    }

    const result = await response.json()
    if (!result.success) {
      throw new Error(result.error || 'PDF invoice extraction failed')
    }

    console.log(`📊 Extraction method: ${result.method}`)
    console.log(`📈 Processing time: ${result.processingTime}ms`)
    console.log(`🎯 Average confidence: ${result.stats.averageConfidence}%`)

    // Convert API response to our PDFExtractionResult format
    return result.extractedData.map((field: any) => ({
      field: field.field,
      value: field.value,
      confidence: field.confidence,
      rawValue: field.rawValue,
      pattern: field.source,
      boundingBox: field.boundingBox
    }))
  }

  /**
   * Extract fields with confidence scoring using enhanced patterns
   */
  private extractFieldsWithConfidence(text: string, fileName: string): PDFExtractionResult[] {
    const results: PDFExtractionResult[] = []

    // Enhanced extraction patterns with confidence scoring
    const extractionPatterns = [
      {
        field: 'customerName',
        patterns: [
          {
            pattern: /(?:Bill\s+To|Customer|Client)[\s:]+([A-Za-z\s&.-]+?)(?:\n|Email|Phone|TRN|Invoice)/i,
            confidence: 95,
            description: 'Standard Bill To'
          },
          {
            pattern: /Above The Clouds[\s\n]+Invoice[\s\w\n]*?(\w+(?:\s+\w+)*?)(?:\s+Invoice|\s+\d|\s*\n\s*\n)/i,
            confidence: 90,
            description: 'Above The Clouds format'
          },
          {
            pattern: /(\w+(?:\s+\w+)*?\s+(?:AG|GmbH|Ltd|LLC|Company|Corp|Inc))(?:\s|$)/i,
            confidence: 85,
            description: 'Company suffix format'
          },
          {
            pattern: /^([A-Z][A-Za-z\s&.-]+?)(?:\s+Invoice|\s+\d{2}|\s*\n)/m,
            confidence: 75,
            description: 'Line-start company'
          },
          {
            pattern: /([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3}(?:\s+(?:AG|GmbH|Ltd|LLC|Company|Corp|Inc))?)(?!\s+\d)/g,
            confidence: 70,
            description: 'Multi-word company'
          }
        ]
      },
      {
        field: 'email',
        patterns: [
          {
            pattern: /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g,
            confidence: 95,
            description: 'Email address'
          }
        ]
      },
      {
        field: 'phone',
        patterns: [
          {
            pattern: /(?:\+971|00971|971)[\s-]?[2-9][\d\s-]{8}/g,
            confidence: 95,
            description: 'UAE landline'
          },
          {
            pattern: /(?:\+971|00971|971)[\s-]?[5-9][\d\s-]{8}/g,
            confidence: 95,
            description: 'UAE mobile'
          },
          {
            pattern: /0[2-9][\d\s-]{8}/g,
            confidence: 85,
            description: 'Local UAE format'
          },
          {
            pattern: /\+49[\s\d-]{10,15}/g,
            confidence: 80,
            description: 'German format'
          },
          {
            pattern: /Phone:\s*([+\d\s-]{8,15})/i,
            confidence: 90,
            description: 'Labeled phone'
          },
          {
            pattern: /(\d{2,3}[-.\s]?\d{2,3}[-.\s]?\d{4,6})/g,
            confidence: 65,
            description: 'Generic phone'
          }
        ]
      },
      {
        field: 'trn',
        patterns: [
          {
            pattern: /TRN[\s:]*(1\d{14})/i,
            confidence: 95,
            description: 'UAE TRN format'
          }
        ]
      },
      {
        field: 'invoiceNumber',
        patterns: [
          {
            pattern: /Invoice\s*(?:No|Number|#)?\s*:?\s*([A-Z0-9\-\/]+)/i,
            confidence: 95,
            description: 'Standard invoice number'
          },
          {
            pattern: /INV[\s-]*(\d{6,})/i,
            confidence: 90,
            description: 'INV prefix'
          },
          {
            pattern: /(?:^|\n)([A-Z]{1,4}\d{6,10})(?:\n|$)/m,
            confidence: 85,
            description: 'Code + digits'
          },
          {
            pattern: /Reference:\s*([A-Z0-9\-\/]+)/i,
            confidence: 80,
            description: 'Reference number'
          },
          {
            pattern: /([A-Z0-9]{8,15})(?=\s+INVOICE|\s+Invoice)/i,
            confidence: 75,
            description: 'Pre-INVOICE code'
          },
          {
            pattern: /(V\d{8})/i,
            confidence: 85,
            description: 'V-number format'
          },
          {
            pattern: /Invoice\s+(\w+)/i,
            confidence: 70,
            description: 'Invoice + word'
          }
        ]
      },
      {
        field: 'amount',
        patterns: [
          {
            pattern: /Total[\s:]*AED[\s]*(\d+(?:,\d{3})*(?:\.\d{2})?)/i,
            confidence: 95,
            description: 'Total AED'
          },
          {
            pattern: /AED[\s]*(\d+(?:,\d{3})*(?:\.\d{2})?)/g,
            confidence: 85,
            description: 'AED amounts'
          },
          {
            pattern: /(\d+(?:,\d{3})*(?:\.\d{2})?)\s*AED/i,
            confidence: 85,
            description: 'Amount AED'
          },
          {
            pattern: /Total[\s:]*(\d+(?:,\d{3})*(?:\.\d{2})?)/i,
            confidence: 75,
            description: 'Total amount'
          },
          {
            pattern: /€[\s]*(\d+(?:,\d{3})*(?:\.\d{2})?)/g,
            confidence: 80,
            description: 'EUR amounts'
          },
          {
            pattern: /(\d{3,}(?:[.,]\d{2})?)/g,
            confidence: 60,
            description: 'Large numbers'
          }
        ]
      },
      {
        field: 'dueDate',
        patterns: [
          {
            pattern: /Due\s*(?:Date)?[\s:]*(\d{1,2}[-\/]\d{1,2}[-\/]\d{4})/i,
            confidence: 95,
            description: 'Due date'
          },
          {
            pattern: /Payment\s*Due[\s:]*(\d{1,2}[-\/]\d{1,2}[-\/]\d{4})/i,
            confidence: 90,
            description: 'Payment due date'
          }
        ]
      },
      {
        field: 'issueDate',
        patterns: [
          {
            pattern: /Invoice\s*Date[\s:]*(\d{1,2}[-\/]\d{1,2}[-\/]\d{4})/i,
            confidence: 95,
            description: 'Invoice date'
          },
          {
            pattern: /Date[\s:]*(\d{1,2}[-\/]\d{1,2}[-\/]\d{4})/i,
            confidence: 80,
            description: 'Generic date'
          }
        ]
      }
    ]

    // Apply extraction patterns
    for (const fieldConfig of extractionPatterns) {
      let bestMatch: PDFExtractionResult | null = null

      for (const patternConfig of fieldConfig.patterns) {
        const matches = text.match(patternConfig.pattern)

        if (matches && matches[1]) {
          const value = this.cleanExtractedValue(matches[1], fieldConfig.field)

          // Validate extracted value
          const isValid = this.validateExtractedValue(fieldConfig.field, value)

          if (isValid && (!bestMatch || patternConfig.confidence > bestMatch.confidence)) {
            bestMatch = {
              field: fieldConfig.field,
              value: value,
              confidence: patternConfig.confidence,
              rawValue: matches[1],
              pattern: patternConfig.description
            }
          }
        }
      }

      if (bestMatch) {
        results.push(bestMatch)
        console.log(`✅ ${bestMatch.field}: "${bestMatch.value}" (${bestMatch.confidence}% confidence)`)
      } else {
        results.push({
          field: fieldConfig.field,
          value: null,
          confidence: 0,
          rawValue: undefined,
          pattern: 'No match found'
        })
        console.log(`❌ ${fieldConfig.field}: No match found`)
      }
    }

    return results
  }

  /**
   * Clean extracted value based on field type
   */
  private cleanExtractedValue(rawValue: string, fieldType: string): string {
    let cleaned = rawValue.trim()

    switch (fieldType) {
      case 'customerName':
        // Remove extra whitespace and normalize
        cleaned = cleaned.replace(/\s+/g, ' ')
        // Remove trailing punctuation
        cleaned = cleaned.replace(/[.,;:]+$/, '')
        break

      case 'phone':
        // Remove all spaces and dashes for standardization
        cleaned = cleaned.replace(/[\s-]/g, '')
        break

      case 'amount':
        // Remove currency symbols and normalize number format
        cleaned = cleaned.replace(/[^\d.,]/g, '')
        // Ensure proper decimal format
        if (cleaned.includes(',') && cleaned.includes('.')) {
          // Handle European format (1,234.56)
          cleaned = cleaned.replace(/,/g, '')
        } else if (cleaned.includes(',') && cleaned.match(/,\d{2}$/)) {
          // Handle European decimal comma (1234,56)
          cleaned = cleaned.replace(/,/, '.')
        }
        break

      case 'email':
        cleaned = cleaned.toLowerCase()
        break

      case 'invoiceNumber':
        // Remove extra whitespace
        cleaned = cleaned.replace(/\s+/g, '')
        break

      case 'trn':
        // Remove all non-digit characters
        cleaned = cleaned.replace(/\D/g, '')
        break
    }

    return cleaned
  }

  /**
   * Validate extracted value based on field type
   */
  private validateExtractedValue(fieldType: string, value: string): boolean {
    if (!value || value.length === 0) return false

    switch (fieldType) {
      case 'customerName':
        return value.length >= 2 && value.length <= 100 && !/^\d+$/.test(value)

      case 'email':
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        return emailRegex.test(value)

      case 'phone':
        // UAE phone format validation
        const uaePhoneRegex = /^(\+971|00971|971|0)?([2-9]\d{8}|5[0-9]\d{7})$/
        return uaePhoneRegex.test(value.replace(/\s/g, ''))

      case 'trn':
        return /^\d{15}$/.test(value)

      case 'amount':
        const amount = parseFloat(value)
        return !isNaN(amount) && amount > 10 // Minimum reasonable invoice amount

      case 'invoiceNumber':
        return value.length >= 3 && value.length <= 50

      case 'dueDate':
      case 'issueDate':
        return !isNaN(Date.parse(value))

      default:
        return true
    }
  }

  /**
   * Calculate overall confidence score
   */
  private calculateOverallConfidence(extractedFields: PDFExtractionResult[]): number {
    const fieldsWithValues = extractedFields.filter(field => field.value !== null)

    if (fieldsWithValues.length === 0) return 0

    const totalConfidence = fieldsWithValues.reduce((sum, field) => sum + field.confidence, 0)
    const averageConfidence = totalConfidence / fieldsWithValues.length

    // Apply weights for critical fields
    const criticalFields = ['customerName', 'invoiceNumber', 'amount']
    const criticalFieldsFound = fieldsWithValues.filter(field =>
      criticalFields.includes(field.field)
    ).length

    const criticalFieldBonus = (criticalFieldsFound / criticalFields.length) * 10

    return Math.min(averageConfidence + criticalFieldBonus, 100)
  }

  /**
   * Calculate extraction statistics
   */
  private calculateExtractionStats(extractedFields: PDFExtractionResult[]) {
    const totalFields = extractedFields.length
    const extractedFieldsCount = extractedFields.filter(field => field.value !== null).length
    const highConfidenceFields = extractedFields.filter(field => field.confidence >= 95).length
    const mediumConfidenceFields = extractedFields.filter(field =>
      field.confidence >= 70 && field.confidence < 95
    ).length
    const lowConfidenceFields = extractedFields.filter(field =>
      field.confidence > 0 && field.confidence < 70
    ).length

    return {
      totalFields,
      extractedFields: extractedFieldsCount,
      highConfidenceFields,
      mediumConfidenceFields,
      lowConfidenceFields
    }
  }

  /**
   * Validate reconciliation result before import
   */
  validateReconciliation(reconciledData: Record<string, any>): {
    isValid: boolean
    errors: string[]
    warnings: string[]
  } {
    const errors: string[] = []
    const warnings: string[] = []

    // Required field validation
    const requiredFields = ['customerName', 'invoiceNumber', 'amount', 'dueDate']

    for (const field of requiredFields) {
      if (!reconciledData[field] || reconciledData[field].toString().trim() === '') {
        errors.push(`${field} is required`)
      }
    }

    // Business logic validation
    if (reconciledData.amount) {
      const amount = parseFloat(reconciledData.amount.toString().replace(/,/g, ''))
      if (isNaN(amount) || amount <= 0) {
        errors.push('Amount must be a positive number')
      } else if (amount > 1000000) {
        warnings.push('Amount is unusually large, please verify')
      }
    }

    if (reconciledData.dueDate) {
      const dueDate = new Date(reconciledData.dueDate)
      const today = new Date()
      if (dueDate < today) {
        warnings.push('Due date is in the past')
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    }
  }
}

export const pdfSmartReconciliationService = new PDFSmartReconciliationService()