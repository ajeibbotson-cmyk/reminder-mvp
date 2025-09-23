'use client'

import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import { useTranslations, useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { InvoiceTable } from "@/components/invoices/invoice-table";
import { InvoiceStats } from "@/components/invoices/invoice-stats";
import { InvoiceFilters } from "@/components/invoices/invoice-filters";
import { InvoiceSearch } from "@/components/invoices/invoice-search";
import { useInvoiceStore } from '@/lib/stores/invoice-store';
import { InvoiceFilters as FilterType, InvoiceWithDetails } from '@/types/invoice';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { FileDown, RefreshCw, Download, FileText, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import UAEErrorBoundaryWrapper from "@/components/error-boundaries/uae-error-boundary";

export default function InvoicesPage() {
  const { data: session, status } = useSession();
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const isRTL = locale === 'ar';

  // Store and state
  const { 
    invoices, 
    loading, 
    error, 
    totalCount,
    fetchInvoices,
    clearError
  } = useInvoiceStore();

  const [filters, setFilters] = useState<FilterType>({
    status: [],
    page: 1,
    limit: 10,
    sort_by: 'created_at',
    sort_order: 'desc'
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  // Authentication check
  useEffect(() => {
    if (status === "unauthenticated") {
      redirect("/auth/signin");
    }
  }, [status]);

  // Fetch invoices
  const loadInvoices = useCallback(async (appliedFilters?: FilterType) => {
    if (!session?.user?.companyId) return;

    try {
      const currentFilters = appliedFilters || filters;
      const filtersWithSearch = {
        ...currentFilters,
        search: searchQuery || undefined
      };

      await fetchInvoices(filtersWithSearch);
    } catch (error) {
      toast.error(
        locale === 'ar' ? 'فشل في تحميل الفواتير' : 'Failed to load invoices'
      );
      console.error('Failed to fetch invoices:', error);
    }
  }, [session?.user?.companyId, fetchInvoices, locale]);

  // Load invoices when company, filters, or search changes
  useEffect(() => {
    if (session?.user?.companyId) {
      const filtersWithSearch = {
        ...filters,
        search: searchQuery || undefined
      };

      fetchInvoices(filtersWithSearch).catch(error => {
        toast.error(
          locale === 'ar' ? 'فشل في تحميل الفواتير' : 'Failed to load invoices'
        );
        console.error('Failed to fetch invoices:', error);
      });
    }
  }, [session?.user?.companyId, filters, searchQuery, fetchInvoices, locale]);

  // Handle filters change
  const handleFiltersChange = useCallback((newFilters: FilterType) => {
    setFilters(newFilters);
    loadInvoices(newFilters);
  }, [loadInvoices]);

  // Handle search
  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
  }, []);

  // Handle invoice selection from search
  const handleInvoiceSelect = (invoice: InvoiceWithDetails) => {
    // Navigate to invoice detail page
    router.push(`/dashboard/invoices/${invoice.id}`);
  };

  // Handle refresh
  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await loadInvoices();
      toast.success(
        locale === 'ar' ? 'تم تحديث الفواتير بنجاح' : 'Invoices refreshed successfully'
      );
    } catch (error) {
      toast.error(
        locale === 'ar' ? 'فشل في تحديث الفواتير' : 'Failed to refresh invoices'
      );
    } finally {
      setRefreshing(false);
    }
  };

  // Handle export
  const handleExport = async () => {
    try {
      toast.info(
        locale === 'ar' ? 'ستتوفر ميزة التصدير قريباً' : 'Export functionality coming soon'
      );
    } catch (error) {
      toast.error(
        locale === 'ar' ? 'فشل في تصدير الفواتير' : 'Failed to export invoices'
      );
    }
  };

  // Loading state
  if (status === "loading") {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <LoadingSpinner size="lg" />
        </div>
      </DashboardLayout>
    );
  }

  // Unauthenticated state
  if (!session) {
    return null;
  }

  // Error state
  if (error) {
    return (
      <DashboardLayout>
        <Card className="p-6">
          <div className="text-center space-y-4">
            <div className="text-red-600 font-medium">
              {locale === 'ar' ? 'حدث خطأ في تحميل الفواتير' : 'Error loading invoices'}
            </div>
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button onClick={() => {
              clearError();
              loadInvoices();
            }} variant="outline">
              {locale === 'ar' ? 'حاول مرة أخرى' : 'Try Again'}
            </Button>
          </div>
        </Card>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <UAEErrorBoundaryWrapper>
        <div className={cn('space-y-6 p-6', isRTL ? 'rtl' : 'ltr')}>
          {/* Page Header */}
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
            <div className="space-y-1">
              <h1 className="text-3xl font-bold tracking-tight">
                {t('invoices.title')}
              </h1>
              <p className="text-muted-foreground">
                {locale === 'ar' 
                  ? 'إدارة وتتبع جميع فواتيرك من مكان واحد'
                  : 'Manage and track all your invoices from one place'
                }
              </p>
            </div>
            
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={refreshing || loading}
                className="gap-2"
              >
                <RefreshCw className={cn('h-4 w-4', (refreshing || loading) && 'animate-spin')} />
                {locale === 'ar' ? 'تحديث' : 'Refresh'}
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={handleExport}
                className="gap-2"
              >
                <FileDown className="h-4 w-4" />
                {locale === 'ar' ? 'تصدير' : 'Export'}
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push('/dashboard/invoices/import')}
                className="gap-2"
              >
                <Upload className="h-4 w-4" />
                {locale === 'ar' ? 'رفع' : 'Upload'}
              </Button>

            </div>
          </div>

          {/* Statistics Dashboard */}
          <InvoiceStats 
            invoices={invoices} 
            loading={loading}
          />

          {/* Search and Filters */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            <div className="lg:col-span-3">
              <InvoiceSearch
                invoices={invoices}
                onSearch={handleSearch}
                onInvoiceSelect={handleInvoiceSelect}
                placeholder={locale === 'ar' 
                  ? 'البحث في الفواتير، العملاء، المبالغ...'
                  : 'Search invoices, customers, amounts...'
                }
              />
            </div>
            <div className="lg:col-span-1">
              <InvoiceFilters
                onFiltersChange={handleFiltersChange}
                defaultFilters={filters}
              />
            </div>
          </div>

          {/* Invoice Table */}
          <InvoiceTable
            companyId={session.user.companyId}
            invoices={invoices}
            loading={loading}
            filters={filters}
            onFiltersChange={handleFiltersChange}
            totalCount={totalCount}
          />
        </div>
      </UAEErrorBoundaryWrapper>
    </DashboardLayout>
  );
}