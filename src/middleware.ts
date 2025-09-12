import createIntlMiddleware from 'next-intl/middleware';
import { NextRequest, NextResponse } from 'next/server';

const handleI18nRouting = createIntlMiddleware({
  locales: ['en', 'ar'],
  defaultLocale: 'en'
});

export default async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Handle static assets and API routes
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.includes('/favicon.ico') ||
    pathname.includes('.') // For any file extensions
  ) {
    return NextResponse.next();
  }

  // Handle internationalization
  return handleI18nRouting(request);
}

export const config = {
  // Match only internationalized pathnames
  matcher: ['/', '/(ar|en)/:path*']
};