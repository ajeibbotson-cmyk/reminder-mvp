import type { Metadata } from "next";
import "./globals.css";
import { QueryProvider } from "@/lib/providers/query-provider";
import { AuthProvider } from "@/lib/providers/auth-provider";
import { ErrorBoundary } from "@/lib/components/error-boundary";

export const metadata: Metadata = {
  title: "Reminder - UAE E-Invoice Payment Collection Platform",
  description: "E-invoicing gets your invoices delivered. Reminder gets them paid.",
  icons: {
    icon: '/favicon.svg',
    shortcut: '/favicon.svg',
    apple: '/favicon.svg',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html>
      <body>
        <ErrorBoundary
          fallback={
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
              <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-8 text-center">
                <div className="text-red-600 mb-4">
                  <svg className="w-16 h-16 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <h1 className="text-2xl font-bold text-gray-900 mb-2">Application Error</h1>
                </div>
                <p className="text-gray-600 mb-6">
                  We're sorry, but something went wrong. Please refresh the page or contact support if the problem persists.
                </p>
              </div>
            </div>
          }
        >
          <AuthProvider>
            <QueryProvider>
              {children}
            </QueryProvider>
          </AuthProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}