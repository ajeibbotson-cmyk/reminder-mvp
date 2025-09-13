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

  // Redirect all dashboard routes to localized versions
  if (pathname.startsWith('/dashboard')) {
    return NextResponse.redirect(new URL(`/en${pathname}`, request.url));
  }

  // Redirect auth routes to localized versions
  if (pathname.startsWith('/auth/')) {
    return NextResponse.redirect(new URL(`/en${pathname}`, request.url));
  }

  // Handle internationalization
  return handleI18nRouting(request);
}

export const config = {
  // Match only internationalized pathnames, dashboard, and auth routes
  matcher: ['/', '/(ar|en)/:path*', '/dashboard/:path*', '/auth/:path*']
};