# 10-Week Implementation Plan - December Beta Launch

**Target Launch**: December 13-19, 2025
**First Customer**: POP Trading Company
**Philosophy**: Discovery-driven, value-first, realistic timelines
**Status**: Ready for dev team execution

---

## Executive Summary

This plan takes a **pragmatic approach** to beta launch by focusing on:
- ✅ **Core value proposition first**: Invoice → Campaign → Send working reliably
- ✅ **Discovery before commitment**: Week 1 validates APIs before full integration
- ✅ **Customer validation**: UAT determines what features are actually needed
- ✅ **Sustainable pace**: Includes holiday monitoring and post-launch iteration

**Key Insight**: POP Trading needs invoice reminders to work, not every feature perfect. This plan delivers that.

---

## Week 1 (Nov 1-7): Discovery + Critical Integration

### Theme: "Validate Before Scale"

**Goal**: Confirm backend APIs work as documented, wire up invoice management UI

### Day 1-2 (Nov 1-2): API Smoke Testing

**Why This Matters**: Better to discover broken APIs on Day 1 than during UAT Week 5

**Tasks**:
```typescript
// Create: scripts/week1-api-smoke-tests.ts

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function testInvoiceAPIs() {
  console.log('🧪 Testing Invoice APIs...\n')

  // 1. Create Invoice
  console.log('1️⃣ POST /api/invoices - Create invoice')
  const createResponse = await fetch('http://localhost:3000/api/invoices', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': getAuthCookie() // Helper to get authenticated session
    },
    body: JSON.stringify({
      invoice_number: 'TEST-001',
      customer_id: testCustomerId,
      amount: 1000.00,
      currency: 'AED',
      due_date: '2025-12-31',
      items: [
        { description: 'Test Item', quantity: 1, unit_price: 1000.00 }
      ]
    })
  })

  const invoice = await createResponse.json()
  console.log(createResponse.ok ? '✅ PASS' : '❌ FAIL', invoice)

  // 2. List Invoices
  console.log('\n2️⃣ GET /api/invoices - List invoices')
  const listResponse = await fetch('http://localhost:3000/api/invoices', {
    headers: { 'Cookie': getAuthCookie() }
  })

  const invoices = await listResponse.json()
  console.log(listResponse.ok ? '✅ PASS' : '❌ FAIL', `Found ${invoices.length} invoices`)

  // 3. Get Single Invoice
  console.log('\n3️⃣ GET /api/invoices/[id] - Get invoice details')
  const getResponse = await fetch(`http://localhost:3000/api/invoices/${invoice.id}`, {
    headers: { 'Cookie': getAuthCookie() }
  })

  const invoiceDetail = await getResponse.json()
  console.log(getResponse.ok ? '✅ PASS' : '❌ FAIL', invoiceDetail)

  // 4. CSV Import
  console.log('\n4️⃣ POST /api/invoices/import - CSV import')
  const csvData = `invoice_number,customer_email,amount,due_date
TEST-002,customer@example.com,500.00,2025-12-31`

  const importResponse = await fetch('http://localhost:3000/api/invoices/import', {
    method: 'POST',
    headers: {
      'Content-Type': 'text/csv',
      'Cookie': getAuthCookie()
    },
    body: csvData
  })

  const importResult = await importResponse.json()
  console.log(importResponse.ok ? '✅ PASS' : '❌ FAIL', importResult)
}

async function testCampaignAPIs() {
  console.log('\n\n🧪 Testing Campaign APIs...\n')

  // 1. Create Campaign
  console.log('1️⃣ POST /api/campaigns - Create campaign')
  const createResponse = await fetch('http://localhost:3000/api/campaigns', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': getAuthCookie()
    },
    body: JSON.stringify({
      name: 'Test Campaign',
      invoice_ids: [testInvoiceId],
      subject: 'Payment Reminder',
      message: 'Please pay invoice {invoice_number}',
      attach_invoice_pdf: false
    })
  })

  const campaign = await createResponse.json()
  console.log(createResponse.ok ? '✅ PASS' : '❌ FAIL', campaign)

  // 2. Send Campaign
  console.log('\n2️⃣ POST /api/campaigns/[id]/send - Send campaign')
  const sendResponse = await fetch(`http://localhost:3000/api/campaigns/${campaign.id}/send`, {
    method: 'POST',
    headers: { 'Cookie': getAuthCookie() }
  })

  const sendResult = await sendResponse.json()
  console.log(sendResponse.ok ? '✅ PASS' : '❌ FAIL', sendResult)

  // 3. Get Campaign Status
  console.log('\n3️⃣ GET /api/campaigns/[id] - Get campaign status')
  const statusResponse = await fetch(`http://localhost:3000/api/campaigns/${campaign.id}`, {
    headers: { 'Cookie': getAuthCookie() }
  })

  const status = await statusResponse.json()
  console.log(statusResponse.ok ? '✅ PASS' : '❌ FAIL', status)
}

async function testPaymentAPIs() {
  console.log('\n\n🧪 Testing Payment APIs...\n')

  // 1. Record Payment
  console.log('1️⃣ POST /api/payments - Record payment')
  const createResponse = await fetch('http://localhost:3000/api/payments', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': getAuthCookie()
    },
    body: JSON.stringify({
      invoice_id: testInvoiceId,
      amount: 1000.00,
      payment_method: 'bank_transfer',
      payment_date: '2025-11-01',
      reference: 'TEST-PAY-001'
    })
  })

  const payment = await createResponse.json()
  console.log(createResponse.ok ? '✅ PASS' : '❌ FAIL', payment)

  // 2. List Payments
  console.log('\n2️⃣ GET /api/payments - List payments')
  const listResponse = await fetch('http://localhost:3000/api/payments', {
    headers: { 'Cookie': getAuthCookie() }
  })

  const payments = await listResponse.json()
  console.log(listResponse.ok ? '✅ PASS' : '❌ FAIL', `Found ${payments.length} payments`)
}

async function testCustomerAPIs() {
  console.log('\n\n🧪 Testing Customer APIs...\n')

  // 1. Create Customer
  console.log('1️⃣ POST /api/customers - Create customer')
  const createResponse = await fetch('http://localhost:3000/api/customers', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': getAuthCookie()
    },
    body: JSON.stringify({
      name: 'Test Customer',
      email: 'customer@example.com',
      payment_terms_days: 30
    })
  })

  const customer = await createResponse.json()
  console.log(createResponse.ok ? '✅ PASS' : '❌ FAIL', customer)

  // 2. List Customers
  console.log('\n2️⃣ GET /api/customers - List customers')
  const listResponse = await fetch('http://localhost:3000/api/customers', {
    headers: { 'Cookie': getAuthCookie() }
  })

  const customers = await listResponse.json()
  console.log(listResponse.ok ? '✅ PASS' : '❌ FAIL', `Found ${customers.length} customers`)

  // 3. Update Customer
  console.log('\n3️⃣ PUT /api/customers/[id] - Update customer')
  const updateResponse = await fetch(`http://localhost:3000/api/customers/${customer.id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': getAuthCookie()
    },
    body: JSON.stringify({
      payment_terms_days: 45
    })
  })

  const updated = await updateResponse.json()
  console.log(updateResponse.ok ? '✅ PASS' : '❌ FAIL', updated)
}

async function testAnalyticsAPIs() {
  console.log('\n\n🧪 Testing Analytics APIs...\n')

  // 1. Get Dashboard Stats
  console.log('1️⃣ GET /api/analytics/dashboard - Dashboard stats')
  const statsResponse = await fetch('http://localhost:3000/api/analytics/dashboard', {
    headers: { 'Cookie': getAuthCookie() }
  })

  const stats = await statsResponse.json()
  console.log(statsResponse.ok ? '✅ PASS' : '❌ FAIL', stats)

  // 2. Get Collection Rate
  console.log('\n2️⃣ GET /api/analytics/collection-rate - Collection rate')
  const rateResponse = await fetch('http://localhost:3000/api/analytics/collection-rate', {
    headers: { 'Cookie': getAuthCookie() }
  })

  const rate = await rateResponse.json()
  console.log(rateResponse.ok ? '✅ PASS' : '❌ FAIL', rate)
}

// Main execution
async function runAllTests() {
  console.log('═══════════════════════════════════════════════')
  console.log('   REMINDER MVP - API SMOKE TESTS')
  console.log('   Week 1 Discovery Sprint')
  console.log('═══════════════════════════════════════════════\n')

  try {
    await testInvoiceAPIs()
    await testCampaignAPIs()
    await testPaymentAPIs()
    await testCustomerAPIs()
    await testAnalyticsAPIs()

    console.log('\n\n═══════════════════════════════════════════════')
    console.log('   TEST SUMMARY')
    console.log('═══════════════════════════════════════════════')
    console.log('Review results above and create GitHub issues for any ❌ FAIL')
    console.log('Next step: Wire up frontend once APIs validated')

  } catch (error) {
    console.error('\n❌ CRITICAL ERROR:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

runAllTests()
```

**Deliverable Day 2 End**:
- ✅ Written test script covering 5 API domains (invoices, campaigns, payments, customers, analytics)
- ✅ Executed test script and documented results
- ✅ Created GitHub issues for any failing endpoints
- ✅ Go/No-Go decision: "Are we ready for frontend integration?"

**Success Criteria**: At least 80% of tested endpoints return 200 OK with valid data

---

### Day 3-5 (Nov 3-5): Invoice UI Integration

**Why This Matters**: Invoice management is the foundation - everything else depends on this working

**Day 3 Tasks**: Invoice List Page
```typescript
// File: src/app/[locale]/dashboard/invoices/page.tsx

'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { DataTable } from '@/components/ui/data-table'
import { toast } from 'sonner'

interface Invoice {
  id: string
  invoice_number: string
  customer_name: string
  amount: number
  currency: string
  status: 'draft' | 'sent' | 'paid' | 'overdue'
  due_date: string
  created_at: string
}

export default function InvoicesPage() {
  const router = useRouter()
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchInvoices()
  }, [])

  async function fetchInvoices() {
    try {
      setLoading(true)
      const response = await fetch('/api/invoices')

      if (!response.ok) {
        throw new Error('Failed to fetch invoices')
      }

      const data = await response.json()
      setInvoices(data)
    } catch (error) {
      console.error('Error fetching invoices:', error)
      toast.error('Failed to load invoices')
    } finally {
      setLoading(false)
    }
  }

  const columns = [
    {
      accessorKey: 'invoice_number',
      header: 'Invoice #',
    },
    {
      accessorKey: 'customer_name',
      header: 'Customer',
    },
    {
      accessorKey: 'amount',
      header: 'Amount',
      cell: ({ row }) => {
        const amount = parseFloat(row.getValue('amount'))
        const currency = row.original.currency
        return new Intl.NumberFormat('en-AE', {
          style: 'currency',
          currency: currency || 'AED'
        }).format(amount)
      }
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => {
        const status = row.getValue('status') as string
        return (
          <span className={`px-2 py-1 rounded-full text-xs ${
            status === 'paid' ? 'bg-green-100 text-green-800' :
            status === 'overdue' ? 'bg-red-100 text-red-800' :
            status === 'sent' ? 'bg-blue-100 text-blue-800' :
            'bg-gray-100 text-gray-800'
          }`}>
            {status.toUpperCase()}
          </span>
        )
      }
    },
    {
      accessorKey: 'due_date',
      header: 'Due Date',
      cell: ({ row }) => {
        return new Date(row.getValue('due_date')).toLocaleDateString('en-AE')
      }
    },
    {
      id: 'actions',
      cell: ({ row }) => {
        return (
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push(`/dashboard/invoices/${row.original.id}`)}
          >
            View
          </Button>
        )
      }
    }
  ]

  if (loading) {
    return <div className="p-8">Loading invoices...</div>
  }

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Invoices</h1>
        <div className="space-x-2">
          <Button onClick={() => router.push('/dashboard/invoices/new')}>
            Create Invoice
          </Button>
          <Button
            variant="outline"
            onClick={() => router.push('/dashboard/invoices/import')}
          >
            Import CSV
          </Button>
        </div>
      </div>

      <DataTable columns={columns} data={invoices} />
    </div>
  )
}
```

**Day 4 Tasks**: Invoice Creation Form
```typescript
// File: src/app/[locale]/dashboard/invoices/new/page.tsx

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'

export default function NewInvoicePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    invoice_number: '',
    customer_email: '',
    customer_name: '',
    amount: '',
    currency: 'AED',
    due_date: '',
    description: ''
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    try {
      const response = await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoice_number: formData.invoice_number,
          customer_email: formData.customer_email,
          customer_name: formData.customer_name,
          amount: parseFloat(formData.amount),
          currency: formData.currency,
          due_date: formData.due_date,
          items: [
            {
              description: formData.description,
              quantity: 1,
              unit_price: parseFloat(formData.amount)
            }
          ]
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to create invoice')
      }

      const invoice = await response.json()
      toast.success('Invoice created successfully')
      router.push(`/dashboard/invoices/${invoice.id}`)

    } catch (error) {
      console.error('Error creating invoice:', error)
      toast.error(error.message || 'Failed to create invoice')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-3xl font-bold mb-6">Create Invoice</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <Label htmlFor="invoice_number">Invoice Number *</Label>
          <Input
            id="invoice_number"
            required
            value={formData.invoice_number}
            onChange={(e) => setFormData(prev => ({ ...prev, invoice_number: e.target.value }))}
          />
        </div>

        <div>
          <Label htmlFor="customer_name">Customer Name *</Label>
          <Input
            id="customer_name"
            required
            value={formData.customer_name}
            onChange={(e) => setFormData(prev => ({ ...prev, customer_name: e.target.value }))}
          />
        </div>

        <div>
          <Label htmlFor="customer_email">Customer Email *</Label>
          <Input
            id="customer_email"
            type="email"
            required
            value={formData.customer_email}
            onChange={(e) => setFormData(prev => ({ ...prev, customer_email: e.target.value }))}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="amount">Amount *</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              required
              value={formData.amount}
              onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
            />
          </div>

          <div>
            <Label htmlFor="currency">Currency</Label>
            <select
              id="currency"
              className="w-full border rounded-md p-2"
              value={formData.currency}
              onChange={(e) => setFormData(prev => ({ ...prev, currency: e.target.value }))}
            >
              <option value="AED">AED</option>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
            </select>
          </div>
        </div>

        <div>
          <Label htmlFor="due_date">Due Date *</Label>
          <Input
            id="due_date"
            type="date"
            required
            value={formData.due_date}
            onChange={(e) => setFormData(prev => ({ ...prev, due_date: e.target.value }))}
          />
        </div>

        <div>
          <Label htmlFor="description">Description</Label>
          <Input
            id="description"
            value={formData.description}
            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
          />
        </div>

        <div className="flex space-x-4">
          <Button type="submit" disabled={loading}>
            {loading ? 'Creating...' : 'Create Invoice'}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
          >
            Cancel
          </Button>
        </div>
      </form>
    </div>
  )
}
```

**Day 5 Tasks**: CSV Import Integration
```typescript
// File: src/app/[locale]/dashboard/invoices/import/page.tsx

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

export default function ImportInvoicesPage() {
  const router = useRouter()
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [preview, setPreview] = useState<any[]>([])

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return

    setFile(selectedFile)

    // Read first 5 rows for preview
    const text = await selectedFile.text()
    const lines = text.split('\n').slice(0, 6) // Header + 5 rows
    setPreview(lines.map(line => line.split(',')))
  }

  async function handleImport() {
    if (!file) {
      toast.error('Please select a CSV file')
      return
    }

    setLoading(true)

    try {
      const text = await file.text()

      const response = await fetch('/api/invoices/import', {
        method: 'POST',
        headers: { 'Content-Type': 'text/csv' },
        body: text
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Import failed')
      }

      const result = await response.json()
      toast.success(`Successfully imported ${result.imported} invoices`)
      router.push('/dashboard/invoices')

    } catch (error) {
      console.error('Import error:', error)
      toast.error(error.message || 'Failed to import invoices')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-8 max-w-4xl">
      <h1 className="text-3xl font-bold mb-6">Import Invoices from CSV</h1>

      <div className="space-y-6">
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
          <input
            type="file"
            accept=".csv"
            onChange={handleFileSelect}
            className="hidden"
            id="csv-upload"
          />
          <label htmlFor="csv-upload" className="cursor-pointer">
            <div className="space-y-2">
              <p className="text-lg font-medium">
                {file ? file.name : 'Choose CSV file'}
              </p>
              <p className="text-sm text-gray-500">
                Click to select or drag and drop
              </p>
            </div>
          </label>
        </div>

        {preview.length > 0 && (
          <div className="border rounded-lg p-4">
            <h3 className="font-medium mb-2">Preview (first 5 rows)</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-gray-50">
                    {preview[0]?.map((header, i) => (
                      <th key={i} className="px-4 py-2 text-left">{header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.slice(1).map((row, i) => (
                    <tr key={i} className="border-t">
                      {row.map((cell, j) => (
                        <td key={j} className="px-4 py-2">{cell}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="flex space-x-4">
          <Button
            onClick={handleImport}
            disabled={!file || loading}
          >
            {loading ? 'Importing...' : 'Import Invoices'}
          </Button>
          <Button
            variant="outline"
            onClick={() => router.back()}
          >
            Cancel
          </Button>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="font-medium mb-2">CSV Format Requirements:</h4>
          <ul className="text-sm space-y-1 list-disc list-inside">
            <li>Required columns: invoice_number, customer_email, amount, due_date</li>
            <li>Optional columns: customer_name, currency, description</li>
            <li>Date format: YYYY-MM-DD</li>
            <li>Amount: numeric value (e.g., 1000.00)</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
```

**Deliverable Week 1 End**:
- ✅ Invoice list page shows all invoices from API
- ✅ Create invoice form saves to database via API
- ✅ CSV import successfully processes bulk invoices
- ✅ Manual testing: Create 10 test invoices via UI
- ✅ Success metric: "Can create invoices via UI" = TRUE

---

## Week 2 (Nov 8-14): Complete Core Integration

### Theme: "Close the Loop - Invoice to Payment"

**Goal**: Complete the core workflow: Invoice → Campaign → Send → Payment

### Day 1-2 (Nov 8-9): Campaign Creation + Sending

```typescript
// File: src/app/[locale]/dashboard/campaigns/create/page.tsx

'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { toast } from 'sonner'

export default function CreateCampaignPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [invoices, setInvoices] = useState([])
  const [selectedInvoices, setSelectedInvoices] = useState<string[]>([])
  const [formData, setFormData] = useState({
    name: '',
    subject: 'Payment Reminder - Invoice {invoice_number}',
    message: `Dear {customer_name},

This is a friendly reminder that invoice {invoice_number} for {amount} {currency} is due on {due_date}.

Please arrange payment at your earliest convenience.

Best regards,
{company_name}`,
    attach_invoice_pdf: true
  })

  useEffect(() => {
    fetchUnpaidInvoices()
  }, [])

  async function fetchUnpaidInvoices() {
    try {
      const response = await fetch('/api/invoices?status=sent,overdue')
      const data = await response.json()
      setInvoices(data)
    } catch (error) {
      toast.error('Failed to load invoices')
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (selectedInvoices.length === 0) {
      toast.error('Please select at least one invoice')
      return
    }

    setLoading(true)

    try {
      // Create campaign
      const response = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          invoice_ids: selectedInvoices,
          subject: formData.subject,
          message: formData.message,
          attach_invoice_pdf: formData.attach_invoice_pdf
        })
      })

      if (!response.ok) {
        throw new Error('Failed to create campaign')
      }

      const campaign = await response.json()

      // Send campaign
      const sendResponse = await fetch(`/api/campaigns/${campaign.id}/send`, {
        method: 'POST'
      })

      if (!sendResponse.ok) {
        throw new Error('Failed to send campaign')
      }

      const result = await sendResponse.json()
      toast.success(`Campaign sent! ${result.sent} emails delivered`)
      router.push('/dashboard/campaigns')

    } catch (error) {
      console.error('Campaign error:', error)
      toast.error(error.message || 'Failed to send campaign')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-8 max-w-4xl">
      <h1 className="text-3xl font-bold mb-6">Create Campaign</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <Label htmlFor="name">Campaign Name *</Label>
          <Input
            id="name"
            required
            value={formData.name}
            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            placeholder="e.g., November Overdue Reminders"
          />
        </div>

        <div>
          <Label>Select Invoices *</Label>
          <div className="border rounded-lg p-4 max-h-64 overflow-y-auto space-y-2">
            {invoices.map((invoice: any) => (
              <label key={invoice.id} className="flex items-center space-x-2 p-2 hover:bg-gray-50 rounded">
                <Checkbox
                  checked={selectedInvoices.includes(invoice.id)}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      setSelectedInvoices([...selectedInvoices, invoice.id])
                    } else {
                      setSelectedInvoices(selectedInvoices.filter(id => id !== invoice.id))
                    }
                  }}
                />
                <span className="flex-1">
                  {invoice.invoice_number} - {invoice.customer_name} - {invoice.amount} {invoice.currency}
                </span>
                <span className={`px-2 py-1 rounded text-xs ${
                  invoice.status === 'overdue' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'
                }`}>
                  {invoice.status}
                </span>
              </label>
            ))}
          </div>
          <p className="text-sm text-gray-500 mt-2">
            {selectedInvoices.length} invoice(s) selected
          </p>
        </div>

        <div>
          <Label htmlFor="subject">Email Subject *</Label>
          <Input
            id="subject"
            required
            value={formData.subject}
            onChange={(e) => setFormData(prev => ({ ...prev, subject: e.target.value }))}
          />
          <p className="text-xs text-gray-500 mt-1">
            Available merge tags: {'{invoice_number}'}, {'{customer_name}'}, {'{amount}'}, {'{currency}'}, {'{due_date}'}
          </p>
        </div>

        <div>
          <Label htmlFor="message">Email Message *</Label>
          <textarea
            id="message"
            required
            rows={10}
            className="w-full border rounded-md p-2"
            value={formData.message}
            onChange={(e) => setFormData(prev => ({ ...prev, message: e.target.value }))}
          />
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="attach_pdf"
            checked={formData.attach_invoice_pdf}
            onCheckedChange={(checked) =>
              setFormData(prev => ({ ...prev, attach_invoice_pdf: checked === true }))
            }
          />
          <Label htmlFor="attach_pdf" className="cursor-pointer">
            Attach invoice PDF (if available)
          </Label>
        </div>

        <div className="flex space-x-4">
          <Button type="submit" disabled={loading || selectedInvoices.length === 0}>
            {loading ? 'Sending...' : 'Create & Send Campaign'}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
          >
            Cancel
          </Button>
        </div>
      </form>
    </div>
  )
}
```

### Day 3 (Nov 10): Payment Recording

```typescript
// File: src/app/[locale]/dashboard/invoices/[id]/page.tsx (add payment recording)

async function handleRecordPayment(invoiceId: string) {
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [paymentData, setPaymentData] = useState({
    amount: '',
    payment_method: 'bank_transfer',
    payment_date: new Date().toISOString().split('T')[0],
    reference: ''
  })

  async function submitPayment() {
    try {
      const response = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoice_id: invoiceId,
          amount: parseFloat(paymentData.amount),
          payment_method: paymentData.payment_method,
          payment_date: paymentData.payment_date,
          reference: paymentData.reference
        })
      })

      if (!response.ok) throw new Error('Payment recording failed')

      toast.success('Payment recorded successfully')
      setShowPaymentModal(false)
      // Refresh invoice data
      fetchInvoice()
    } catch (error) {
      toast.error('Failed to record payment')
    }
  }

  // Payment Modal Component (add to invoice detail page)
  return (
    <Dialog open={showPaymentModal} onOpenChange={setShowPaymentModal}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record Payment</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Amount *</Label>
            <Input
              type="number"
              step="0.01"
              value={paymentData.amount}
              onChange={(e) => setPaymentData(prev => ({ ...prev, amount: e.target.value }))}
            />
          </div>

          <div>
            <Label>Payment Method</Label>
            <select
              className="w-full border rounded-md p-2"
              value={paymentData.payment_method}
              onChange={(e) => setPaymentData(prev => ({ ...prev, payment_method: e.target.value }))}
            >
              <option value="bank_transfer">Bank Transfer</option>
              <option value="credit_card">Credit Card</option>
              <option value="cash">Cash</option>
              <option value="cheque">Cheque</option>
            </select>
          </div>

          <div>
            <Label>Payment Date</Label>
            <Input
              type="date"
              value={paymentData.payment_date}
              onChange={(e) => setPaymentData(prev => ({ ...prev, payment_date: e.target.value }))}
            />
          </div>

          <div>
            <Label>Reference</Label>
            <Input
              value={paymentData.reference}
              onChange={(e) => setPaymentData(prev => ({ ...prev, reference: e.target.value }))}
              placeholder="Transaction ID, cheque number, etc."
            />
          </div>

          <div className="flex space-x-2">
            <Button onClick={submitPayment}>Record Payment</Button>
            <Button variant="outline" onClick={() => setShowPaymentModal(false)}>
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
```

### Day 4 (Nov 11): Customer Management

```typescript
// File: src/app/[locale]/dashboard/customers/page.tsx

'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { DataTable } from '@/components/ui/data-table'
import { toast } from 'sonner'

export default function CustomersPage() {
  const router = useRouter()
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchCustomers()
  }, [])

  async function fetchCustomers() {
    try {
      const response = await fetch('/api/customers')
      const data = await response.json()
      setCustomers(data)
    } catch (error) {
      toast.error('Failed to load customers')
    } finally {
      setLoading(false)
    }
  }

  const columns = [
    { accessorKey: 'name', header: 'Name' },
    { accessorKey: 'email', header: 'Email' },
    {
      accessorKey: 'payment_terms_days',
      header: 'Payment Terms',
      cell: ({ row }) => `${row.getValue('payment_terms_days')} days`
    },
    {
      id: 'invoices',
      header: 'Total Invoices',
      cell: ({ row }) => row.original._count?.invoices || 0
    },
    {
      id: 'outstanding',
      header: 'Outstanding Amount',
      cell: ({ row }) => {
        const amount = row.original.outstanding_amount || 0
        return new Intl.NumberFormat('en-AE', {
          style: 'currency',
          currency: 'AED'
        }).format(amount)
      }
    },
    {
      id: 'actions',
      cell: ({ row }) => (
        <Button
          variant="outline"
          size="sm"
          onClick={() => router.push(`/dashboard/customers/${row.original.id}`)}
        >
          View
        </Button>
      )
    }
  ]

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Customers</h1>
        <Button onClick={() => router.push('/dashboard/customers/new')}>
          Add Customer
        </Button>
      </div>

      {loading ? (
        <div>Loading customers...</div>
      ) : (
        <DataTable columns={columns} data={customers} />
      )}
    </div>
  )
}
```

### Day 5 (Nov 12): Analytics Dashboard Wiring

```typescript
// File: src/app/[locale]/dashboard/analytics/page.tsx

'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'

interface DashboardStats {
  total_invoices: number
  total_outstanding: number
  overdue_count: number
  collection_rate: number
  avg_days_to_pay: number
}

export default function AnalyticsPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchStats()
  }, [])

  async function fetchStats() {
    try {
      const response = await fetch('/api/analytics/dashboard')
      if (!response.ok) throw new Error('Failed to fetch stats')

      const data = await response.json()
      setStats(data)
    } catch (error) {
      console.error('Error fetching stats:', error)
      toast.error('Failed to load analytics')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="p-8">Loading analytics...</div>
  }

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-6">Analytics</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Total Invoices</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats?.total_invoices || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Outstanding Amount</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {new Intl.NumberFormat('en-AE', {
                style: 'currency',
                currency: 'AED'
              }).format(stats?.total_outstanding || 0)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Overdue Invoices</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">
              {stats?.overdue_count || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Collection Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">
              {stats?.collection_rate?.toFixed(1) || 0}%
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-full">
          <CardHeader>
            <CardTitle className="text-sm font-medium">Average Days to Payment</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {stats?.avg_days_to_pay?.toFixed(0) || 0} days
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
```

**Deliverable Week 2 End**:
- ✅ Campaign creation + sending works via UI
- ✅ Payment recording updates invoice status
- ✅ Customer management CRUD operational
- ✅ Analytics dashboard displays real-time stats
- ✅ Success metric: "Can send reminders via UI" = TRUE

**Manual Test Checklist**:
```
□ Create invoice via UI
□ Send reminder campaign for that invoice
□ Verify customer receives email (check AWS SES console)
□ Record payment for invoice
□ Verify invoice status changes to "paid"
□ Check analytics dashboard shows updated stats
```

---

## Week 3 (Nov 15-21): Testing + Settings

### Theme: "Stability & Polish"

**Goal**: Comprehensive E2E testing, Settings UI, Monitoring setup

### Day 1-2 (Nov 15-16): E2E Test Suite

```typescript
// File: tests/e2e/invoice-to-campaign-flow.spec.ts

import { test, expect } from '@playwright/test'

test.describe('Invoice → Campaign → Payment Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Login
    await page.goto('/auth/signin')
    await page.fill('[name="email"]', 'test@example.com')
    await page.fill('[name="password"]', 'password123')
    await page.click('button[type="submit"]')
    await expect(page).toHaveURL('/dashboard')
  })

  test('Complete invoice lifecycle', async ({ page }) => {
    // 1. Create Invoice
    await page.goto('/dashboard/invoices/new')
    await page.fill('[name="invoice_number"]', 'E2E-TEST-001')
    await page.fill('[name="customer_name"]', 'Test Customer')
    await page.fill('[name="customer_email"]', 'customer@test.com')
    await page.fill('[name="amount"]', '1000.00')
    await page.fill('[name="due_date"]', '2025-12-31')
    await page.fill('[name="description"]', 'E2E Test Invoice')

    await page.click('button[type="submit"]')

    // Wait for redirect to invoice detail
    await expect(page).toHaveURL(/\/dashboard\/invoices\/[a-z0-9-]+/)
    await expect(page.locator('text=E2E-TEST-001')).toBeVisible()

    // 2. Navigate to campaigns and create campaign
    await page.goto('/dashboard/campaigns/create')
    await page.fill('[name="name"]', 'E2E Test Campaign')

    // Select the invoice we just created
    await page.click('text=E2E-TEST-001')

    // Submit campaign
    await page.click('button:has-text("Create & Send Campaign")')

    // Verify success message
    await expect(page.locator('text=/Campaign sent/')).toBeVisible()

    // 3. Go back to invoice and record payment
    await page.goto('/dashboard/invoices')
    await page.click('text=E2E-TEST-001')

    await page.click('button:has-text("Record Payment")')
    await page.fill('[name="amount"]', '1000.00')
    await page.selectOption('[name="payment_method"]', 'bank_transfer')
    await page.fill('[name="reference"]', 'E2E-TEST-PAYMENT')
    await page.click('button:has-text("Record Payment")')

    // Verify invoice status changed to paid
    await expect(page.locator('text=/PAID/i')).toBeVisible()

    // 4. Verify analytics updated
    await page.goto('/dashboard/analytics')
    await expect(page.locator('text=Total Invoices')).toBeVisible()
    // Stats should reflect the new invoice and payment
  })

  test('CSV import creates multiple invoices', async ({ page }) => {
    await page.goto('/dashboard/invoices/import')

    // Create CSV file content
    const csvContent = `invoice_number,customer_name,customer_email,amount,due_date,currency
E2E-CSV-001,Customer One,one@test.com,500.00,2025-12-31,AED
E2E-CSV-002,Customer Two,two@test.com,750.00,2025-12-31,AED
E2E-CSV-003,Customer Three,three@test.com,1200.00,2025-12-31,AED`

    // Upload CSV
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles({
      name: 'test-invoices.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(csvContent)
    })

    // Verify preview shows
    await expect(page.locator('text=Preview')).toBeVisible()
    await expect(page.locator('text=E2E-CSV-001')).toBeVisible()

    // Import
    await page.click('button:has-text("Import Invoices")')

    // Verify success
    await expect(page.locator('text=/Successfully imported 3 invoices/')).toBeVisible()

    // Verify invoices appear in list
    await expect(page).toHaveURL('/dashboard/invoices')
    await expect(page.locator('text=E2E-CSV-001')).toBeVisible()
    await expect(page.locator('text=E2E-CSV-002')).toBeVisible()
    await expect(page.locator('text=E2E-CSV-003')).toBeVisible()
  })

  test('Campaign with multiple invoices', async ({ page }) => {
    // Prerequisite: Create 3 test invoices (using API for speed)
    const invoiceIds = []
    for (let i = 1; i <= 3; i++) {
      const response = await page.request.post('/api/invoices', {
        data: {
          invoice_number: `BULK-${i}`,
          customer_name: `Customer ${i}`,
          customer_email: `customer${i}@test.com`,
          amount: 500.00 * i,
          currency: 'AED',
          due_date: '2025-12-31',
          items: [{ description: 'Test', quantity: 1, unit_price: 500.00 * i }]
        }
      })
      const invoice = await response.json()
      invoiceIds.push(invoice.id)
    }

    // Create campaign with all 3 invoices
    await page.goto('/dashboard/campaigns/create')
    await page.fill('[name="name"]', 'Bulk Campaign Test')

    // Select all 3 invoices
    await page.click('text=BULK-1')
    await page.click('text=BULK-2')
    await page.click('text=BULK-3')

    await page.click('button:has-text("Create & Send Campaign")')

    // Verify campaign sent to 3 customers
    await expect(page.locator('text=/3 emails delivered/')).toBeVisible()
  })

  test('Error handling - invalid invoice data', async ({ page }) => {
    await page.goto('/dashboard/invoices/new')

    // Try to submit with missing required fields
    await page.fill('[name="invoice_number"]', 'ERROR-TEST')
    // Leave customer_name empty
    await page.fill('[name="amount"]', '100.00')

    await page.click('button[type="submit"]')

    // Should show validation error
    await expect(page.locator('text=/required/i')).toBeVisible()

    // Should not navigate away
    await expect(page).toHaveURL('/dashboard/invoices/new')
  })

  test('Payment recording partial payment', async ({ page }) => {
    // Create invoice for 1000 AED
    const response = await page.request.post('/api/invoices', {
      data: {
        invoice_number: 'PARTIAL-TEST',
        customer_name: 'Partial Customer',
        customer_email: 'partial@test.com',
        amount: 1000.00,
        currency: 'AED',
        due_date: '2025-12-31',
        items: [{ description: 'Test', quantity: 1, unit_price: 1000.00 }]
      }
    })
    const invoice = await response.json()

    await page.goto(`/dashboard/invoices/${invoice.id}`)

    // Record partial payment of 600 AED
    await page.click('button:has-text("Record Payment")')
    await page.fill('[name="amount"]', '600.00')
    await page.click('button:has-text("Record Payment")')

    // Invoice should still show as partially paid, not fully paid
    await expect(page.locator('text=/400.*outstanding/i')).toBeVisible()

    // Record remaining 400 AED
    await page.click('button:has-text("Record Payment")')
    await page.fill('[name="amount"]', '400.00')
    await page.click('button:has-text("Record Payment")')

    // Now should show as fully paid
    await expect(page.locator('text=/PAID/i')).toBeVisible()
  })
})
```

**Additional E2E Tests to Create**:
```
tests/e2e/customer-management.spec.ts
tests/e2e/analytics-dashboard.spec.ts
tests/e2e/email-campaign-scenarios.spec.ts
tests/e2e/authentication.spec.ts
```

### Day 3 (Nov 17): Settings UI - Company Settings

```typescript
// File: src/app/[locale]/dashboard/settings/page.tsx

'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'

export default function SettingsPage() {
  const { data: session } = useSession()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [settings, setSettings] = useState({
    company_name: '',
    reply_to_email: '',
    email_signature: '',
    default_subject_template: 'Payment Reminder - Invoice {invoice_number}',
    default_message_template: `Dear {customer_name},

This is a friendly reminder that invoice {invoice_number} for {amount} {currency} is due on {due_date}.

Please arrange payment at your earliest convenience.

Best regards,
{company_name}`
  })

  useEffect(() => {
    fetchSettings()
  }, [])

  async function fetchSettings() {
    try {
      const response = await fetch('/api/settings')
      if (!response.ok) throw new Error('Failed to fetch settings')

      const data = await response.json()
      setSettings({
        company_name: data.company_name || '',
        reply_to_email: data.email_settings?.replyTo || '',
        email_signature: data.email_settings?.signature || '',
        default_subject_template: data.email_settings?.defaultSubject || settings.default_subject_template,
        default_message_template: data.email_settings?.defaultMessage || settings.default_message_template
      })
    } catch (error) {
      console.error('Error fetching settings:', error)
      toast.error('Failed to load settings')
    } finally {
      setLoading(false)
    }
  }

  async function handleSave() {
    setSaving(true)

    try {
      const response = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_name: settings.company_name,
          email_settings: {
            replyTo: settings.reply_to_email,
            signature: settings.email_signature,
            defaultSubject: settings.default_subject_template,
            defaultMessage: settings.default_message_template
          }
        })
      })

      if (!response.ok) throw new Error('Failed to save settings')

      toast.success('Settings saved successfully')
    } catch (error) {
      console.error('Error saving settings:', error)
      toast.error('Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="p-8">Loading settings...</div>
  }

  return (
    <div className="p-8 max-w-4xl">
      <h1 className="text-3xl font-bold mb-6">Company Settings</h1>

      <div className="space-y-8">
        {/* Company Information */}
        <section className="border rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Company Information</h2>

          <div className="space-y-4">
            <div>
              <Label htmlFor="company_name">Company Name</Label>
              <Input
                id="company_name"
                value={settings.company_name}
                onChange={(e) => setSettings(prev => ({ ...prev, company_name: e.target.value }))}
              />
            </div>
          </div>
        </section>

        {/* Email Settings */}
        <section className="border rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Email Settings</h2>

          <div className="space-y-4">
            <div>
              <Label htmlFor="reply_to_email">Reply-To Email Address</Label>
              <Input
                id="reply_to_email"
                type="email"
                value={settings.reply_to_email}
                onChange={(e) => setSettings(prev => ({ ...prev, reply_to_email: e.target.value }))}
                placeholder="finance@yourcompany.com"
              />
              <p className="text-xs text-gray-500 mt-1">
                When customers reply to reminder emails, replies will go to this address
              </p>
            </div>

            <div>
              <Label htmlFor="email_signature">Email Signature</Label>
              <Textarea
                id="email_signature"
                rows={4}
                value={settings.email_signature}
                onChange={(e) => setSettings(prev => ({ ...prev, email_signature: e.target.value }))}
                placeholder="Best regards,
Your Company Name
+971 XX XXX XXXX
www.yourcompany.com"
              />
              <p className="text-xs text-gray-500 mt-1">
                This signature will be appended to all reminder emails
              </p>
            </div>
          </div>
        </section>

        {/* Email Templates */}
        <section className="border rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Default Email Templates</h2>

          <div className="space-y-4">
            <div>
              <Label htmlFor="default_subject">Default Subject Line</Label>
              <Input
                id="default_subject"
                value={settings.default_subject_template}
                onChange={(e) => setSettings(prev => ({ ...prev, default_subject_template: e.target.value }))}
              />
              <p className="text-xs text-gray-500 mt-1">
                Available merge tags: {'{invoice_number}'}, {'{customer_name}'}, {'{amount}'}, {'{currency}'}, {'{due_date}'}, {'{company_name}'}
              </p>
            </div>

            <div>
              <Label htmlFor="default_message">Default Message Template</Label>
              <Textarea
                id="default_message"
                rows={10}
                value={settings.default_message_template}
                onChange={(e) => setSettings(prev => ({ ...prev, default_message_template: e.target.value }))}
              />
              <p className="text-xs text-gray-500 mt-1">
                This template will be used when creating new campaigns. You can customize it for each campaign.
              </p>
            </div>
          </div>
        </section>

        {/* Save Button */}
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save Settings'}
          </Button>
        </div>
      </div>
    </div>
  )
}
```

**API Endpoint to Create**:
```typescript
// File: src/app/api/settings/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.companyId) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    const company = await prisma.company.findUnique({
      where: { id: session.user.companyId },
      select: {
        id: true,
        name: true,
        email_settings: true
      }
    })

    if (!company) {
      return NextResponse.json({ message: 'Company not found' }, { status: 404 })
    }

    return NextResponse.json({
      company_name: company.name,
      email_settings: company.email_settings || {}
    })

  } catch (error) {
    console.error('Error fetching settings:', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.companyId) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { company_name, email_settings } = body

    const company = await prisma.company.update({
      where: { id: session.user.companyId },
      data: {
        name: company_name,
        email_settings: email_settings
      }
    })

    return NextResponse.json({
      message: 'Settings updated successfully',
      company
    })

  } catch (error) {
    console.error('Error updating settings:', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}
```

### Day 4-5 (Nov 18-19): Monitoring Setup

**Sentry Integration** (2 hours):
```bash
# Install Sentry
npm install @sentry/nextjs

# Run Sentry wizard
npx @sentry/wizard@latest -i nextjs
```

```typescript
// File: sentry.client.config.ts

import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Adjust sample rate for production
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

  // Capture errors for specific environments
  environment: process.env.NODE_ENV,

  // Don't capture in development
  enabled: process.env.NODE_ENV === 'production',

  // Capture user context
  beforeSend(event, hint) {
    // Add custom context
    if (event.user) {
      event.user = {
        id: event.user.id,
        email: event.user.email,
        // Don't send sensitive data
      }
    }
    return event
  }
})
```

```typescript
// File: sentry.server.config.ts

import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
  environment: process.env.NODE_ENV,
  enabled: process.env.NODE_ENV === 'production'
})
```

**Uptime Monitoring Setup** (30 minutes):
```markdown
1. Sign up for BetterStack (https://betterstack.com) - FREE tier
2. Add monitor for https://reminder.yourapp.com
3. Set check interval: 1 minute
4. Add alert email: your-email@company.com
5. Configure status page (optional, public-facing)
```

**Enhanced Logging Utility** (1 hour):
```typescript
// File: src/lib/logger.ts

import * as Sentry from '@sentry/nextjs'

type LogLevel = 'info' | 'warn' | 'error' | 'debug'

interface LogContext {
  userId?: string
  companyId?: string
  invoiceId?: string
  campaignId?: string
  [key: string]: any
}

export class Logger {
  private context: LogContext

  constructor(context: LogContext = {}) {
    this.context = context
  }

  private log(level: LogLevel, message: string, data?: any) {
    const logData = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context: this.context,
      data
    }

    // Console logging (development)
    if (process.env.NODE_ENV === 'development') {
      console[level === 'debug' ? 'log' : level](
        `[${level.toUpperCase()}]`,
        message,
        data || ''
      )
    }

    // Sentry integration (production)
    if (process.env.NODE_ENV === 'production') {
      if (level === 'error') {
        Sentry.captureException(
          data instanceof Error ? data : new Error(message),
          {
            level: 'error',
            contexts: { custom: this.context },
            extra: data
          }
        )
      } else if (level === 'warn') {
        Sentry.captureMessage(message, {
          level: 'warning',
          contexts: { custom: this.context },
          extra: data
        })
      }
    }

    // Could add: Send to external logging service (e.g., Logtail)
  }

  info(message: string, data?: any) {
    this.log('info', message, data)
  }

  warn(message: string, data?: any) {
    this.log('warn', message, data)
  }

  error(message: string, error?: Error | any) {
    this.log('error', message, error)
  }

  debug(message: string, data?: any) {
    this.log('debug', message, data)
  }
}

// Usage example:
// const logger = new Logger({ userId: session.user.id, companyId: session.user.companyId })
// logger.info('Invoice created', { invoiceId: invoice.id })
// logger.error('Campaign send failed', error)
```

**Update Critical API Routes with Logging**:
```typescript
// Example: Update src/app/api/campaigns/[id]/send/route.ts

import { Logger } from '@/lib/logger'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  const logger = new Logger({
    userId: session?.user?.id,
    companyId: session?.user?.companyId,
    campaignId: params.id
  })

  try {
    logger.info('Starting campaign send', { campaignId: params.id })

    // ... existing campaign send logic ...

    logger.info('Campaign send completed', {
      campaignId: params.id,
      emailsSent: result.sent,
      emailsFailed: result.failed
    })

    return NextResponse.json(result)

  } catch (error) {
    logger.error('Campaign send failed', error)

    return NextResponse.json(
      { message: 'Failed to send campaign' },
      { status: 500 }
    )
  }
}
```

**Deliverable Week 3 End**:
- ✅ E2E test suite covers all core flows
- ✅ Settings UI allows Reply-To and signature configuration
- ✅ Sentry error tracking operational
- ✅ Uptime monitoring configured
- ✅ Centralized logging in critical endpoints
- ✅ Success metric: "Stable core product" = TRUE

---

## Week 4 (Nov 22-28): UAT Preparation

### Theme: "Ready for Customers"

**Goal**: Documentation, support infrastructure, POP Trading onboarding materials

### Day 1-2 (Nov 22-23): User Documentation

**Create Documentation Files**:

```markdown
# File: docs/user-guide/getting-started.md

# Getting Started with Reminder

Welcome to Reminder! This guide will help you get up and running in 15 minutes.

## Step 1: Create Your First Invoice

### Option A: Manual Creation
1. Click **Invoices** → **Create Invoice**
2. Fill in invoice details:
   - Invoice Number (e.g., INV-001)
   - Customer Name
   - Customer Email
   - Amount (e.g., 1000.00)
   - Currency (AED by default)
   - Due Date
3. Click **Create Invoice**

### Option B: CSV Import (Recommended for bulk)
1. Click **Invoices** → **Import CSV**
2. Download the sample CSV template
3. Fill in your invoice data following the format:
   ```
   invoice_number,customer_name,customer_email,amount,due_date,currency
   INV-001,Acme Corp,billing@acme.com,1000.00,2025-12-31,AED
   ```
4. Upload your CSV file
5. Review the preview
6. Click **Import Invoices**

## Step 2: Send Your First Reminder Campaign

1. Click **Campaigns** → **Create Campaign**
2. Give your campaign a name (e.g., "November Overdue Reminders")
3. Select invoices to include:
   - Check the boxes next to overdue invoices
   - You can select multiple invoices
4. Customize email content:
   - Subject line (uses merge tags)
   - Message body (uses merge tags)
   - Decide whether to attach invoice PDF
5. Click **Create & Send Campaign**
6. Emails will be sent immediately to customers

### Merge Tags Available:
- `{invoice_number}` - Invoice number
- `{customer_name}` - Customer name
- `{amount}` - Invoice amount
- `{currency}` - Currency code
- `{due_date}` - Due date
- `{company_name}` - Your company name

## Step 3: Record Payments

1. When a customer pays, go to **Invoices**
2. Click on the paid invoice
3. Click **Record Payment**
4. Enter:
   - Payment amount
   - Payment method (bank transfer, credit card, etc.)
   - Payment date
   - Reference number
5. Click **Record Payment**
6. Invoice status will automatically update

## Step 4: Monitor Analytics

1. Click **Analytics** in the navigation
2. View key metrics:
   - Total Outstanding Amount
   - Overdue Invoices Count
   - Collection Rate
   - Average Days to Payment
3. Use this data to track payment collection performance

## Next Steps

- Configure your **Settings** (company name, reply-to email, email signature)
- Set up **Customers** with payment terms
- Explore **Bucket Auto-Send** for automated time-based reminders

Need help? Contact support@usereminder.com
```

```markdown
# File: docs/user-guide/faq.md

# Frequently Asked Questions

## Invoice Management

**Q: Can I edit an invoice after creating it?**
A: Currently, you can only view invoices after creation. To correct an error, create a new invoice with the correct information.

**Q: What file formats can I import?**
A: We support CSV files with the following required columns: invoice_number, customer_name, customer_email, amount, due_date. Currency is optional (defaults to AED).

**Q: Can I delete an invoice?**
A: Not yet. This feature will be added in a future update. For now, you can mark invoices as "cancelled" by recording a zero-value payment.

## Email Campaigns

**Q: Why didn't my reminder email send?**
A: Check these common issues:
1. Customer email address is valid
2. Invoice status is not already "paid"
3. Check your AWS SES sending limits
4. Verify customer email is not in suppression list (bounced previously)

**Q: Can I schedule campaigns to send later?**
A: Not yet. Currently, campaigns send immediately when you click "Create & Send". Scheduled campaigns will be added in Q1 2026.

**Q: How do I know if a customer received the email?**
A: Check the campaign details page to see delivery status. We track:
- Sent
- Delivered
- Bounced
- Opened (if enabled)

## Payment Tracking

**Q: Can I record partial payments?**
A: Yes! When you record a payment for less than the full invoice amount, the invoice will show the outstanding balance. You can record multiple payments until the invoice is fully paid.

**Q: What payment methods are supported?**
A: We track these methods:
- Bank Transfer
- Credit Card
- Cash
- Cheque
- Other

**Q: How do I reconcile payments?**
A: Go to **Payments** to see all recorded payments. Match them against your bank statements using the reference numbers.

## Multi-Currency

**Q: Can I use currencies other than AED?**
A: Yes! We support multiple currencies. When creating an invoice or importing CSV, specify the currency code (e.g., USD, EUR, GBP).

**Q: Does Reminder handle currency conversion?**
A: No, Reminder displays amounts in their original currency. It does not perform currency conversion.

## Support

**Q: How do I report a bug?**
A: Email support@usereminder.com with:
- Description of the issue
- Steps to reproduce
- Screenshots (if applicable)
- Your account email

**Q: What are your support hours?**
A: Sunday-Thursday, 9 AM - 6 PM UAE time. We respond to all support requests within 24 hours.

**Q: Can I request a new feature?**
A: Yes! Email feature requests to support@usereminder.com. We prioritize based on customer demand and strategic fit.
```

```markdown
# File: docs/user-guide/troubleshooting.md

# Troubleshooting Guide

## PDF Upload Issues

**Problem**: "PDF upload failed"

**Solutions**:
1. Check file size (max 10MB)
2. Ensure file is actually a PDF (not renamed image)
3. Try uploading a different PDF
4. Check your internet connection

**Problem**: "PDF uploaded but invoice details not extracted"

**Solutions**:
1. PDF extraction works best with standard invoice formats
2. Try manually entering invoice details instead
3. If repeated failures, email the PDF to support@usereminder.com for analysis

## Email Delivery Issues

**Problem**: "Campaign sent but customer didn't receive email"

**Check These Steps**:
1. **Verify email address**: Is it spelled correctly?
2. **Check spam folder**: Customer should check junk/spam
3. **Bounce status**: Did the email bounce? (Check campaign details)
4. **AWS SES limits**: Have you hit daily sending quota?

**Problem**: "Email bounced"

**Understanding Bounce Types**:
- **Hard Bounce** (Permanent): Email address doesn't exist or domain invalid
  - Action: Update customer email address
  - Email automatically added to suppression list

- **Soft Bounce** (Temporary): Mailbox full or server temporarily unavailable
  - Action: Try again in 24-48 hours

**Problem**: "Customer marked email as spam"

**Actions**:
1. Email automatically added to suppression list
2. Contact customer directly (phone/WhatsApp) to resolve
3. Get permission before sending future reminders
4. Consider if email tone is too aggressive

## Payment Recording Issues

**Problem**: "Can't record payment - button not working"

**Solutions**:
1. Refresh the page
2. Try different browser
3. Check if invoice is already marked as paid
4. Clear browser cache

**Problem**: "Recorded wrong payment amount"

**Solutions**:
1. Currently, you cannot edit payments after recording
2. Contact support@usereminder.com to request correction
3. Workaround: Record another payment with negative amount (not recommended)

## Performance Issues

**Problem**: "Dashboard loading slowly"

**Solutions**:
1. Check your internet connection speed
2. Try different browser
3. Clear browser cache and cookies
4. If persistent, contact support (may be server issue)

**Problem**: "CSV import taking a long time"

**Expected Times**:
- 100 invoices: ~30 seconds
- 500 invoices: ~2 minutes
- 1000+ invoices: ~5 minutes

**If Slower**:
1. Check file size and format
2. Ensure CSV is properly formatted
3. Try importing in smaller batches (200-300 at a time)

## Login Issues

**Problem**: "Forgot password"

**Solutions**:
1. Click "Forgot Password" on login page
2. Enter your email address
3. Check email for reset link (check spam folder)
4. Link expires in 1 hour

**Problem**: "Account locked after multiple failed login attempts"

**Solutions**:
1. Wait 30 minutes before trying again
2. Use password reset if you've forgotten password
3. Contact support if urgent access needed

## Data Export Issues

**Problem**: "How do I export my data?"

**Current Status**:
- Data export feature not yet available
- Coming in Q1 2026
- Contact support@usereminder.com for manual export

## Still Need Help?

**Email**: support@usereminder.com
**Response Time**: Within 24 hours (business days)
**Hours**: Sunday-Thursday, 9 AM - 6 PM UAE time

**When contacting support, please include**:
1. Clear description of the problem
2. Steps to reproduce
3. Screenshots or screen recording
4. Your account email
5. Browser and device information
```

### Day 3 (Nov 24): GitHub Issues Setup

**Create Issue Templates**:

```bash
# Create directory
mkdir -p .github/ISSUE_TEMPLATE

# Create 3 templates
```

```yaml
# File: .github/ISSUE_TEMPLATE/bug_report.yml

name: Bug Report
description: Report a bug or issue
labels: ["bug", "needs-triage"]
body:
  - type: markdown
    attributes:
      value: |
        Thanks for taking the time to report this bug!

  - type: input
    id: summary
    attributes:
      label: Bug Summary
      description: Clear one-line description of what's not working
      placeholder: "e.g., PDF upload fails for invoices over 5MB"
    validations:
      required: true

  - type: textarea
    id: steps
    attributes:
      label: Steps to Reproduce
      description: Detailed steps to reproduce the issue
      placeholder: |
        1. Go to Invoices → Upload PDF
        2. Select PDF file larger than 5MB
        3. Click Upload
        4. See error message
    validations:
      required: true

  - type: textarea
    id: expected
    attributes:
      label: Expected Behavior
      description: What should happen?
      placeholder: "PDF should upload successfully"
    validations:
      required: true

  - type: textarea
    id: actual
    attributes:
      label: Actual Behavior
      description: What actually happens?
      placeholder: "Error message: 'Upload failed'"
    validations:
      required: true

  - type: dropdown
    id: browser
    attributes:
      label: Browser
      options:
        - Chrome
        - Firefox
        - Safari
        - Edge
        - Other
    validations:
      required: true

  - type: dropdown
    id: device
    attributes:
      label: Device
      options:
        - Desktop
        - Mobile
        - Tablet
    validations:
      required: true

  - type: input
    id: account
    attributes:
      label: Account Email
      description: Your account email (for internal tracking)
      placeholder: "customer@company.com"
    validations:
      required: true

  - type: textarea
    id: screenshots
    attributes:
      label: Screenshots
      description: Add screenshots or screen recordings if applicable

  - type: textarea
    id: additional
    attributes:
      label: Additional Context
      description: Anything else we should know?
```

```yaml
# File: .github/ISSUE_TEMPLATE/feature_request.yml

name: Feature Request
description: Suggest an enhancement or new feature
labels: ["enhancement", "needs-review"]
body:
  - type: markdown
    attributes:
      value: |
        We love hearing your ideas!

  - type: input
    id: title
    attributes:
      label: Feature Title
      description: Short description of the feature
      placeholder: "e.g., Email scheduling - send campaigns at specific times"
    validations:
      required: true

  - type: textarea
    id: description
    attributes:
      label: Feature Description
      description: What would you like to see added?
      placeholder: "I would like to schedule campaigns to send at 9 AM instead of sending immediately..."
    validations:
      required: true

  - type: textarea
    id: use_case
    attributes:
      label: Use Case
      description: Why do you need this feature? How would it help your workflow?
      placeholder: "Currently I have to manually send campaigns at specific times. This feature would let me schedule them the night before..."
    validations:
      required: true

  - type: textarea
    id: workaround
    attributes:
      label: Current Workaround
      description: How are you handling this now?
      placeholder: "I set a phone alarm and manually send campaigns at the right time"

  - type: dropdown
    id: priority
    attributes:
      label: Priority (Your Assessment)
      description: How important is this to your workflow?
      options:
        - Critical (blocking my work)
        - High (major pain point)
        - Medium (nice to have)
        - Low (future enhancement)
    validations:
      required: true
```

```yaml
# File: .github/ISSUE_TEMPLATE/question.yml

name: Question
description: Ask a question about usage
labels: ["question"]
body:
  - type: markdown
    attributes:
      value: |
        Before asking, please check the FAQ: docs/user-guide/faq.md

  - type: textarea
    id: question
    attributes:
      label: Question
      description: What would you like to know?
      placeholder: "How do I configure automatic reminders for invoices 7 days before due date?"
    validations:
      required: true

  - type: textarea
    id: context
    attributes:
      label: Context
      description: What are you trying to accomplish?
      placeholder: "I want to set up automated reminders without having to manually create campaigns each time"
```

**Configure GitHub Labels**:
```bash
# Priority Labels
gh label create "P0-critical" --color "d93f0b" --description "System down, blocking all work"
gh label create "P1-urgent" --color "ff9800" --description "Feature broken, major impact"
gh label create "P2-high" --color "ffc107" --description "Important but has workaround"
gh label create "P3-normal" --color "4caf50" --description "Minor issue"
gh label create "P4-low" --color "2196f3" --description "Nice to fix eventually"

# Type Labels
gh label create "bug" --color "d73a4a" --description "Something broken"
gh label create "enhancement" --color "a2eeef" --description "New feature request"
gh label create "question" --color "d876e3" --description "User question"
gh label create "documentation" --color "0075ca" --description "Docs improvement"

# Status Labels
gh label create "needs-triage" --color "ededed" --description "New, not yet reviewed"
gh label create "in-progress" --color "yellow" --description "Actively being worked on"
gh label create "blocked" --color "red" --description "Waiting on something"
gh label create "fixed" --color "green" --description "Fix deployed, awaiting verification"
gh label create "wont-fix" --color "gray" --description "Not addressing this"

# Component Labels
gh label create "frontend" --color "c5def5" --description "UI/UX issues"
gh label create "backend" --color "f9d0c4" --description "API/database issues"
gh label create "email" --color "bfdadc" --description "Email delivery issues"
gh label create "pdf-upload" --color "fef2c0" --description "PDF extraction issues"
gh label create "payments" --color "c2e0c6" --description "Payment tracking issues"
```

### Day 4 (Nov 25): POP Trading Onboarding Materials

```markdown
# File: docs/onboarding/pop-trading-setup-guide.md

# POP Trading Company - Onboarding Guide

**Welcome to Reminder!** This guide is customized for POP Trading Company's workflow.

## Pre-UAT Checklist

- [ ] Account created: trading@poptrading.com
- [ ] Password set and verified
- [ ] Company name set: "POP Trading Company"
- [ ] Reply-to email configured: finance@poptrading.com
- [ ] Email signature uploaded
- [ ] Slack channel created: #pop-trading-beta
- [ ] Test invoices imported (10 sample invoices)

## Week 5 UAT Schedule

**Monday, November 29** - Kickoff (1 hour)
- Introduction to Reminder platform
- Walkthrough of key features
- Import first batch of real invoices

**Tuesday-Wednesday** - Real Usage
- Import all outstanding invoices (CSV)
- Send first reminder campaign
- Record payments as they come in
- Daily check-in (15 minutes)

**Thursday** - Mid-week review (30 minutes)
- What's working well?
- What's confusing or broken?
- Collect feedback on missing features

**Friday** - Week wrap-up (30 minutes)
- Review analytics dashboard
- Discuss multi-currency handling
- Plan for Week 2 of UAT

**Following Week** - Continued usage
- Continue sending reminders
- Monitor email deliverability
- Track payment collection improvements

## Your Workflow with Reminder

### Step 1: Export Invoices from Your System
- Export invoices from your current system as CSV
- Required fields: invoice_number, customer_name, customer_email, amount, due_date, currency
- Currency codes: AED, USD, EUR (as needed)

### Step 2: Import to Reminder
- Click **Invoices** → **Import CSV**
- Upload your CSV file
- Review preview to verify data looks correct
- Click **Import Invoices**
- Expected time: 400 invoices = ~2 minutes

### Step 3: Send Reminder Campaigns
**Scenario 1: Overdue Invoices**
- Create campaign "Overdue Payment Reminders"
- Select all overdue invoices
- Customize message tone (friendly but firm)
- Send immediately

**Scenario 2: Upcoming Due Dates**
- Create campaign "Payment Due Soon"
- Select invoices due in next 7 days
- Polite reminder tone
- Send immediately

**Scenario 3: Specific Customer Follow-up**
- Filter invoices by customer
- Create targeted campaign
- Personalized message
- Send immediately

### Step 4: Track Responses
- Monitor email delivery status in campaign details
- Check for bounces (invalid emails)
- Record payments as customers pay
- Watch outstanding balance decrease

### Step 5: Analyze Results
- Go to Analytics dashboard
- Monitor:
  - Collection rate improvement
  - Average days to payment
  - Outstanding balance trend
- Share results with team

## Multi-Currency Handling

Your invoices use multiple currencies (AED, USD, EUR). Here's how Reminder handles this:

**Invoice Creation**:
- Specify currency for each invoice
- Amounts displayed in original currency
- No automatic conversion

**Email Campaigns**:
- Email shows: "AED 5,000.00" or "USD 1,500.00"
- Merge tag {amount} {currency} displays correctly

**Analytics Dashboard**:
- Totals calculated in AED equivalent (your base currency)
- Individual invoices maintain original currency

**Important**: Verify currency codes during CSV import:
```csv
invoice_number,customer_name,customer_email,amount,due_date,currency
INV-2501,Customer A,a@example.com,5000.00,2025-12-31,AED
INV-2502,Customer B,b@example.com,1500.00,2025-12-31,USD
INV-2503,Customer C,c@example.com,2000.00,2025-12-31,EUR
```

## Support During UAT

**Dedicated Support Channels**:
- **Slack**: #pop-trading-beta (real-time during UAT week)
- **Email**: support@usereminder.com (24-hour response)
- **Emergency**: Contact [Your Name] directly

**SLA During UAT**:
- Critical issues (system down): 1 hour response
- Important issues (feature broken): 4 hour response
- Questions/feedback: Same day response

**Daily Check-ins**:
- Time: 10:00 AM UAE time
- Duration: 15 minutes
- Format: Quick Slack standup
- Topics:
  - What worked yesterday?
  - Any issues encountered?
  - What are you testing today?

## Feedback Collection

We want your honest feedback! Please share:

**What's Working Well**:
- Features that save you time
- UI elements that are intuitive
- Workflows that make sense

**What's Frustrating**:
- Confusing interfaces
- Features that don't work as expected
- Missing functionality you need

**Feature Requests**:
- What would make this more valuable?
- What's missing from your ideal workflow?
- What integrations would help?

**Use This Template**:
```
Feature: [Name]
Current Problem: [What's not working or missing]
Desired Solution: [What you'd like to see]
Priority: [Critical / High / Medium / Low]
```

## Success Metrics

At the end of UAT (Week 6), we'll evaluate:

**Technical Success**:
- [ ] 95%+ email delivery rate
- [ ] Zero critical bugs
- [ ] All core workflows function correctly

**Business Value**:
- [ ] Collection rate improvement (target: +10%)
- [ ] Average days to payment reduction
- [ ] Time saved on invoice chasing

**User Satisfaction**:
- [ ] Would you recommend Reminder to others? (NPS)
- [ ] Are you willing to pay for this product?
- [ ] Would you continue using after beta?

## Questions?

**Before UAT Starts**:
- Email: support@usereminder.com
- We'll set up a 30-minute onboarding call

**During UAT**:
- Slack: #pop-trading-beta (fastest)
- Email: support@usereminder.com
- Phone: [If provided]

**Thank you for being our first customer!** Your feedback will directly shape the product.
```

**Deliverable Week 4 End**:
- ✅ User documentation (Getting Started, FAQ, Troubleshooting)
- ✅ GitHub Issues templates and labels configured
- ✅ POP Trading onboarding guide complete
- ✅ Support email (support@usereminder.com) set up
- ✅ Slack channel created: #pop-trading-beta
- ✅ Success metric: "Ready for POP Trading" = TRUE

---

## Week 5 (Nov 29-Dec 5): UAT with POP Trading

### Theme: "Customer Validation"

**Goal**: POP Trading successfully uses Reminder for real invoice collection

### Daily Structure

**Every Morning (10:00 AM UAE)**:
```
Slack Standup in #pop-trading-beta:

Good morning POP Trading team!

Yesterday's Activity:
- [Summary of what they accomplished]
- [Any issues we fixed]

Today's Focus:
- [What they plan to test]
- [Features to explore]

Blockers:
- [Any open issues]

Our Support Availability:
- Available all day for questions
- Response time: < 1 hour
```

### Monday, Nov 29: Kickoff + First Import

**Morning (2 hours)**:
- Onboarding call with POP Trading
- Walkthrough of Reminder platform
- Answer initial questions
- Import 10 test invoices together

**Afternoon**:
- POP Trading imports real invoice data
- Monitor for any import errors
- Fix issues immediately if they arise

**Evening**:
- Review import success rate
- Document any data format issues
- Prepare fixes for next day if needed

### Tuesday-Wednesday, Nov 30-Dec 1: Campaign Creation + Sending

**Tasks**:
- POP Trading creates first real campaign
- Send reminders to actual customers
- Monitor email delivery rates

**Our Monitoring**:
```sql
-- Check campaign performance in real-time
SELECT
  c.name,
  c.created_at,
  COUNT(el.id) as total_emails,
  SUM(CASE WHEN el.delivery_status = 'DELIVERED' THEN 1 ELSE 0 END) as delivered,
  SUM(CASE WHEN el.delivery_status = 'BOUNCED' THEN 1 ELSE 0 END) as bounced,
  SUM(CASE WHEN el.delivery_status = 'FAILED' THEN 1 ELSE 0 END) as failed
FROM campaigns c
LEFT JOIN email_logs el ON el.campaign_id = c.id
WHERE c.company_id = '[POP_TRADING_COMPANY_ID]'
GROUP BY c.id
ORDER BY c.created_at DESC
```

**Success Criteria**:
- 95%+ delivery rate
- Zero critical bugs reported
- POP Trading able to send campaigns independently

### Thursday, Dec 2: Mid-Week Review

**30-Minute Call**:
1. What's working well?
2. What's confusing or frustrating?
3. Any missing features blocking workflow?
4. Multi-currency handling - any issues?

**Collect Specific Feedback**:
- UI/UX pain points
- Feature gaps
- Performance issues
- Email template customization needs

**Document Everything**:
```markdown
# UAT Mid-Week Feedback - December 2

## Positive Feedback
- [List what's working well]

## Issues Encountered
1. **Issue**: [Description]
   - **Severity**: P0 / P1 / P2 / P3
   - **Status**: Fixed / In Progress / Planned
   - **GitHub Issue**: #123

## Feature Requests
1. **Request**: [Description]
   - **Use Case**: [Why they need it]
   - **Priority**: Critical / High / Medium / Low
   - **Planned**: Yes / No / Maybe

## Action Items
- [ ] Fix issue #1
- [ ] Investigate feature request #2
- [ ] Improve UI element X
```

### Friday, Dec 3: Payment Recording + Analytics

**Tasks**:
- POP Trading records incoming payments
- Review analytics dashboard together
- Discuss early results

**Metrics to Review**:
- How many reminder emails sent?
- How many customers responded?
- Any payment rate improvement?
- Average days to payment trend

### Week 5 End Deliverable:
- ✅ POP Trading using Reminder daily
- ✅ At least 1 campaign sent with real invoices
- ✅ Payment recording tested
- ✅ Multi-currency handling validated
- ✅ Feedback collected and documented
- ✅ Success metric: "Customer validation" = TRUE

**Go/No-Go Decision (Dec 5)**:
```
Question: Is the product ready for beta launch?

Criteria:
✅ Core workflow works (invoice → campaign → payment)
✅ POP Trading willing to continue using
✅ No P0/P1 bugs remaining
✅ Email delivery >95%
✅ Multi-currency handling acceptable

Decision: GO / NO-GO / NEED 1 MORE WEEK
```

---

## Week 6 (Dec 6-12): Polish + Final QA

### Theme: "Launch Ready"

**Goal**: Address UAT feedback, final security/performance checks

### Day 1-2 (Dec 6-7): Address UAT Feedback

**Priority 1 - Critical Issues**:
- Fix any P0/P1 bugs found during UAT
- Address blocking feature gaps
- Improve confusing UI elements

**Priority 2 - Quick Wins**:
- UI copy improvements
- Better error messages
- Performance optimizations

**Priority 3 - Nice to Haves**:
- Defer to post-launch if time constrained

### Day 3 (Dec 8): Security Audit

**Security Checklist**:
```
Authentication & Authorization:
□ All API routes check session authentication
□ Company data isolation enforced (no cross-company data access)
□ Role-based permissions working correctly
□ Password requirements enforced (min 8 characters)
□ Session timeout configured (24 hours)

Data Protection:
□ All sensitive data encrypted at rest (AWS RDS encryption)
□ HTTPS enforced for all traffic
□ Environment variables secured (not in git)
□ Database connection strings not exposed

Email Security:
□ SPF records configured for domain
□ DKIM signing enabled in AWS SES
□ Bounce/complaint handling active
□ Email suppression list prevents spam

API Security:
□ Rate limiting on auth endpoints
□ CSRF protection enabled
□ Input validation on all API routes
□ SQL injection prevention (Prisma parameterized queries)

Third-Party Security:
□ AWS credentials rotated recently
□ No hardcoded secrets in codebase
□ Dependencies up to date (npm audit)
□ Sentry configured to not log sensitive data
```

**Run Security Scan**:
```bash
# Check for known vulnerabilities
npm audit

# Fix critical vulnerabilities
npm audit fix

# Check for hardcoded secrets
git secrets --scan

# TypeScript strict mode check
npx tsc --noEmit --strict
```

### Day 4 (Dec 9): Performance Validation

**Performance Checklist**:
```
Page Load Times (Target: <3 seconds):
□ Dashboard: [Test with 100+ invoices]
□ Invoice List: [Test with 500+ invoices]
□ Campaign Creation: [Test with 100+ invoices]
□ Analytics: [Test with 1 month of data]

API Response Times (Target: <500ms):
□ GET /api/invoices: [Load test with 1000 invoices]
□ POST /api/campaigns/[id]/send: [Load test with 50 recipients]
□ GET /api/analytics/dashboard: [Load test with complex queries]

Database Performance:
□ All critical queries have indexes
□ N+1 query problems resolved
□ Connection pooling working (Supabase)

Email Sending Performance:
□ Batch sending works for 100+ emails
□ No timeout errors during campaign send
□ AWS SES rate limits respected
```

**Load Testing Script**:
```typescript
// File: scripts/load-test-campaign-send.ts

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function loadTest() {
  console.log('🧪 Load Test: Campaign Send with 100 invoices')

  // Create 100 test invoices
  const invoices = []
  for (let i = 1; i <= 100; i++) {
    const invoice = await prisma.invoice.create({
      data: {
        invoice_number: `LOAD-TEST-${i}`,
        customer_email: `customer${i}@loadtest.com`,
        customer_name: `Load Test Customer ${i}`,
        amount: 1000.00,
        currency: 'AED',
        due_date: new Date('2025-12-31'),
        company_id: testCompanyId
      }
    })
    invoices.push(invoice.id)
  }

  console.log(`✅ Created ${invoices.length} test invoices`)

  // Create campaign
  const startTime = Date.now()

  const campaign = await fetch('http://localhost:3000/api/campaigns', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': getAuthCookie()
    },
    body: JSON.stringify({
      name: 'Load Test Campaign',
      invoice_ids: invoices,
      subject: 'Test',
      message: 'Test message',
      attach_invoice_pdf: false
    })
  })

  const campaignData = await campaign.json()
  const campaignTime = Date.now() - startTime
  console.log(`✅ Campaign created in ${campaignTime}ms`)

  // Send campaign
  const sendStartTime = Date.now()

  const sendResponse = await fetch(`http://localhost:3000/api/campaigns/${campaignData.id}/send`, {
    method: 'POST',
    headers: { 'Cookie': getAuthCookie() }
  })

  const result = await sendResponse.json()
  const sendTime = Date.now() - sendStartTime

  console.log(`✅ Campaign sent in ${sendTime}ms`)
  console.log(`📊 Results:`)
  console.log(`   - Total emails: ${result.total}`)
  console.log(`   - Sent: ${result.sent}`)
  console.log(`   - Failed: ${result.failed}`)
  console.log(`   - Average time per email: ${(sendTime / result.total).toFixed(2)}ms`)

  // Cleanup
  await prisma.invoice.deleteMany({
    where: { invoice_number: { startsWith: 'LOAD-TEST-' } }
  })

  console.log('✅ Cleanup complete')
}

loadTest()
```

### Day 5 (Dec 10): Final Manual Testing

**Complete Manual Test Scenarios**:
```
Scenario 1: Complete Invoice Lifecycle
□ Create invoice manually
□ Send reminder campaign
□ Record full payment
□ Verify status changes correctly

Scenario 2: CSV Import + Bulk Campaign
□ Import 50 invoices via CSV
□ Create campaign with all invoices
□ Send campaign
□ Verify all emails delivered

Scenario 3: Multi-Currency
□ Create invoices in AED, USD, EUR
□ Send campaign with mixed currencies
□ Verify email merge tags show correct currency
□ Check analytics handles multiple currencies

Scenario 4: Payment Recording Edge Cases
□ Record partial payment
□ Record overpayment
□ Record payment for wrong amount
□ Record multiple payments for one invoice

Scenario 5: Error Scenarios
□ Try to create invoice with invalid email
□ Send campaign with no invoices selected
□ Record negative payment amount
□ Import CSV with malformed data

Scenario 6: Settings Configuration
□ Update company name
□ Configure Reply-To email
□ Add email signature
□ Verify signature appears in sent emails
```

**Deliverable Week 6 End**:
- ✅ All UAT feedback addressed (P0/P1 issues)
- ✅ Security audit passed
- ✅ Performance validated (<3s page loads, <500ms API)
- ✅ Final manual testing complete
- ✅ Success metric: "Launch-ready" = TRUE

---

## Week 7 (Dec 13-19): 🚀 BETA LAUNCH

### Theme: "Go Live"

**Goal**: POP Trading goes fully live, begin onboarding next beta customers

### Monday, Dec 13: Launch Day

**Morning**:
```
□ Final deployment to production
□ Verify all environment variables correct
□ Run smoke tests on production
□ Verify monitoring working (Sentry, uptime)
□ Announce launch to POP Trading
```

**Announcement Email to POP Trading**:
```
Subject: 🚀 Reminder is Now Live - Thank You for Being Our First Customer!

Hi POP Trading team,

I'm excited to announce that Reminder is officially live for beta customers!

Thank you for your partnership during UAT. Your feedback has been invaluable in making this product better.

**What's Changed**:
- [List any final improvements from Week 6]

**What's Next**:
- Continue using Reminder for your invoice collection
- We'll monitor closely for any issues
- Support remains available via Slack and email

**Your Feedback Matters**:
- Weekly check-ins to see how it's going
- Continue reporting any bugs or feature requests
- Help us refine the product for wider launch

**Support**:
- Email: support@usereminder.com (24-hour response)
- Slack: #pop-trading-beta (real-time)

Thank you for believing in us!

Best regards,
[Your Name]
Reminder Team
```

**Afternoon**:
- Monitor production closely
- Watch for any errors in Sentry
- Check AWS SES delivery rates
- Verify POP Trading can access system

### Tuesday-Friday, Dec 14-17: Monitoring + Stability

**Daily Routine**:
```
Morning:
□ Check Sentry for any errors overnight
□ Review AWS SES delivery stats
□ Check uptime monitoring status
□ Quick Slack message to POP Trading

Afternoon:
□ Monitor active usage
□ Respond to any support requests
□ Document any issues found
□ Plan fixes for next day

Evening:
□ Review analytics (usage patterns)
□ Update status document
□ Prepare for next day
```

**Metrics to Track**:
```sql
-- Daily usage metrics
SELECT
  DATE(created_at) as date,
  COUNT(DISTINCT company_id) as active_companies,
  COUNT(*) as total_invoices_created
FROM invoices
WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY DATE(created_at)
ORDER BY date DESC

-- Campaign performance
SELECT
  DATE(c.created_at) as date,
  COUNT(c.id) as campaigns_sent,
  COUNT(el.id) as total_emails,
  SUM(CASE WHEN el.delivery_status = 'DELIVERED' THEN 1 ELSE 0 END) as delivered,
  ROUND(100.0 * SUM(CASE WHEN el.delivery_status = 'DELIVERED' THEN 1 ELSE 0 END) / COUNT(el.id), 2) as delivery_rate
FROM campaigns c
LEFT JOIN email_logs el ON el.campaign_id = c.id
WHERE c.created_at >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY DATE(c.created_at)
ORDER BY date DESC

-- Support volume
SELECT
  DATE(created_at) as date,
  COUNT(*) as github_issues,
  SUM(CASE WHEN labels LIKE '%bug%' THEN 1 ELSE 0 END) as bugs,
  SUM(CASE WHEN labels LIKE '%enhancement%' THEN 1 ELSE 0 END) as feature_requests
FROM github_issues
WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY DATE(created_at)
```

### Week 7 Success Metrics

**Technical Health**:
- ✅ 99%+ uptime
- ✅ 95%+ email delivery rate
- ✅ <5 bugs reported in Week 7
- ✅ All P0/P1 bugs fixed within SLA

**Customer Success**:
- ✅ POP Trading actively using daily
- ✅ Positive feedback from POP Trading
- ✅ No customer escalations

**Business Validation**:
- ✅ POP Trading would recommend to others (NPS >8)
- ✅ POP Trading willing to pay for product
- ✅ POP Trading requests continue after beta

---

## Week 8-9 (Dec 20-Jan 2): Holiday Monitoring

### Theme: "Steady State + Team Rest"

**Goal**: Maintain stability over holidays, no new feature deployment

**Reduced Schedule**:
- No new features deployed during holidays
- Monitor for critical issues only
- Light-touch support available
- Team gets well-deserved rest

**On-Call Rotation**:
```
Dec 20-26: [Team Member A] - Critical issues only
Dec 27-Jan 2: [Team Member B] - Critical issues only

Critical Issue Definition:
- System completely down
- No emails sending
- Data loss or corruption
- Security breach

Non-Critical (Can Wait):
- Feature requests
- UI improvements
- Performance optimizations
- Minor bugs
```

**Weekly Summary Email to Stakeholders**:
```
Subject: Reminder Beta - Week 8 Status

Hi team,

Quick update on Reminder beta launch:

**Usage Stats**:
- Active Companies: X
- Invoices Created: X
- Campaigns Sent: X
- Email Delivery Rate: X%

**System Health**:
- Uptime: X%
- Average Page Load: Xs
- Zero critical issues

**Customer Feedback**:
- [Any notable feedback from POP Trading]

**Next Steps**:
- Team rest over holidays
- Resume active development Jan 3
- Plan feature roadmap based on beta feedback

Happy holidays!
[Your Name]
```

---

## Week 10+ (Jan 2025): Iterate Based on Feedback

### Theme: "Continuous Improvement"

**Goal**: Add features based on real customer usage patterns

### Prioritization Framework

**Feature Evaluation Criteria**:
```
1. Customer Impact (1-10)
   - How many customers need this?
   - How critical is it to their workflow?

2. Development Effort (1-10)
   - How complex to build?
   - How much testing needed?

3. Strategic Fit (1-10)
   - Aligns with product vision?
   - Enables new customer segments?

Priority Score = (Customer Impact × 2) + Strategic Fit - (Development Effort)

High Priority: Score >15
Medium Priority: Score 10-15
Low Priority: Score <10
```

### Post-Beta Feature Candidates

**Based on Common Requests**:

**1. PDF Upload (If POP Trading Needs It)**
- Customer Request: "Can I upload PDF invoices instead of CSV?"
- Impact: High (reduces data entry)
- Effort: Medium (extraction already built)
- Decision: Add if UAT shows strong need

**2. Bucket Auto-Send (Based on Usage Patterns)**
- Customer Request: "Can reminders send automatically based on due date?"
- Impact: High (reduces manual campaign creation)
- Effort: Medium (backend service exists, needs UI)
- Decision: Add if customers send similar campaigns repeatedly

**3. Email Scheduling**
- Customer Request: "Can I schedule campaigns to send at specific times?"
- Impact: Medium (convenience feature)
- Effort: Medium (requires job queue)
- Decision: Add if customers request specific send times

**4. Payment Reconciliation Import**
- Customer Request: "Can I import payments from bank CSV?"
- Impact: High (reduces manual payment recording)
- Effort: Medium (parsing + matching logic)
- Decision: Add if manual payment entry becomes bottleneck

**5. Recurring Invoice Templates**
- Customer Request: "Can I create template for monthly invoices?"
- Impact: Medium (saves time for subscription businesses)
- Effort: Low (template system)
- Decision: Add if recurring invoice pattern emerges

### Beta Expansion Strategy

**Customer Acquisition**:
```
Month 1 (January):
- 1 customer (POP Trading) → validate core value
- Collect detailed feedback
- Fix critical issues

Month 2 (February):
- Add 2-3 more beta customers
- Diversify customer profiles (different industries)
- Validate multi-tenant scalability

Month 3 (March):
- Add 5-10 more customers
- Begin charging (if pricing validated)
- Prepare for public launch

Month 4+ (April-June):
- Public launch
- Marketing and growth
- Enterprise features if demand exists
```

**Customer Selection Criteria**:
```
Ideal Beta Customers:
✅ 50-500 invoices per month (sweet spot)
✅ Willing to provide feedback
✅ Not mission-critical (can tolerate occasional bugs)
✅ Different industry than POP Trading (validation)
✅ Based in UAE (cultural fit, time zone)

Avoid Beta Customers:
❌ Highly complex workflows (too many edge cases)
❌ Enterprise requirements (need stability first)
❌ Unwilling to pay eventually (not validating business)
❌ Require 24/7 support (not resourced for this yet)
```

---

## Risk Management

### Known Risks and Mitigation

**Risk 1: API Discovery Reveals Major Issues (Week 1)**
```
Probability: Medium
Impact: High
Mitigation:
- Allocate extra buffer in Week 1 for fixes
- Have senior developer available for debugging
- Worst case: Extend Week 1-2 to 3 weeks (still on track)
```

**Risk 2: E2E Testing Uncovers Integration Bugs (Week 2-3)**
```
Probability: High (expected)
Impact: Medium
Mitigation:
- Budget time for bug fixes in Week 3
- Prioritize P0/P1 bugs only for beta
- P2/P3 can be deferred post-launch
```

**Risk 3: POP Trading UAT Finds Blocking Issues (Week 5)**
```
Probability: Low
Impact: Critical
Mitigation:
- Week 6 buffer for fixes
- Daily monitoring during UAT
- Go/No-Go decision point at Week 5 end
- Can delay launch 1 week if needed (Dec 20 still acceptable)
```

**Risk 4: Multi-Currency Edge Cases (Week 5 UAT)**
```
Probability: Medium
Impact: Medium
Mitigation:
- Thorough testing with POP Trading's real data
- Document any limitations upfront
- Manual workarounds for edge cases if needed
```

**Risk 5: Email Deliverability Issues at Scale (Week 7)**
```
Probability: Low
Impact: High
Mitigation:
- AWS SES already tested and working
- Bounce/complaint handling active
- Monitoring in place to catch early
- Can switch to different email provider if needed
```

---

## Success Criteria Summary

### Week 1 Success: ✅ "Can create invoices via UI"
```
Manual Test:
□ Create 10 invoices manually
□ Import 50 invoices via CSV
□ View invoice list
□ Invoice details page works

API Test:
□ 80%+ of API endpoints returning 200 OK
□ Critical path APIs fully functional
```

### Week 2 Success: ✅ "Can send reminders via UI"
```
Manual Test:
□ Create campaign with 5 invoices
□ Send campaign successfully
□ Verify 5 emails delivered (check AWS SES)
□ Record payment for 1 invoice
□ Check analytics dashboard

E2E Test:
□ Automated test covering invoice → campaign → payment
```

### Week 3 Success: ✅ "Stable core product"
```
Testing:
□ E2E tests passing for all core flows
□ Zero P0 bugs
□ <5 P1 bugs (all documented)

Stability:
□ Settings UI works
□ Sentry error tracking active
□ Uptime monitoring configured
```

### Week 4 Success: ✅ "Ready for POP Trading"
```
Documentation:
□ User guide complete
□ FAQ available
□ Troubleshooting guide ready

Support:
□ GitHub Issues configured
□ Support email working
□ Slack channel created

Onboarding:
□ POP Trading onboarding guide complete
□ Test invoices imported successfully
```

### Week 5 Success: ✅ "Customer validation"
```
Usage:
□ POP Trading using daily
□ 1+ campaign sent with real invoices
□ Payment recording tested
□ Multi-currency validated

Feedback:
□ Feedback collected and documented
□ Go/No-Go decision made
```

### Week 6 Success: ✅ "Launch-ready"
```
Quality:
□ All P0/P1 UAT bugs fixed
□ Security audit passed
□ Performance validated
□ Manual testing complete
```

### Week 7 Success: ✅ "Beta launch successful"
```
Technical:
□ 99%+ uptime
□ 95%+ email delivery
□ <5 bugs in launch week

Customer:
□ POP Trading actively using
□ Positive feedback
□ NPS >8
□ Willing to pay
```

---

## Communication Plan

### Daily Updates (During Implementation)

**Slack/Email Standup Format**:
```
📅 [Date] - Reminder Beta Development Update

✅ Completed Yesterday:
- [List completed tasks]

🔄 In Progress Today:
- [List today's tasks]

⚠️ Blockers:
- [Any impediments]

📊 Progress:
- Week X of 10: [X]% complete
- On track for Dec 13 launch: YES / CONCERN / NO
```

### Weekly Stakeholder Updates

**Friday Email Summary**:
```
Subject: Reminder Beta - Week X Status

Hi team,

Quick weekly update on December beta launch progress:

**This Week's Achievements**:
- [Major milestones]
- [Deliverables completed]

**Challenges Faced**:
- [Any issues encountered]
- [How we resolved them]

**Next Week's Focus**:
- [Week X+1 priorities]

**Launch Status**: ON TRACK / AT RISK / DELAYED
- [Brief explanation if not on track]

**Metrics**:
- Weeks remaining: X
- Completion: X%
- Open P0/P1 bugs: X

Let me know if you have questions!

[Your Name]
```

### User Communication (POP Trading)

**UAT Kickoff Email** (Nov 25):
```
Subject: UAT Starts Next Week - Here's What to Expect

Hi POP Trading team,

We're excited to start UAT on Monday, November 29!

**What We've Prepared**:
- Stable product with all core features
- Dedicated Slack channel for support
- Daily check-ins (15 minutes)
- Onboarding guide customized for your workflow

**What We Need From You**:
- Import your real invoices
- Send reminder campaigns
- Provide honest feedback
- Report any bugs immediately

**Schedule**:
- Monday 10 AM: Kickoff call (1 hour)
- Tuesday-Friday: Real usage with daily check-ins
- Friday 3 PM: Mid-week review (30 minutes)
- Following week: Continued testing

**Support**:
- Slack: #pop-trading-beta (real-time)
- Email: support@usereminder.com

Looking forward to working with you!

[Your Name]
```

---

## Appendix: Quick Reference

### Key Dates
```
Nov 1: Week 1 starts (Discovery + Integration)
Nov 8: Week 2 starts (Core Integration)
Nov 15: Week 3 starts (Testing + Settings)
Nov 22: Week 4 starts (UAT Prep)
Nov 29: Week 5 starts (POP Trading UAT)
Dec 5: Go/No-Go Decision Point
Dec 6: Week 6 starts (Final Polish)
Dec 13: Week 7 - BETA LAUNCH 🚀
Dec 20: Holiday monitoring begins
Jan 2: Resume active development
```

### Critical Paths
```
Week 1-2: Frontend-Backend Integration (CANNOT DELAY)
Week 3: E2E Testing (CAN COMPRESS TO 4 DAYS IF NEEDED)
Week 4: UAT Prep (CAN PARALLEL WITH WEEK 3)
Week 5: UAT with POP Trading (FIXED - CUSTOMER DEPENDENT)
Week 6: Buffer for UAT Fixes (FLEXIBLE)
Week 7: Launch (TARGET DATE: DEC 13-19)
```

### Contact Information
```
Support Email: support@usereminder.com
Slack Channel: #pop-trading-beta (during UAT)
GitHub Issues: github.com/[your-org]/reminder-mvp/issues
Sentry Dashboard: [Your Sentry URL]
Uptime Monitor: [Your BetterStack URL]
```

### Emergency Escalation
```
P0 - Critical (System Down):
- Immediate response required
- Escalate to: [Lead Developer]
- Contact: [Phone/Slack]

P1 - Urgent (Feature Broken):
- 4-hour response
- Escalate to: [Product Owner]

P2-P4 - Normal Process:
- Follow standard GitHub Issues workflow
```

---

**Document Owner**: Product Team
**Last Updated**: [Current Date]
**Review Cadence**: Weekly during implementation
**Status**: READY FOR EXECUTION

