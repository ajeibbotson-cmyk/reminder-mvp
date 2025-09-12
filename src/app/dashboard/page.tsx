'use client'

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { redirect, useRouter } from "next/navigation";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { EnhancedDashboard } from '@/components/dashboard/enhanced-dashboard';
import { UAEErrorBoundary } from '@/components/error-boundaries/uae-error-boundary';

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  // Redirect if not authenticated
  useEffect(() => {
    if (status === "unauthenticated") {
      redirect("/auth/signin");
    }
  }, [status]);

  if (status === "loading") {
    return <DashboardLayout><div>Loading...</div></DashboardLayout>;
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