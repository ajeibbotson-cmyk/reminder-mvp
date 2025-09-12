'use client'

import { useState, useEffect } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { useCustomerStore } from '@/lib/stores/customer-store'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { LoadingOverlay, LoadingSpinner } from '@/components/ui/loading-spinner'
import { CustomerTableSkeleton } from '@/components/ui/skeleton'
import { 
  AEDAmount, 
  TRNDisplay, 
  UAEPhoneDisplay,
  BusinessTypeDisplay
} from '@/components/ui/uae-formatters'
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { 
  Search, 
  Plus, 
  FileDown, 
  Filter,
  Eye,
  Edit,
  Trash2,
  MoreHorizontal,
  Building,
  Mail,
  Phone
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { toast } from 'sonner'

interface CustomerTableProps {
  companyId: string
}

export function CustomerTable({ companyId }: CustomerTableProps) {
  const t = useTranslations()
  const locale = useLocale()
  const isRTL = locale === 'ar'
  
  const { 
    customers, 
    loading, 
    error, 
    totalCount,
    fetchCustomers,
    deleteCustomer,
    clearError
  } = useCustomerStore()

  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    if (companyId) {
      fetchCustomers(companyId).catch((err) => {
        toast.error('Failed to load customers')
        console.error('Failed to fetch customers:', err)
      })
    }
  }, [companyId, fetchCustomers])

  const handleDeleteCustomer = async (customerId: string) => {
    if (!confirm(locale === 'ar' 
      ? 'هل أنت متأكد من حذف هذا العميل؟' 
      : 'Are you sure you want to delete this customer?'
    )) return

    try {
      await deleteCustomer(customerId)
      toast.success(locale === 'ar' ? 'تم حذف العميل بنجاح' : 'Customer deleted successfully')
    } catch (error) {
      toast.error(locale === 'ar' ? 'فشل في حذف العميل' : 'Failed to delete customer')
      console.error('Failed to delete customer:', error)
    }
  }

  const filteredCustomers = customers.filter(customer => {
    return !searchQuery || 
      customer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      customer.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      customer.trn?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      customer.phone?.includes(searchQuery)
  })

  // Calculate total outstanding for each customer
  const getCustomerOutstanding = (customer: any) => {
    return customer.invoices?.reduce((total: number, invoice: any) => {
      return invoice.status !== 'PAID' ? total + invoice.amount : total
    }, 0) || 0
  }

  if (error) {
    return (
      <Card className="p-6">
        <div className="text-center space-y-4">
          <div className="text-red-600 font-medium">
            {locale === 'ar' ? 'حدث خطأ في تحميل العملاء' : 'Error loading customers'}
          </div>
          <Button onClick={() => {
            clearError()
            fetchCustomers(companyId)
          }} variant="outline">
            {locale === 'ar' ? 'حاول مرة أخرى' : 'Try Again'}
          </Button>
        </div>
      </Card>
    )
  }

  return (
    <div className={`space-y-6 ${isRTL ? 'rtl' : 'ltr'}`}>
      {/* Header Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold">
            {t('navigation.customers')}
          </h2>
          <p className="text-muted-foreground">
            {locale === 'ar' 
              ? `${totalCount} عميل إجمالي`
              : `${totalCount} total customers`
            }
          </p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-2">
          <Button variant="outline" className="flex items-center gap-2">
            <FileDown className="h-4 w-4" />
            {locale === 'ar' ? 'تصدير' : 'Export'}
          </Button>
          <Button className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            {locale === 'ar' ? 'إضافة عميل' : 'Add Customer'}
          </Button>
        </div>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className={`h-4 w-4 absolute top-3 text-muted-foreground ${isRTL ? 'right-3' : 'left-3'}`} />
            <Input
              placeholder={locale === 'ar' ? 'البحث في العملاء...' : 'Search customers...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`${isRTL ? 'pr-10' : 'pl-10'}`}
            />
          </div>
        </CardContent>
      </Card>

      {/* Customer Table */}
      <Card>
        <LoadingOverlay 
          isLoading={loading} 
          text={locale === 'ar' ? 'جاري تحميل العملاء...' : 'Loading customers...'}
        >
          {loading ? (
            <div className="p-6">
              <CustomerTableSkeleton />
            </div>
          ) : filteredCustomers.length === 0 ? (
            <div className="p-12 text-center space-y-4">
              <div className="text-6xl mb-4">👥</div>
              <h3 className="text-lg font-medium">
                {searchQuery 
                  ? (locale === 'ar' ? 'لا يوجد عملاء مطابقون' : 'No matching customers')
                  : (locale === 'ar' ? 'لا يوجد عملاء بعد' : 'No customers yet')
                }
              </h3>
              <p className="text-muted-foreground">
                {searchQuery
                  ? (locale === 'ar' ? 'جرب تعديل البحث' : 'Try adjusting your search')
                  : (locale === 'ar' ? 'أضف أول عميل لك للبدء' : 'Add your first customer to get started')
                }
              </p>
              {!searchQuery && (
                <Button className="mt-4">
                  <Plus className="h-4 w-4 mr-2" />
                  {locale === 'ar' ? 'إضافة عميل' : 'Add Customer'}
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className={isRTL ? 'text-right' : 'text-left'}>
                    {locale === 'ar' ? 'العميل' : 'Customer'}
                  </TableHead>
                  <TableHead className={isRTL ? 'text-right' : 'text-left'}>
                    {locale === 'ar' ? 'معلومات الاتصال' : 'Contact Info'}
                  </TableHead>
                  <TableHead className={isRTL ? 'text-right' : 'text-left'}>
                    {locale === 'ar' ? 'الرقم الضريبي' : 'TRN'}
                  </TableHead>
                  <TableHead className={isRTL ? 'text-right' : 'text-left'}>
                    {locale === 'ar' ? 'نوع النشاط' : 'Business Type'}
                  </TableHead>
                  <TableHead className={isRTL ? 'text-right' : 'text-left'}>
                    {locale === 'ar' ? 'المبلغ المستحق' : 'Outstanding'}
                  </TableHead>
                  <TableHead className={isRTL ? 'text-right' : 'text-left'}>
                    {locale === 'ar' ? 'الإجراءات' : 'Actions'}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCustomers.map((customer) => {
                  const outstanding = getCustomerOutstanding(customer)
                  
                  return (
                    <TableRow key={customer.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                            <Building className="h-5 w-5 text-blue-600" />
                          </div>
                          <div>
                            <div className="font-medium">{customer.name}</div>
                            {customer.businessName && (
                              <div className="text-sm text-muted-foreground">
                                {customer.businessName}
                              </div>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1 text-sm">
                          {customer.email && (
                            <div className="flex items-center gap-2">
                              <Mail className="h-3 w-3 text-muted-foreground" />
                              <span>{customer.email}</span>
                            </div>
                          )}
                          {customer.phone && (
                            <div className="flex items-center gap-2">
                              <Phone className="h-3 w-3 text-muted-foreground" />
                              <UAEPhoneDisplay phone={customer.phone} />
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {customer.trn ? (
                          <TRNDisplay trn={customer.trn} locale={locale} />
                        ) : (
                          <span className="text-muted-foreground text-sm">
                            {locale === 'ar' ? 'غير محدد' : 'Not provided'}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {customer.businessType ? (
                          <BusinessTypeDisplay 
                            type={customer.businessType} 
                            locale={locale}
                          />
                        ) : (
                          <span className="text-muted-foreground text-sm">
                            {locale === 'ar' ? 'غير محدد' : 'Not specified'}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <AEDAmount 
                          amount={outstanding} 
                          locale={locale === 'ar' ? 'ar-AE' : 'en-AE'}
                          className={outstanding > 0 ? 'text-orange-600' : 'text-muted-foreground'}
                        />
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align={isRTL ? 'start' : 'end'}>
                            <DropdownMenuItem>
                              <Eye className="h-4 w-4 mr-2" />
                              {locale === 'ar' ? 'عرض' : 'View'}
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Edit className="h-4 w-4 mr-2" />
                              {locale === 'ar' ? 'تعديل' : 'Edit'}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-red-600"
                              onClick={() => handleDeleteCustomer(customer.id)}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              {locale === 'ar' ? 'حذف' : 'Delete'}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </LoadingOverlay>
      </Card>
    </div>
  )
}