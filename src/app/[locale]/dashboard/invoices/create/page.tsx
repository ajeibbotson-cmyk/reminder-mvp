'use client'

import { useSession } from 'next-auth/react'
import { useTranslations, useLocale } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { InvoiceForm } from '@/components/invoices/invoice-form'
import { UAEErrorBoundary } from '@/components/error-boundaries/uae-error-boundary'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Receipt, ArrowLeft, Save, Send, FileText, Calculator } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

export default function CreateInvoicePage() {
  const { data: session } = useSession()
  const t = useTranslations('invoices')
  const locale = useLocale()
  const router = useRouter()
  const isRTL = locale === 'ar'
  
  const [isCreating, setIsCreating] = useState(false)

  const handleSave = async (data: any) => {
    setIsCreating(true)
    try {
      toast.success(
        locale === 'ar' 
          ? 'تم إنشاء الفاتورة بنجاح' 
          : 'Invoice created successfully'
      )
      
      // Navigate to the invoice list or detail page
      router.push('/dashboard/invoices')
    } catch (error) {
      toast.error(
        locale === 'ar' 
          ? 'فشل في إنشاء الفاتورة' 
          : 'Failed to create invoice'
      )
      console.error('Failed to create invoice:', error)
    } finally {
      setIsCreating(false)
    }
  }

  const handleCancel = () => {
    router.push('/dashboard/invoices')
  }

  if (!session) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <Receipt className="h-8 w-8 animate-spin" />
          <span className="ml-2">{t('loading')}</span>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <UAEErrorBoundary>
        <div className={cn('space-y-6 p-6', isRTL ? 'rtl' : 'ltr')}>
          {/* Page Header */}
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Receipt className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold tracking-tight">
                    {locale === 'ar' ? 'إنشاء فاتورة جديدة' : 'Create New Invoice'}
                  </h1>
                  <p className="text-muted-foreground">
                    {locale === 'ar' 
                      ? 'إنشاء فاتورة جديدة متوافقة مع ضريبة القيمة المضافة في دولة الإمارات'
                      : 'Create a new UAE VAT compliant invoice with auto-calculations'
                    }
                  </p>
                </div>
              </div>
              
              {/* Feature badges */}
              <div className="flex flex-wrap gap-2 mt-3">
                <Badge variant="secondary" className="gap-1">
                  <Calculator className="h-3 w-3" />
                  {locale === 'ar' ? 'حساب تلقائي للضريبة' : 'Auto VAT Calculation'}
                </Badge>
                <Badge variant="secondary" className="gap-1">
                  <Save className="h-3 w-3" />
                  {locale === 'ar' ? 'حفظ تلقائي للمسودة' : 'Auto-save Draft'}
                </Badge>
                <Badge variant="secondary" className="gap-1">
                  <FileText className="h-3 w-3" />
                  {locale === 'ar' ? 'متوافق مع الإمارات' : 'UAE Compliant'}
                </Badge>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                onClick={handleCancel}
                className="gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                {locale === 'ar' ? 'العودة للفواتير' : 'Back to Invoices'}
              </Button>
            </div>
          </div>

          {/* Help Card */}
          <Card className="border-blue-200 bg-blue-50/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2 text-blue-900">
                <FileText className="h-5 w-5" />
                {locale === 'ar' ? 'نصائح إنشاء الفاتورة' : 'Invoice Creation Tips'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div className="space-y-2">
                  <h4 className="font-medium text-blue-900">
                    {locale === 'ar' ? 'ضريبة القيمة المضافة في الإمارات' : 'UAE VAT Requirements'}
                  </h4>
                  <ul className="space-y-1 text-blue-700">
                    <li>• {locale === 'ar' ? 'المعدل القياسي: 5%' : 'Standard rate: 5%'}</li>
                    <li>• {locale === 'ar' ? 'رقم التسجيل الضريبي: 15 رقم' : 'TRN format: 15 digits'}</li>
                    <li>• {locale === 'ar' ? 'العملة الافتراضية: درهم إماراتي' : 'Default currency: AED'}</li>
                  </ul>
                </div>
                <div className="space-y-2">
                  <h4 className="font-medium text-blue-900">
                    {locale === 'ar' ? 'الميزات الذكية' : 'Smart Features'}
                  </h4>
                  <ul className="space-y-1 text-blue-700">
                    <li>• {locale === 'ar' ? 'ترقيم تلقائي للفواتير' : 'Auto invoice numbering'}</li>
                    <li>• {locale === 'ar' ? 'حفظ تلقائي كل دقيقتين' : 'Auto-save every 2 minutes'}</li>
                    <li>• {locale === 'ar' ? 'حساب تلقائي للإجماليات' : 'Real-time total calculations'}</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Invoice Form */}
          <InvoiceForm
            onSave={handleSave}
            onCancel={handleCancel}
            locale={locale}
            companyId={session.user.companyId}
            enableAutoSave={true}
          />
        </div>
      </UAEErrorBoundary>
    </DashboardLayout>
  )
}