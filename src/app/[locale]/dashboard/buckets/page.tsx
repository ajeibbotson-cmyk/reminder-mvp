import { Suspense } from "react"
import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/auth"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { BucketsContent } from "./buckets-content"

export default async function BucketsPage() {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect("/en/auth/signin")
  }

  return (
    <DashboardLayout>
      <div className="container mx-auto py-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Invoice Buckets</h1>
          <p className="text-muted-foreground mt-2">
            Configure automatic payment reminders for each invoice bucket
          </p>
        </div>

        <Suspense fallback={<div>Loading...</div>}>
          <BucketsContent />
        </Suspense>
      </div>
    </DashboardLayout>
  )
}
