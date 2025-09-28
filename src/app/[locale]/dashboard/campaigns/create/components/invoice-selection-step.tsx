'use client'

import { useState, useMemo } from 'react'
import { useCampaignStore } from '@/lib/stores/campaign-store'
import { useInvoices } from '@/lib/api/hooks'

export function InvoiceSelectionStep() {
  const {
    formData,
    errors,
    invoiceSearchQuery,
    invoiceSelectionPage,
    setInvoiceSearchQuery,
    setInvoiceSelectionPage,
    toggleInvoiceSelection,
    clearInvoiceSelection,
    setError
  } = useCampaignStore()

  const [statusFilter, setStatusFilter] = useState<string>('all')
  const itemsPerPage = 10

  // Fetch invoices with search and pagination
  const {
    data: invoicesData,
    isLoading,
    error: invoicesError
  } = useInvoices({
    search: invoiceSearchQuery,
    status: statusFilter === 'all' ? undefined : statusFilter,
    page: invoiceSelectionPage,
    limit: itemsPerPage
  })

  const invoices = invoicesData?.invoices || []
  const totalInvoices = invoicesData?.total || 0
  const totalPages = Math.ceil(totalInvoices / itemsPerPage)

  // Calculate selection statistics
  const selectionStats = useMemo(() => {
    const selectedCount = formData.selectedInvoiceIds.length
    const selectedInvoices = invoices.filter(inv =>
      formData.selectedInvoiceIds.includes(inv.id)
    )
    const totalAmount = selectedInvoices.reduce((sum, inv) => sum + inv.amount, 0)

    return {
      count: selectedCount,
      totalAmount
    }
  }, [formData.selectedInvoiceIds, invoices])

  const handleSearch = (query: string) => {
    setInvoiceSearchQuery(query)
    // Clear error when user searches
    if (errors.invoices) {
      setError('invoices', '')
    }
  }

  const handleSelectAll = () => {
    const currentPageInvoiceIds = invoices.map(inv => inv.id)
    const allSelected = currentPageInvoiceIds.every(id =>
      formData.selectedInvoiceIds.includes(id)
    )

    if (allSelected) {
      // Deselect all on current page
      currentPageInvoiceIds.forEach(id => {
        if (formData.selectedInvoiceIds.includes(id)) {
          toggleInvoiceSelection(id)
        }
      })
    } else {
      // Select all on current page
      currentPageInvoiceIds.forEach(id => {
        if (!formData.selectedInvoiceIds.includes(id)) {
          toggleInvoiceSelection(id)
        }
      })
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-AE', {
      style: 'currency',
      currency: 'AED',
      minimumFractionDigits: 2
    }).format(amount)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-AE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  if (invoicesError) {
    return (
      <div className="text-center py-8">
        <div className="text-red-600 mb-4">
          <svg className="w-12 h-12 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Failed to load invoices
        </div>
        <p className="text-gray-600 mb-4">
          There was an error loading your invoices. Please try refreshing the page.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          Refresh Page
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">
          Select Invoices
        </h3>
        <p className="text-sm text-gray-600 mb-6">
          Choose the invoices you want to include in this campaign.
        </p>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        {/* Search */}
        <div className="flex-1">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              placeholder="Search by invoice number or customer name..."
              value={invoiceSearchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Status Filter */}
        <div className="w-full sm:w-48">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">All Statuses</option>
            <option value="SENT">Sent</option>
            <option value="OVERDUE">Overdue</option>
            <option value="DRAFT">Draft</option>
          </select>
        </div>
      </div>

      {/* Selection Summary */}
      {selectionStats.count > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-blue-800">
                {selectionStats.count} invoice{selectionStats.count !== 1 ? 's' : ''} selected
              </p>
              <p className="text-sm text-blue-600">
                Total amount: {formatCurrency(selectionStats.totalAmount)}
              </p>
            </div>
            <button
              onClick={clearInvoiceSelection}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              Clear all
            </button>
          </div>
        </div>
      )}

      {/* Error Display */}
      {errors.invoices && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <p className="text-sm text-red-700">{errors.invoices}</p>
        </div>
      )}

      {/* Loading State */}
      {isLoading ? (
        <div className="text-center py-8">
          <div className="inline-block w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="mt-2 text-gray-600">Loading invoices...</p>
        </div>
      ) : (
        <>
          {/* Invoice List */}
          {invoices.length > 0 ? (
            <div className="space-y-4">
              {/* Select All */}
              <div className="flex items-center justify-between border-b border-gray-200 pb-2">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="selectAll"
                    checked={invoices.length > 0 && invoices.every(inv =>
                      formData.selectedInvoiceIds.includes(inv.id)
                    )}
                    onChange={handleSelectAll}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <label htmlFor="selectAll" className="ml-2 text-sm font-medium text-gray-700">
                    Select all on this page
                  </label>
                </div>
                <p className="text-sm text-gray-500">
                  Showing {invoices.length} of {totalInvoices} invoices
                </p>
              </div>

              {/* Invoice Items */}
              <div className="space-y-2">
                {invoices.map((invoice) => (
                  <div
                    key={invoice.id}
                    className={`
                      border rounded-lg p-4 cursor-pointer transition-colors
                      ${formData.selectedInvoiceIds.includes(invoice.id)
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                      }
                    `}
                    onClick={() => toggleInvoiceSelection(invoice.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <input
                          type="checkbox"
                          checked={formData.selectedInvoiceIds.includes(invoice.id)}
                          onChange={() => {}} // Handled by onClick above
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <div>
                          <p className="font-medium text-gray-900">
                            #{invoice.number}
                          </p>
                          <p className="text-sm text-gray-600">
                            {invoice.customerName}
                          </p>
                        </div>
                      </div>

                      <div className="text-right">
                        <p className="font-medium text-gray-900">
                          {formatCurrency(invoice.amount)}
                        </p>
                        <p className="text-sm text-gray-600">
                          Due: {formatDate(invoice.dueDate)}
                        </p>
                      </div>

                      <div>
                        <span className={`
                          inline-flex px-2 py-1 text-xs font-medium rounded-full
                          ${invoice.status === 'OVERDUE'
                            ? 'bg-red-100 text-red-800'
                            : invoice.status === 'SENT'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-gray-100 text-gray-800'
                          }
                        `}>
                          {invoice.status}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between border-t border-gray-200 pt-4">
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setInvoiceSelectionPage(Math.max(1, invoiceSelectionPage - 1))}
                      disabled={invoiceSelectionPage === 1}
                      className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Previous
                    </button>
                    <span className="text-sm text-gray-600">
                      Page {invoiceSelectionPage} of {totalPages}
                    </span>
                    <button
                      onClick={() => setInvoiceSelectionPage(Math.min(totalPages, invoiceSelectionPage + 1))}
                      disabled={invoiceSelectionPage === totalPages}
                      className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Next
                    </button>
                  </div>

                  <div className="text-sm text-gray-600">
                    {selectionStats.count} selected
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Empty State */
            <div className="text-center py-8">
              <svg className="w-12 h-12 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-gray-600 mb-2">
                No invoices found
              </p>
              <p className="text-sm text-gray-500">
                {invoiceSearchQuery ? 'Try adjusting your search criteria' : 'You don\'t have any invoices yet'}
              </p>
            </div>
          )}
        </>
      )}
    </div>
  )
}