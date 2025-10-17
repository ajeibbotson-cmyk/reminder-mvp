import { useState, useEffect } from 'react'

export interface EmailTemplate {
  id: string
  name: string
  description: string | null
  template_type: string
  subject_en: string
  subject_ar: string | null
  content_en: string
  content_ar: string | null
  variables: Record<string, string> | null
  version: number
  is_active: boolean
  is_default: boolean
  supports_consolidation: boolean
  max_invoice_count: number
  uae_business_hours_only: boolean
  created_at: string
  updated_at: string
}

export interface UseEmailTemplatesReturn {
  templates: EmailTemplate[]
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
}

export function useEmailTemplates(
  templateType?: string,
  activeOnly: boolean = true
): UseEmailTemplatesReturn {
  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchTemplates = async () => {
    try {
      setLoading(true)
      setError(null)

      const params = new URLSearchParams()
      if (templateType) {
        params.append('type', templateType)
      }
      if (!activeOnly) {
        params.append('active', 'false')
      }

      const url = `/api/templates${params.toString() ? `?${params.toString()}` : ''}`
      const response = await fetch(url)

      if (!response.ok) {
        throw new Error('Failed to fetch templates')
      }

      const data = await response.json()
      setTemplates(data.templates || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
      setTemplates([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTemplates()
  }, [templateType, activeOnly])

  return {
    templates,
    loading,
    error,
    refetch: fetchTemplates,
  }
}
