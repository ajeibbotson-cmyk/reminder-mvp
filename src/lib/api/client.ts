import {
  ApiResponse,
  ApiError,
  Campaign,
  CampaignsListResponse,
  CampaignsQueryParams,
  CreateCampaignRequest,
  CreateCampaignResponse,
  SendCampaignRequest,
  SendCampaignResponse,
  Invoice
} from './types'

class ApiClient {
  private baseUrl: string

  constructor(baseUrl = '/api') {
    this.baseUrl = baseUrl
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`

    const config: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    }

    try {
      const response = await fetch(url, config)

      // Handle different response types
      const contentType = response.headers.get('content-type')
      let data: any

      if (contentType?.includes('application/json')) {
        data = await response.json()
      } else {
        data = await response.text()
      }

      // Handle HTTP errors
      if (!response.ok) {
        const error: ApiError = {
          error: data.error || data.message || `HTTP ${response.status}`,
          code: data.code,
          details: data.details,
          retryable: response.status >= 500 || response.status === 429,
          suggestions: data.suggestions
        }
        throw error
      }

      return data
    } catch (error) {
      // Network errors or JSON parsing errors
      if (error instanceof TypeError) {
        throw {
          error: 'Network error - please check your connection',
          retryable: true
        } as ApiError
      }

      // Re-throw API errors
      throw error
    }
  }

  // Campaign API methods
  async getCampaigns(params?: CampaignsQueryParams): Promise<CampaignsListResponse> {
    const searchParams = new URLSearchParams()

    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          searchParams.append(key, value.toString())
        }
      })
    }

    const endpoint = `/campaigns${searchParams.toString() ? `?${searchParams.toString()}` : ''}`
    return this.request<CampaignsListResponse>(endpoint)
  }

  async getCampaign(id: string): Promise<{ campaign: Campaign }> {
    return this.request<{ campaign: Campaign }>(`/campaigns/${id}`)
  }

  async createCampaign(data: CreateCampaignRequest): Promise<CreateCampaignResponse> {
    return this.request<CreateCampaignResponse>('/campaigns/from-invoices', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async sendCampaign(id: string, data: SendCampaignRequest): Promise<SendCampaignResponse> {
    return this.request<SendCampaignResponse>(`/campaigns/${id}/send`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  // Invoice API methods (for campaign creation)
  async getInvoices(params?: {
    search?: string
    status?: string
    page?: number
    limit?: number
  }): Promise<{ invoices: Invoice[], total: number }> {
    const searchParams = new URLSearchParams()

    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          searchParams.append(key, value.toString())
        }
      })
    }

    const endpoint = `/invoices${searchParams.toString() ? `?${searchParams.toString()}` : ''}`
    return this.request<{ invoices: Invoice[], total: number }>(endpoint)
  }

  // Server-Sent Events helper (not a regular API call)
  createProgressStream(campaignId: string): EventSource {
    const url = `${this.baseUrl}/campaigns/${campaignId}/progress`
    return new EventSource(url)
  }
}

// Export singleton instance
export const apiClient = new ApiClient()

// Export class for testing
export { ApiClient }

// Helper function for handling API errors in components
export function handleApiError(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'error' in error) {
    const apiError = error as ApiError
    return apiError.error
  }

  if (error instanceof Error) {
    return error.message
  }

  return 'An unexpected error occurred'
}

// Helper function to check if error is retryable
export function isRetryableError(error: unknown): boolean {
  if (typeof error === 'object' && error !== null && 'retryable' in error) {
    const apiError = error as ApiError
    return apiError.retryable === true
  }
  return false
}