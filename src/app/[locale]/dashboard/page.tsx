'use client'

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { redirect, useRouter } from "next/navigation";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { EnhancedDashboard } from '@/components/dashboard/enhanced-dashboard';
import { UAEErrorBoundary } from '@/components/error-boundaries/uae-error-boundary';
import { ProfessionalLoading } from '@/components/ui/professional-loading';

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  // Redirect if not authenticated
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/en/auth/signin");
    }
  }, [status, router]);

  if (status === "loading") {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <ProfessionalLoading
            variant="branded"
            size="lg"
            message="Loading your dashboard..."
            showBrand
          />
        </div>
      </DashboardLayout>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <UAEErrorBoundary>
      <DashboardLayout>
        <EnhancedDashboard 
          companyId={session.user.companyId} 
          locale="en"
        />
      </DashboardLayout>
    </UAEErrorBoundary>
  );
}