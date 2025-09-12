import { 
  Invoice, 
  Customer, 
  FollowUpSequence, 
  User, 
  Company, 
  InvoiceStatus,
  Payment,
  Activity 
} from '@prisma/client'

// Extended types for store usage
export type InvoiceWithDetails = Invoice & {
  customer: Customer
  company: Company
  payments: Payment[]
}

export type CustomerWithInvoices = Customer & {
  invoices: Invoice[]
}

export type UserWithCompany = User & {
  company: Company
}

// Store states
export interface InvoiceState {
  invoices: InvoiceWithDetails[]
  loading: boolean
  error: string | null
  totalCount: number
  
  // Actions
  fetchInvoices: (companyId: string, filters?: InvoiceFilters) => Promise<void>
  addInvoice: (invoice: Omit<Invoice, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Invoice>
  updateInvoice: (id: string, updates: Partial<Invoice>) => Promise<void>
  updateInvoiceStatus: (id: string, status: InvoiceStatus) => Promise<void>
  deleteInvoice: (id: string) => Promise<void>
  getInvoiceById: (id: string) => InvoiceWithDetails | null
  clearError: () => void
}

export interface CustomerState {
  customers: CustomerWithInvoices[]
  loading: boolean
  error: string | null
  totalCount: number
  
  // Actions
  fetchCustomers: (companyId: string) => Promise<void>
  addCustomer: (customer: Omit<Customer, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Customer>
  updateCustomer: (id: string, updates: Partial<Customer>) => Promise<void>
  deleteCustomer: (id: string) => Promise<void>
  getCustomerById: (id: string) => CustomerWithInvoices | null
  getCustomerByEmail: (email: string) => CustomerWithInvoices | null
  clearError: () => void
}

export interface FollowUpSequenceState {
  sequences: FollowUpSequence[]
  loading: boolean
  error: string | null
  
  // Actions
  fetchSequences: (companyId: string) => Promise<void>
  addSequence: (sequence: Omit<FollowUpSequence, 'id' | 'createdAt' | 'updatedAt'>) => Promise<FollowUpSequence>
  updateSequence: (id: string, updates: Partial<FollowUpSequence>) => Promise<void>
  deleteSequence: (id: string) => Promise<void>
  toggleSequenceActive: (id: string) => Promise<void>
  clearError: () => void
}

export interface UserState {
  currentUser: UserWithCompany | null
  loading: boolean
  error: string | null
  
  // Actions
  fetchCurrentUser: () => Promise<void>
  updateProfile: (updates: Partial<User>) => Promise<void>
  clearError: () => void
}

export interface ActivityState {
  activities: Activity[]
  loading: boolean
  error: string | null
  
  // Actions
  fetchActivities: (companyId: string, limit?: number) => Promise<void>
  logActivity: (activity: Omit<Activity, 'id' | 'createdAt'>) => Promise<void>
  clearError: () => void
}

// Filter and pagination types
export interface InvoiceFilters {
  status?: InvoiceStatus
  customerEmail?: string
  startDate?: Date
  endDate?: Date
  minAmount?: number
  maxAmount?: number
  search?: string
  page?: number
  limit?: number
}

export interface PaginationResult<T> {
  data: T[]
  totalCount: number
  page: number
  limit: number
  hasMore: boolean
}

// API response types
export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

export interface ApiError {
  message: string
  code?: string
  field?: string
}