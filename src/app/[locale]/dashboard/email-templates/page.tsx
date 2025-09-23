'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { 
  Mail, 
  Plus, 
  Edit, 
  Eye, 
  Copy, 
  Trash2, 
  Search,
  Filter,
  Download,
  Send,
  Languages,
  Star,
  Clock,
  BarChart3,
  Library,
  Sparkles,
  TrendingUp,
  Users,
  Target,
  Zap,
  Heart,
  Globe,
  Bookmark,
  Settings,
  AlertCircle
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { TemplateEditor } from '@/components/email/template-editor'
import { TemplatePreview } from '@/components/email/template-preview'
import { TemplateBuilder } from '@/components/email-templates/template-builder'
import { TemplateLibrary } from '@/components/email-templates/template-library'
import { TemplatePreview as EnhancedTemplatePreview } from '@/components/email-templates/template-preview'
import { TemplateVariables } from '@/components/email-templates/template-variables'
import { useEmailTemplateStore, emailTemplateUtils } from '@/lib/stores/email-template-store'
import { UAEErrorBoundary } from '@/components/error-boundaries/uae-error-boundary'
import { cn } from '@/lib/utils'

export default function EmailTemplatesPage() {
  const { data: session } = useSession()
  const t = useTranslations('emailTemplates')
  const router = useRouter()
  
  const [activeTab, setActiveTab] = useState('dashboard')
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [consolidationFilter, setConsolidationFilter] = useState('all')
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null)
  const [showEditor, setShowEditor] = useState(false)
  const [showBuilder, setShowBuilder] = useState(false)
  const [showLibrary, setShowLibrary] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [showVariables, setShowVariables] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')

  const { 
    templates, 
    fetchTemplates, 
    createTemplate, 
    updateTemplate, 
    deleteTemplate,
    duplicateTemplate,
    setAsDefault,
    isLoading, 
    error 
  } = useEmailTemplateStore()

  useEffect(() => {
    if (session?.user?.companyId) {
      fetchTemplates(session.user.companyId)
    }
  }, [session?.user?.companyId, fetchTemplates])

  const filteredTemplates = templates.filter(template => {
    const matchesSearch = template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         template.description?.toLowerCase().includes(searchQuery.toLowerCase())

    const matchesStatus = statusFilter === 'all' ||
                         (statusFilter === 'active' && template.isActive) ||
                         (statusFilter === 'inactive' && !template.isActive)

    const matchesType = typeFilter === 'all' || template.templateType === typeFilter

    const matchesCategory = categoryFilter === 'all' || template.category === categoryFilter

    const matchesConsolidation = consolidationFilter === 'all' ||
                                (consolidationFilter === 'supported' && template.supportsConsolidation) ||
                                (consolidationFilter === 'individual' && !template.supportsConsolidation)

    return matchesSearch && matchesStatus && matchesType && matchesCategory && matchesConsolidation
  })

  const templateTypes = [
    { value: 'INVOICE_REMINDER', label: t('types.invoiceReminder') },
    { value: 'PAYMENT_REQUEST', label: t('types.paymentRequest') },
    { value: 'OVERDUE_NOTICE', label: t('types.overdueNotice') },
    { value: 'PAYMENT_CONFIRMATION', label: t('types.paymentConfirmation') },
    { value: 'CONSOLIDATED_REMINDER', label: t('types.consolidatedReminder') },
    { value: 'FIRM_CONSOLIDATED_REMINDER', label: t('types.firmConsolidatedReminder') },
    { value: 'URGENT_CONSOLIDATED_REMINDER', label: t('types.urgentConsolidatedReminder') },
    { value: 'CUSTOM', label: t('types.custom') }
  ]

  const templateCategories = [
    { value: 'GENTLE_REMINDER', label: t('categories.gentleReminder'), icon: '💌', color: 'blue' },
    { value: 'PROFESSIONAL_FOLLOWUP', label: t('categories.professionalFollowup'), icon: '📋', color: 'orange' },
    { value: 'FIRM_NOTICE', label: t('categories.firmNotice'), icon: '⚠️', color: 'red' },
    { value: 'FINAL_NOTICE', label: t('categories.finalNotice'), icon: '🔔', color: 'purple' },
    { value: 'CONSOLIDATED_BILLING', label: t('categories.consolidatedBilling'), icon: '📊', color: 'teal' },
    { value: 'MULTI_INVOICE_REMINDER', label: t('categories.multiInvoiceReminder'), icon: '📋', color: 'indigo' },
    { value: 'BULK_PAYMENT_REQUEST', label: t('categories.bulkPaymentRequest'), icon: '💰', color: 'amber' },
    { value: 'WELCOME_SERIES', label: t('categories.welcomeSeries'), icon: '🤝', color: 'green' },
    { value: 'PAYMENT_CONFIRMATION', label: t('categories.paymentConfirmation'), icon: '✅', color: 'emerald' },
    { value: 'CUSTOM', label: t('categories.custom'), icon: '🎨', color: 'gray' }
  ]

  const handleCreateTemplate = () => {
    setEditingTemplate(null)
    setShowBuilder(true)
  }

  const handleCreateFromLibrary = () => {
    setShowLibrary(true)
  }

  const handleShowVariables = () => {
    setShowVariables(true)
  }

  const handleEditTemplate = (template: any) => {
    setSelectedTemplate(template)
    setEditingTemplate(template.id)
    setShowBuilder(true)
  }

  const handlePreviewTemplate = (template: any) => {
    setSelectedTemplate(template)
    setShowPreview(true)
  }

  const handleImportFromLibrary = async (libraryTemplate: any) => {
    try {
      const templateData = {
        companyId: session?.user?.companyId,
        name: libraryTemplate.nameEn,
        description: libraryTemplate.descriptionEn,
        category: libraryTemplate.category || 'CUSTOM',
        subjectEn: libraryTemplate.subjectEn,
        subjectAr: libraryTemplate.subjectAr,
        contentEn: libraryTemplate.bodyEn,
        contentAr: libraryTemplate.bodyAr,
        isActive: true,
        isDefault: false,
        uaeBusinessHoursOnly: true,
        createdBy: session?.user?.id
      }
      
      await createTemplate(templateData)
      if (session?.user?.companyId) {
        fetchTemplates(session.user.companyId)
      }
      setShowLibrary(false)
    } catch (error) {
      console.error('Failed to import template:', error)
    }
  }

  const handleDuplicateTemplate = async (template: any) => {
    try {
      await duplicateTemplate(template.id, `${template.name} (Copy)`)
      // Refresh templates
      if (session?.user?.companyId) {
        fetchTemplates(session.user.companyId)
      }
    } catch (error) {
      console.error('Failed to duplicate template:', error)
    }
  }

  const handleDeleteTemplate = async (templateId: string) => {
    if (confirm(t('confirmDelete'))) {
      try {
        await deleteTemplate(templateId)
        // Refresh templates
        if (session?.user?.companyId) {
          fetchTemplates(session.user.companyId)
        }
      } catch (error) {
        console.error('Failed to delete template:', error)
      }
    }
  }

  const handleSetDefault = async (template: any) => {
    try {
      await setAsDefault(template.id, template.templateType)
      // Refresh templates
      if (session?.user?.companyId) {
        fetchTemplates(session.user.companyId)
      }
    } catch (error) {
      console.error('Failed to set default template:', error)
    }
  }

  const handleTemplateSave = async () => {
    setShowEditor(false)
    setShowBuilder(false)
    setEditingTemplate(null)
    
    // Refresh templates
    if (session?.user?.companyId) {
      fetchTemplates(session.user.companyId)
    }
  }

  const getTemplateTypeInfo = (type: string) => {
    return emailTemplateUtils.getTemplateTypeInfo(type as any)
  }

  const getTemplateStats = () => {
    const categoryStats = templateCategories.reduce((acc, category) => {
      acc[category.value] = templates.filter(t => t.category === category.value).length
      return acc
    }, {} as Record<string, number>)

    const consolidationSupported = templates.filter(t => t.supportsConsolidation).length
    const maxInvoiceCountAvg = templates
      .filter(t => t.supportsConsolidation)
      .reduce((sum, t) => sum + (t.maxInvoiceCount || 1), 0) / Math.max(consolidationSupported, 1)

    return {
      total: templates.length,
      active: templates.filter(t => t.isActive).length,
      inactive: templates.filter(t => !t.isActive).length,
      default: templates.filter(t => t.isDefault).length,
      consolidationSupported,
      consolidationPercentage: templates.length > 0 ? (consolidationSupported / templates.length) * 100 : 0,
      maxInvoiceCountAvg: Math.round(maxInvoiceCountAvg),
      byCategory: categoryStats,
      mostUsed: templates.sort((a, b) => (b.emailLogs?.length || 0) - (a.emailLogs?.length || 0))[0],
      recentlyUpdated: templates.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()).slice(0, 3)
    }
  }

  const stats = getTemplateStats()

  if (!session) {
    return (
      <div className="flex items-center justify-center h-96">
        <Mail className="h-8 w-8 animate-spin" />
        <span className="ml-2">{t('loading')}</span>
      </div>
    )
  }

  return (
    <UAEErrorBoundary>
      <div className="container mx-auto px-4 py-8 space-y-8">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Mail className="h-8 w-8" />
              {t('pageTitle')}
            </h1>
            <p className="text-gray-600 mt-2">{t('pageDescription')}</p>
          </div>
          
          <div className="flex items-center gap-4">
            <Button variant="outline" onClick={() => router.push('/dashboard')}>
              {t('backToDashboard')}
            </Button>
            
            <Button onClick={handleCreateTemplate}>
              <Plus className="h-4 w-4 mr-2" />
              {t('createTemplate')}
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('stats.total')}</CardTitle>
              <Mail className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('stats.active')}</CardTitle>
              <Eye className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.active}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('stats.consolidation')}</CardTitle>
              <TrendingUp className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{stats.consolidationSupported}</div>
              <p className="text-xs text-muted-foreground">
                {Math.round(stats.consolidationPercentage)}% of templates
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('stats.default')}</CardTitle>
              <Star className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{stats.default}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('stats.inactive')}</CardTitle>
              <Clock className="h-4 w-4 text-gray-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-600">{stats.inactive}</div>
            </CardContent>
          </Card>
        </div>

        {/* Filters and Search */}
        <Card>
          <CardHeader>
            <CardTitle>{t('filters.title')}</CardTitle>
            <CardDescription>{t('filters.description')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <Search className="h-4 w-4" />
                <Input
                  placeholder={t('searchPlaceholder')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-64"
                />
              </div>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('filters.allStatuses')}</SelectItem>
                  <SelectItem value="active">{t('filters.active')}</SelectItem>
                  <SelectItem value="inactive">{t('filters.inactive')}</SelectItem>
                </SelectContent>
              </Select>

              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('filters.allTypes')}</SelectItem>
                  {templateTypes.map(type => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={consolidationFilter} onValueChange={setConsolidationFilter}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('filters.allConsolidation')}</SelectItem>
                  <SelectItem value="supported">{t('filters.consolidationSupported')}</SelectItem>
                  <SelectItem value="individual">{t('filters.individualOnly')}</SelectItem>
                </SelectContent>
              </Select>

              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Filter className="h-4 w-4" />
                {t('showingResults', { count: filteredTemplates.length, total: templates.length })}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Templates List */}
        <Card>
          <CardHeader>
            <CardTitle>{t('templatesList')}</CardTitle>
            <CardDescription>{t('templatesListDescription')}</CardDescription>
          </CardHeader>
          <CardContent>
            {filteredTemplates.length > 0 ? (
              <div className="space-y-4">
                {filteredTemplates.map((template) => {
                  const typeInfo = getTemplateTypeInfo(template.templateType)
                  const hasArabic = emailTemplateUtils.hasArabicContent(template)
                  
                  return (
                    <div
                      key={template.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center gap-4 flex-1">
                        <div className="text-2xl">{typeInfo.icon}</div>
                        
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold">{template.name}</h3>
                            {template.isDefault && (
                              <Badge variant="default">
                                <Star className="h-3 w-3 mr-1" />
                                {t('default')}
                              </Badge>
                            )}
                            {template.isActive ? (
                              <Badge variant="outline" className="text-green-600 border-green-600">
                                {t('active')}
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-gray-600">
                                {t('inactive')}
                              </Badge>
                            )}
                            {hasArabic && (
                              <Badge variant="outline">
                                <Languages className="h-3 w-3 mr-1" />
                                {t('bilingual')}
                              </Badge>
                            )}
                            {template.supportsConsolidation && (
                              <Badge variant="outline" className="text-blue-600 border-blue-600">
                                <TrendingUp className="h-3 w-3 mr-1" />
                                {t('consolidation')} ({template.maxInvoiceCount || 1})
                              </Badge>
                            )}
                          </div>
                          
                          <p className="text-sm text-gray-600 mt-1">
                            {template.description || typeInfo.description}
                          </p>
                          
                          <div className="flex items-center gap-4 text-xs text-gray-500 mt-2">
                            <span>{t('type')}: {typeInfo.label}</span>
                            <span>{t('updated')}: {new Date(template.updatedAt).toLocaleDateString('en-AE')}</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handlePreviewTemplate(template)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditTemplate(template)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDuplicateTemplate(template)}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        
                        {!template.isDefault && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleSetDefault(template)}
                          >
                            <Star className="h-4 w-4" />
                          </Button>
                        )}
                        
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteTemplate(template.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="text-center py-12">
                <Mail className="h-16 w-16 mx-auto mb-4 text-gray-400" />
                <h3 className="text-lg font-semibold mb-2">{t('noTemplatesFound')}</h3>
                <p className="text-gray-600 mb-4">{t('noTemplatesFoundDescription')}</p>
                <Button onClick={handleCreateTemplate}>
                  <Plus className="h-4 w-4 mr-2" />
                  {t('createFirstTemplate')}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Template Editor Dialog */}
        <Dialog open={showEditor} onOpenChange={setShowEditor}>
          <DialogContent className="max-w-7xl h-[95vh]">
            <DialogHeader>
              <DialogTitle>
                {editingTemplate ? t('editTemplate') : t('createTemplate')}
              </DialogTitle>
              <DialogDescription>
                {t('templateEditorDescription')}
              </DialogDescription>
            </DialogHeader>
            
            <div className="flex-1 overflow-hidden">
              <TemplateEditor
                templateId={editingTemplate || undefined}
                onSave={handleTemplateSave}
                onCancel={() => setShowEditor(false)}
                locale="en"
              />
            </div>
          </DialogContent>
        </Dialog>

        {/* Template Preview Dialog */}
        <Dialog open={showPreview} onOpenChange={setShowPreview}>
          <DialogContent className="max-w-6xl h-[90vh]">
            <DialogHeader>
              <DialogTitle>
                {t('templatePreview')} - {selectedTemplate?.name}
              </DialogTitle>
              <DialogDescription>
                {t('previewDescription')}
              </DialogDescription>
            </DialogHeader>
            
            <div className="flex-1 overflow-auto">
              {selectedTemplate && (
                <TemplatePreview
                  template={selectedTemplate}
                  onSendTest={async (email, language) => {
                    console.log('Sending test email to:', email, 'in language:', language)
                  }}
                  onExport={(format) => {
                    console.log('Exporting template as:', format)
                  }}
                  locale="en"
                />
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </UAEErrorBoundary>
  )
}