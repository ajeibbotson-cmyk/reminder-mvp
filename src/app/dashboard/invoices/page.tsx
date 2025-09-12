'use client'

import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import { useEffect } from "react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { InvoiceTable } from "@/components/invoices/invoice-table";
import UAEErrorBoundaryWrapper from "@/components/error-boundaries/uae-error-boundary";

export default function InvoicesPage() {
  const { data: session, status } = useSession();

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
    <DashboardLayout>
      <UAEErrorBoundaryWrapper>
        <InvoiceTable companyId={session.user.companyId} />
      </UAEErrorBoundaryWrapper>
    </DashboardLayout>
  );
}