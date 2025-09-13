import type { Metadata } from "next";
import { Inter } from "next/font/google";
import NextAuthSessionProvider from "@/components/providers/session-provider";
import { Toaster } from "@/components/ui/sonner";
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { notFound } from 'next/navigation';
import "../globals.css";

const inter = Inter({ subsets: ["latin", "latin-ext"] });

export const metadata: Metadata = {
  title: "UAEPay - UAE E-Invoice Payment Collection Platform",
  description: "E-invoicing gets your invoices delivered. UAEPay gets them paid.",
};

interface LocaleLayoutProps {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}

export default async function LocaleLayout({
  children,
  params
}: LocaleLayoutProps) {
  const { locale } = await params;
  
  // Validate locale
  const locales = ['en', 'ar'];
  if (!locales.includes(locale)) {
    notFound();
  }

  const messages = await getMessages({ locale });

  return (
    <html lang={locale} dir={locale === 'ar' ? 'rtl' : 'ltr'}>
      <body className={inter.className}>
        <NextIntlClientProvider messages={messages} locale={locale}>
          <NextAuthSessionProvider>
            {children}
            <Toaster />
          </NextAuthSessionProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}