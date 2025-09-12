'use client'

import { useEffect, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import { useInvoiceStore } from "@/lib/stores/invoice-store";
import { useCustomerStore } from "@/lib/stores/customer-store";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { DashboardCardSkeleton } from "@/components/ui/skeleton";
import { AEDAmount } from "@/components/ui/uae-formatters";
import { 
  FileText, 
  Users, 
  Clock, 
  AlertTriangle,
  Plus,
  Upload,
  Settings,
  TrendingUp,
  DollarSign
} from "lucide-react";

interface DashboardStats {
  totalOutstanding: number;
  overdueAmount: number;
  avgDaysToPay: number;
  urgentFollowUps: number;
  totalInvoices: number;
  totalCustomers: number;
  paidThisMonth: number;
  collectionRate: number;
}

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const t = useTranslations();
  const locale = useLocale();
  const isRTL = locale === 'ar';

  const { invoices, loading: invoicesLoading, fetchInvoices } = useInvoiceStore();
  const { customers, loading: customersLoading, fetchCustomers } = useCustomerStore();

  const [stats, setStats] = useState<DashboardStats>({
    totalOutstanding: 0,
    overdueAmount: 0,
    avgDaysToPay: 0,
    urgentFollowUps: 0,
    totalInvoices: 0,
    totalCustomers: 0,
    paidThisMonth: 0,
    collectionRate: 0
  });

  const loading = invoicesLoading || customersLoading;

  // Redirect if not authenticated
  useEffect(() => {
    if (status === "unauthenticated") {
      redirect("/auth/signin");
    }
  }, [status]);

  // Fetch data when session is available
  useEffect(() => {
    if (session?.user?.companyId) {
      fetchInvoices(session.user.companyId).catch(console.error);
      fetchCustomers(session.user.companyId).catch(console.error);
    }
  }, [session?.user?.companyId, fetchInvoices, fetchCustomers]);

  // Calculate statistics
  useEffect(() => {
    if (invoices.length === 0 && customers.length === 0) {
      return;
    }

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    let totalOutstanding = 0;
    let overdueAmount = 0;
    let paidThisMonth = 0;
    let urgentFollowUps = 0;

    invoices.forEach(invoice => {
      if (invoice.status === 'PAID') {
        const paidDate = new Date(invoice.updatedAt);
        if (paidDate.getMonth() === currentMonth && paidDate.getFullYear() === currentYear) {
          paidThisMonth += invoice.amount;
        }
      } else {
        totalOutstanding += invoice.amount;
        
        const dueDate = new Date(invoice.dueDate);
        if (dueDate < now) {
          overdueAmount += invoice.amount;
          
          // Count as urgent if overdue by more than 30 days
          const daysPastDue = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
          if (daysPastDue > 30) {
            urgentFollowUps++;
          }
        }
      }
    });

    const totalInvoiceAmount = invoices.reduce((sum, inv) => sum + inv.amount, 0);
    const collectionRate = totalInvoiceAmount > 0 ? ((totalInvoiceAmount - totalOutstanding) / totalInvoiceAmount) * 100 : 0;

    // Calculate average days to pay (simplified)
    const paidInvoices = invoices.filter(inv => inv.status === 'PAID');
    let avgDaysToPay = 0;
    if (paidInvoices.length > 0) {
      const totalDays = paidInvoices.reduce((sum, inv) => {
        const createdDate = new Date(inv.createdAt);
        const paidDate = new Date(inv.updatedAt);
        return sum + Math.floor((paidDate.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24));
      }, 0);
      avgDaysToPay = Math.round(totalDays / paidInvoices.length);
    }

    setStats({
      totalOutstanding,
      overdueAmount,
      avgDaysToPay,
      urgentFollowUps,
      totalInvoices: invoices.length,
      totalCustomers: customers.length,
      paidThisMonth,
      collectionRate
    });
  }, [invoices, customers]);

  if (status === "loading") {
    return <DashboardLayout><div>Loading...</div></DashboardLayout>;
  }

  if (!session) {
    return null;
  }

  return (
    <DashboardLayout>
      <div className={`space-y-8 ${isRTL ? 'rtl' : 'ltr'}`}>
        {/* Welcome Section */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            {t('dashboard.title')}
          </h1>
          <p className="text-gray-600 mt-2">
            {locale === 'ar' 
              ? `أهلاً بك مرة أخرى، ${session.user.name}!`
              : `Welcome back, ${session.user.name}!`
            }
          </p>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <DashboardCardSkeleton key={i} />
            ))
          ) : (
            <>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4" />
                    {t('dashboard.totalOutstanding')}
                  </CardDescription>
                  <CardTitle className="text-2xl">
                    <AEDAmount 
                      amount={stats.totalOutstanding} 
                      locale={locale === 'ar' ? 'ar-AE' : 'en-AE'}
                    />
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    {stats.totalInvoices === 0 
                      ? (locale === 'ar' ? 'لا توجد فواتير بعد' : 'No invoices yet')
                      : `${stats.totalInvoices} ${locale === 'ar' ? 'فاتورة' : 'invoices'}`
                    }
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    {t('dashboard.overdueAmount')}
                  </CardDescription>
                  <CardTitle className="text-2xl">
                    <AEDAmount 
                      amount={stats.overdueAmount} 
                      locale={locale === 'ar' ? 'ar-AE' : 'en-AE'}
                      className={stats.overdueAmount > 0 ? 'text-red-600' : ''}
                    />
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    {stats.overdueAmount > 0
                      ? (locale === 'ar' ? 'يتطلب متابعة عاجلة' : 'Needs urgent follow-up')
                      : (locale === 'ar' ? 'لا توجد مبالغ متأخرة' : 'No overdue amounts')
                    }
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    {t('dashboard.daysToCollection')}
                  </CardDescription>
                  <CardTitle className="text-2xl">
                    {stats.avgDaysToPay > 0 ? `${stats.avgDaysToPay}` : '--'}
                    {stats.avgDaysToPay > 0 && (
                      <span className="text-sm font-normal ml-1">
                        {locale === 'ar' ? 'يوم' : 'days'}
                      </span>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    {stats.avgDaysToPay === 0
                      ? (locale === 'ar' ? 'سيتم الحساب قريباً' : 'Will be calculated')
                      : `${stats.collectionRate.toFixed(1)}% ${locale === 'ar' ? 'معدل التحصيل' : 'collection rate'}`
                    }
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    {t('dashboard.urgentFollowUps')}
                  </CardDescription>
                  <CardTitle className="text-2xl">
                    {stats.urgentFollowUps}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    {stats.urgentFollowUps === 0
                      ? (locale === 'ar' ? 'لا توجد إجراءات عاجلة' : 'No urgent actions needed')
                      : (locale === 'ar' ? 'متأخرة أكثر من 30 يوم' : 'Overdue 30+ days')
                    }
                  </p>
                </CardContent>
              </Card>
            </>
          )}
        </div>

        {/* Quick Actions & Getting Started */}
        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="h-5 w-5" />
                {locale === 'ar' ? 'الإجراءات السريعة' : 'Quick Actions'}
              </CardTitle>
              <CardDescription>
                {locale === 'ar' 
                  ? 'ابدأ في جمع المدفوعات بسرعة'
                  : 'Get started with your payment collection'
                }
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button className="w-full justify-start" variant="outline">
                <Upload className={`h-4 w-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                {locale === 'ar' ? 'استيراد الفواتير' : 'Import Invoices'}
              </Button>
              <Button className="w-full justify-start" variant="outline">
                <FileText className={`h-4 w-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                {locale === 'ar' ? 'إضافة فاتورة يدوياً' : 'Add Invoice Manually'}
              </Button>
              <Button className="w-full justify-start" variant="outline">
                <Settings className={`h-4 w-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                {locale === 'ar' ? 'إعداد قوالب المتابعة' : 'Set up Follow-up Templates'}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>
                {locale === 'ar' ? 'البدء' : 'Getting Started'}
              </CardTitle>
              <CardDescription>
                {locale === 'ar' 
                  ? 'أكمل هذه الخطوات لتحسين جمع المدفوعات'
                  : 'Complete these steps to optimize your payment collection'
                }
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[
                  {
                    en: 'Import your first invoices',
                    ar: 'استورد فواتيرك الأولى',
                    completed: stats.totalInvoices > 0
                  },
                  {
                    en: 'Add customer information',
                    ar: 'أضف معلومات العملاء',
                    completed: stats.totalCustomers > 0
                  },
                  {
                    en: 'Customize email templates',
                    ar: 'خصص قوالب البريد الإلكتروني',
                    completed: false
                  },
                  {
                    en: 'Send your first follow-up',
                    ar: 'أرسل أول متابعة',
                    completed: false
                  }
                ].map((step, index) => (
                  <div key={index} className={`flex items-center gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
                    <div className={`w-2 h-2 rounded-full ${
                      step.completed ? 'bg-green-500' : 'bg-gray-300'
                    }`} />
                    <span className={`text-sm ${step.completed ? 'text-green-700' : 'text-gray-600'}`}>
                      {locale === 'ar' ? step.ar : step.en}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Activity Summary */}
        {stats.paidThisMonth > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-green-600">
                {locale === 'ar' ? 'التحصيل هذا الشهر' : 'Collections This Month'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                <AEDAmount 
                  amount={stats.paidThisMonth} 
                  locale={locale === 'ar' ? 'ar-AE' : 'en-AE'}
                />
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {locale === 'ar' 
                  ? 'أداء ممتاز في التحصيل!'
                  : 'Great collection performance!'
                }
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}