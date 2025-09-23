// Export all stores for easy access
export { useInvoiceStore } from './invoice-store'
export { useCustomerStore } from './customer-store'
export { useFollowUpSequenceStore } from './follow-up-store'
export { useUserStore } from './user-store'
export { useActivityStore } from './activity-store'

// Week 2 Enhancement: New stores
// export { useImportBatchStore } from './import-batch-store' // Temporarily disabled
export { useEmailTemplateStore } from './email-template-store'
// export { useEmailDeliveryStore } from './email-delivery-store' // Temporarily disabled

// Customer Consolidation Feature
export {
  useConsolidationStore,
  useConsolidationQueue,
  useConsolidationAnalytics,
  useConsolidationEmail,
  useConsolidationCandidates,
  useConsolidationMetrics,
  useConsolidationActions
} from './consolidation-store'

// Export utility functions
// export { importBatchUtils } from './import-batch-store' // Temporarily disabled
export { emailTemplateUtils } from './email-template-store'
// export { emailDeliveryUtils } from './email-delivery-store' // Temporarily disabled
export { consolidationStoreUtils } from './consolidation-store'

// Export types
export type * from '../types/store'
export type * from '../types/consolidation'
export type * from '../types/consolidation-ui'