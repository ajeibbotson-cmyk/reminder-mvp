/**
 * AWS Textract Service for Advanced PDF Extraction
 * Provides high-accuracy invoice data extraction using AWS Textract
 */

import { TextractClient, AnalyzeDocumentCommand, AnalyzeExpenseCommand } from '@aws-sdk/client-textract'

interface TextractField {
  key: string
  value: string | null
  confidence: number
  boundingBox?: {
    left: number
    top: number
    width: number
    height: number
  }
}

interface TextractTable {
  rows: string[][]
  confidence: number
  headers?: string[]
}

interface TextractResult {
  fields: TextractField[]
  tables: TextractTable[]
  rawText: string
  confidence: number
  processingTime: number
}

interface InvoiceExtractionResult {
  field: string
  value: string | null
  confidence: number
  source: 'textract-field' | 'textract-table' | 'textract-text'
  rawValue?: string
  tableContext?: string
}

class AWSTextractService {
  private client: TextractClient
  private isConfigured: boolean

  constructor() {
    // Check if AWS credentials are configured
    this.isConfigured = !!(
      process.env.AWS_ACCESS_KEY_ID &&
      process.env.AWS_SECRET_ACCESS_KEY &&
      process.env.AWS_REGION
    )

    if (this.isConfigured) {
      this.client = new TextractClient({
        region: process.env.AWS_REGION || 'me-south-1', // UAE region
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!
        }
      })
    } else {
      console.warn('⚠️  AWS Textract not configured. Add AWS credentials to .env')
    }
  }

  /**
   * Extract invoice data using AWS Textract
   */
  async extractInvoiceData(pdfBuffer: Buffer, filename: string): Promise<InvoiceExtractionResult[]> {
    if (!this.isConfigured) {
      throw new Error('AWS Textract not configured. Please add AWS credentials to environment variables.')
    }

    const startTime = Date.now()
    console.log(`🔍 Starting AWS Textract analysis for: ${filename}`)

    try {
      // Use AnalyzeExpense for invoice-specific extraction
      const expenseResult = await this.analyzeExpense(pdfBuffer)

      // Use AnalyzeDocument for additional table and form data
      const documentResult = await this.analyzeDocument(pdfBuffer)

      // Combine results for comprehensive extraction
      const combinedResults = this.combineResults(expenseResult, documentResult)

      const processingTime = Date.now() - startTime
      console.log(`✅ Textract analysis complete in ${processingTime}ms`)

      // Map Textract results to our invoice fields
      return this.mapToInvoiceFields(combinedResults)

    } catch (error) {
      console.error('❌ AWS Textract error:', error)
      throw new Error(`Textract analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Use AnalyzeExpense for invoice-specific data
   */
  private async analyzeExpense(pdfBuffer: Buffer): Promise<any> {
    const command = new AnalyzeExpenseCommand({
      Document: {
        Bytes: pdfBuffer
      }
    })

    const response = await this.client.send(command)
    return response
  }

  /**
   * Use AnalyzeDocument for tables and forms
   */
  private async analyzeDocument(pdfBuffer: Buffer): Promise<any> {
    const command = new AnalyzeDocumentCommand({
      Document: {
        Bytes: pdfBuffer
      },
      FeatureTypes: ['TABLES', 'FORMS'] // Extract tables and key-value pairs
    })

    const response = await this.client.send(command)
    return response
  }

  /**
   * Combine expense and document analysis results
   */
  private combineResults(expenseResult: any, documentResult: any): TextractResult {
    const fields: TextractField[] = []
    const tables: TextractTable[] = []
    let rawText = ''
    let totalConfidence = 0
    let fieldCount = 0

    // Process expense results (invoice-specific fields)
    if (expenseResult.ExpenseDocuments && expenseResult.ExpenseDocuments[0]) {
      const expenseDoc = expenseResult.ExpenseDocuments[0]

      // Extract summary fields (vendor, invoice number, total, etc.)
      if (expenseDoc.SummaryFields) {
        expenseDoc.SummaryFields.forEach((field: any) => {
          if (field.Type?.Text && field.ValueDetection?.Text) {
            const confidence = field.ValueDetection.Confidence || 0

            fields.push({
              key: field.Type.Text,
              value: field.ValueDetection.Text,
              confidence: confidence,
              boundingBox: this.extractBoundingBox(field.ValueDetection.Geometry)
            })

            totalConfidence += confidence
            fieldCount++
          }
        })
      }

      // Extract line items if present
      if (expenseDoc.LineItemGroups) {
        expenseDoc.LineItemGroups.forEach((group: any) => {
          if (group.LineItems) {
            const tableData: string[][] = []

            group.LineItems.forEach((item: any) => {
              const row: string[] = []

              if (item.LineItemExpenseFields) {
                item.LineItemExpenseFields.forEach((lineField: any) => {
                  if (lineField.ValueDetection?.Text) {
                    row.push(lineField.ValueDetection.Text)
                  }
                })
              }

              if (row.length > 0) {
                tableData.push(row)
              }
            })

            if (tableData.length > 0) {
              tables.push({
                rows: tableData,
                confidence: 85, // Line items generally have good confidence
                headers: ['Description', 'Amount', 'Quantity'] // Common invoice headers
              })
            }
          }
        })
      }
    }

    // Process document results (tables and forms)
    if (documentResult.Blocks) {
      // Extract plain text for context
      const textBlocks = documentResult.Blocks.filter((block: any) => block.BlockType === 'LINE')
      rawText = textBlocks.map((block: any) => block.Text).join('\n')

      // Extract form fields (key-value pairs)
      const keyValuePairs = this.extractKeyValuePairs(documentResult.Blocks)
      keyValuePairs.forEach(pair => {
        if (!fields.find(f => f.key.toLowerCase() === pair.key.toLowerCase())) {
          fields.push(pair)
          totalConfidence += pair.confidence
          fieldCount++
        }
      })

      // Extract tables
      const extractedTables = this.extractTables(documentResult.Blocks)
      tables.push(...extractedTables)
    }

    return {
      fields,
      tables,
      rawText,
      confidence: fieldCount > 0 ? totalConfidence / fieldCount : 0,
      processingTime: 0 // Will be set by caller
    }
  }

  /**
   * Extract key-value pairs from document blocks
   */
  private extractKeyValuePairs(blocks: any[]): TextractField[] {
    const fields: TextractField[] = []
    const keyBlocks = blocks.filter(block => block.BlockType === 'KEY_VALUE_SET' && block.EntityTypes?.includes('KEY'))
    const valueBlocks = blocks.filter(block => block.BlockType === 'KEY_VALUE_SET' && block.EntityTypes?.includes('VALUE'))

    keyBlocks.forEach(keyBlock => {
      if (keyBlock.Relationships) {
        const valueRelation = keyBlock.Relationships.find((rel: any) => rel.Type === 'VALUE')
        if (valueRelation && valueRelation.Ids) {
          const valueBlockId = valueRelation.Ids[0]
          const valueBlock = valueBlocks.find(vb => vb.Id === valueBlockId)

          if (valueBlock) {
            const keyText = this.extractTextFromBlock(keyBlock, blocks)
            const valueText = this.extractTextFromBlock(valueBlock, blocks)

            if (keyText && valueText) {
              fields.push({
                key: keyText,
                value: valueText,
                confidence: Math.min(keyBlock.Confidence || 0, valueBlock.Confidence || 0),
                boundingBox: this.extractBoundingBox(valueBlock.Geometry)
              })
            }
          }
        }
      }
    })

    return fields
  }

  /**
   * Extract tables from document blocks
   */
  private extractTables(blocks: any[]): TextractTable[] {
    const tables: TextractTable[] = []
    const tableBlocks = blocks.filter(block => block.BlockType === 'TABLE')

    tableBlocks.forEach(tableBlock => {
      const rows: string[][] = []
      let totalConfidence = 0
      let cellCount = 0

      if (tableBlock.Relationships) {
        const cellRelation = tableBlock.Relationships.find((rel: any) => rel.Type === 'CHILD')
        if (cellRelation && cellRelation.Ids) {
          const cells = cellRelation.Ids
            .map((id: string) => blocks.find(block => block.Id === id))
            .filter(block => block?.BlockType === 'CELL')

          // Group cells by row
          const rowMap: { [key: number]: any[] } = {}

          cells.forEach(cell => {
            if (cell.RowIndex !== undefined) {
              if (!rowMap[cell.RowIndex]) {
                rowMap[cell.RowIndex] = []
              }
              rowMap[cell.RowIndex][cell.ColumnIndex] = cell
              totalConfidence += cell.Confidence || 0
              cellCount++
            }
          })

          // Convert to string array
          Object.keys(rowMap).sort((a, b) => parseInt(a) - parseInt(b)).forEach(rowIndex => {
            const row: string[] = []
            const rowCells = rowMap[parseInt(rowIndex)]

            for (let i = 0; i < rowCells.length; i++) {
              const cell = rowCells[i]
              if (cell) {
                const cellText = this.extractTextFromBlock(cell, blocks)
                row.push(cellText || '')
              } else {
                row.push('')
              }
            }

            if (row.some(cell => cell.trim() !== '')) {
              rows.push(row)
            }
          })
        }
      }

      if (rows.length > 0) {
        tables.push({
          rows,
          confidence: cellCount > 0 ? totalConfidence / cellCount : 0,
          headers: rows.length > 0 ? rows[0] : undefined
        })
      }
    })

    return tables
  }

  /**
   * Extract text from a block using its relationships
   */
  private extractTextFromBlock(block: any, allBlocks: any[]): string {
    if (block.Text) {
      return block.Text
    }

    if (block.Relationships) {
      const childRelation = block.Relationships.find((rel: any) => rel.Type === 'CHILD')
      if (childRelation && childRelation.Ids) {
        const childTexts = childRelation.Ids
          .map((id: string) => allBlocks.find(b => b.Id === id))
          .filter(childBlock => childBlock?.Text)
          .map((childBlock: any) => childBlock.Text)

        return childTexts.join(' ')
      }
    }

    return ''
  }

  /**
   * Extract bounding box from geometry
   */
  private extractBoundingBox(geometry: any): any {
    if (geometry?.BoundingBox) {
      return {
        left: geometry.BoundingBox.Left,
        top: geometry.BoundingBox.Top,
        width: geometry.BoundingBox.Width,
        height: geometry.BoundingBox.Height
      }
    }
    return undefined
  }

  /**
   * Map Textract results to our invoice field format
   */
  private mapToInvoiceFields(textractResult: TextractResult): InvoiceExtractionResult[] {
    const results: InvoiceExtractionResult[] = []

    // Field mapping for common invoice fields
    const fieldMappings = {
      customerName: ['VENDOR_NAME', 'vendor name', 'vendor', 'from', 'bill from', 'sender'],
      email: ['email', 'email address', 'e-mail'],
      phone: ['phone', 'telephone', 'tel', 'phone number'],
      trn: ['trn', 'tax registration', 'tax number', 'vat number'],
      invoiceNumber: ['INVOICE_RECEIPT_ID', 'invoice number', 'invoice no', 'invoice #', 'number'],
      amount: ['TOTAL', 'total amount', 'amount', 'subtotal', 'net amount'],
      vatAmount: ['vat', 'tax', 'tax amount', 'vat amount'],
      totalAmount: ['TOTAL', 'total', 'grand total', 'final amount'],
      dueDate: ['due date', 'payment due', 'due', 'pay by'],
      invoiceDate: ['INVOICE_RECEIPT_DATE', 'invoice date', 'date', 'issue date'],
      currency: ['currency', 'cur'],
      paymentTerms: ['payment terms', 'terms', 'net', 'due in']
    }

    // Map fields from Textract
    Object.entries(fieldMappings).forEach(([targetField, possibleKeys]) => {
      let bestMatch: TextractField | null = null

      // Look for exact matches in Textract fields
      for (const key of possibleKeys) {
        const field = textractResult.fields.find(f =>
          f.key.toLowerCase().includes(key.toLowerCase()) ||
          key.toLowerCase() === f.key.toLowerCase()
        )

        if (field && (!bestMatch || field.confidence > bestMatch.confidence)) {
          bestMatch = field
        }
      }

      if (bestMatch) {
        results.push({
          field: targetField,
          value: bestMatch.value,
          confidence: bestMatch.confidence,
          source: 'textract-field',
          rawValue: bestMatch.value || undefined
        })
      } else {
        // Look in tables for missing fields
        const tableValue = this.findInTables(targetField, textractResult.tables)
        if (tableValue) {
          results.push({
            field: targetField,
            value: tableValue.value,
            confidence: tableValue.confidence,
            source: 'textract-table',
            tableContext: tableValue.context
          })
        } else {
          // Look in raw text as fallback
          const textValue = this.findInRawText(targetField, textractResult.rawText)
          if (textValue) {
            results.push({
              field: targetField,
              value: textValue.value,
              confidence: textValue.confidence,
              source: 'textract-text',
              rawValue: textValue.rawMatch
            })
          }
        }
      }
    })

    // Add fields that weren't mapped
    const mappedFields = results.map(r => r.field)
    Object.keys(fieldMappings).forEach(field => {
      if (!mappedFields.includes(field)) {
        results.push({
          field,
          value: null,
          confidence: 0,
          source: 'textract-field'
        })
      }
    })

    console.log(`📊 Textract mapped ${results.filter(r => r.value).length}/${results.length} fields`)

    return results
  }

  /**
   * Find field values in tables
   */
  private findInTables(field: string, tables: TextractTable[]): { value: string; confidence: number; context: string } | null {
    // Implementation for finding values in tables
    // This would look for patterns like "Outstanding: 5368.60" in table cells

    for (const table of tables) {
      for (let rowIndex = 0; rowIndex < table.rows.length; rowIndex++) {
        const row = table.rows[rowIndex]

        for (let colIndex = 0; colIndex < row.length; colIndex++) {
          const cell = row[colIndex].toLowerCase()

          // Look for field indicators
          if (field === 'outstandingAmount' && cell.includes('outstanding')) {
            const nextCell = row[colIndex + 1] || ''
            const amount = this.extractAmount(nextCell)
            if (amount) {
              return {
                value: amount,
                confidence: table.confidence,
                context: `Found in table: ${cell} -> ${nextCell}`
              }
            }
          }

          if (field === 'paidAmount' && (cell.includes('paid') || cell.includes('payment'))) {
            const nextCell = row[colIndex + 1] || ''
            const amount = this.extractAmount(nextCell)
            if (amount) {
              return {
                value: amount,
                confidence: table.confidence,
                context: `Found in table: ${cell} -> ${nextCell}`
              }
            }
          }
        }
      }
    }

    return null
  }

  /**
   * Find field values in raw text
   */
  private findInRawText(field: string, rawText: string): { value: string; confidence: number; rawMatch: string } | null {
    // Implementation for finding values in raw text
    const patterns: { [key: string]: RegExp[] } = {
      outstandingAmount: [
        /outstanding[:\s]*([0-9,]+\.?[0-9]*)/gi,
        /balance[:\s]*([0-9,]+\.?[0-9]*)/gi,
        /due[:\s]*([0-9,]+\.?[0-9]*)/gi
      ],
      paidAmount: [
        /paid[:\s]*([0-9,]+\.?[0-9]*)/gi,
        /payment[:\s]*([0-9,]+\.?[0-9]*)/gi
      ],
      paymentTerms: [
        /(within\s+\d+\s+days?)/gi,
        /(net\s+\d+)/gi,
        /(due\s+in\s+\d+)/gi
      ]
    }

    if (patterns[field]) {
      for (const pattern of patterns[field]) {
        const match = rawText.match(pattern)
        if (match) {
          return {
            value: match[1] || match[0],
            confidence: 75, // Medium confidence for text extraction
            rawMatch: match[0]
          }
        }
      }
    }

    return null
  }

  /**
   * Extract amount from text
   */
  private extractAmount(text: string): string | null {
    const amountPattern = /([0-9,]+\.?[0-9]*)/
    const match = text.match(amountPattern)
    return match ? match[1] : null
  }

  /**
   * Check if AWS Textract is available
   */
  isAvailable(): boolean {
    return this.isConfigured
  }

  /**
   * Get configuration status
   */
  getStatus(): { configured: boolean; region?: string; message: string } {
    if (this.isConfigured) {
      return {
        configured: true,
        region: process.env.AWS_REGION || 'me-south-1',
        message: 'AWS Textract is configured and ready'
      }
    } else {
      return {
        configured: false,
        message: 'AWS Textract requires AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, and AWS_REGION in environment variables'
      }
    }
  }
}

export const awsTextractService = new AWSTextractService()
export type { InvoiceExtractionResult, TextractResult }