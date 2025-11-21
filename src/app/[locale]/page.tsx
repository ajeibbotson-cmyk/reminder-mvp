'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Menu, X } from 'lucide-react';

export default function HomePage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 overflow-x-hidden">
      {/* Navigation Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-gray-200 sticky top-0 z-50">
        <nav className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="text-2xl font-bold text-gray-900">
              Reminder
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center gap-6">
              <Link href="#features" className="text-gray-600 hover:text-gray-900 transition-colors">
                Features
              </Link>
              <Link href="#pricing" className="text-gray-600 hover:text-gray-900 transition-colors">
                Pricing
              </Link>
              <Link href="/auth/signin" className="text-gray-600 hover:text-gray-900 transition-colors">
                Sign In
              </Link>
              <Button asChild variant="premium" size="default">
                <Link href="/auth/signup">
                  Start Free Trial
                </Link>
              </Button>
            </div>

            {/* Mobile Menu Button */}
            <button
              type="button"
              className="md:hidden p-2 text-gray-600 hover:text-gray-900"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>

          {/* Mobile Navigation */}
          {mobileMenuOpen && (
            <div className="md:hidden mt-4 pb-4 border-t border-gray-200 pt-4">
              <div className="flex flex-col gap-4">
                <Link
                  href="#features"
                  className="text-gray-600 hover:text-gray-900 transition-colors"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Features
                </Link>
                <Link
                  href="#pricing"
                  className="text-gray-600 hover:text-gray-900 transition-colors"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Pricing
                </Link>
                <Link
                  href="/auth/signin"
                  className="text-gray-600 hover:text-gray-900 transition-colors"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Sign In
                </Link>
                <Button asChild variant="premium" size="default" className="w-full">
                  <Link href="/auth/signup">
                    Start Free Trial
                  </Link>
                </Button>
              </div>
            </div>
          )}
        </nav>
      </header>

      <main>
        {/* Hero Section */}
        <div className="container mx-auto px-4 py-16">
          <div className="text-center mb-16">
            <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-6">
              Reminder
            </h1>
            <p className="text-lg sm:text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
              E-invoicing gets your invoices delivered. Reminder gets them paid.
            </p>
            <p className="text-base sm:text-lg text-gray-500 mb-12 max-w-2xl mx-auto">
              Reduce payment delays by 25% with automated, culturally-appropriate follow-ups for UAE businesses.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button asChild variant="premium" size="xl" className="text-lg px-8 py-3">
                <Link href="/auth/signup">
                  Start 14-day Free Trial
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="text-lg px-8 py-3">
                <Link href="/auth/signin">
                  Sign In
                </Link>
              </Button>
            </div>
          </div>

          {/* Features Section */}
          <section id="features" className="scroll-mt-20">
            <div className="grid md:grid-cols-3 gap-6 sm:gap-8 max-w-6xl mx-auto">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <span className="text-2xl">📧</span>
                    <h3>Automated Follow-ups</h3>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription>
                    Professional, culturally-appropriate payment reminders in English and Arabic.
                    3-step automated sequences that maintain business relationships.
                  </CardDescription>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <span className="text-2xl">💰</span>
                    <h3>Payment Tracking</h3>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription>
                    Real-time dashboard showing overdue amounts, DSO trends, and payment performance.
                    AED currency support with UAE business formatting.
                  </CardDescription>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <span className="text-2xl">📊</span>
                    <h3>UAE-Focused Reports</h3>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription>
                    Business insights tailored for UAE SMEs. Export reports for accountants,
                    track performance improvements, and prepare for e-invoicing mandate.
                  </CardDescription>
                </CardContent>
              </Card>
            </div>
          </section>

          {/* CTA Section */}
          <section id="pricing" className="scroll-mt-20 mt-16">
            <div className="text-center p-8 bg-white rounded-lg shadow-lg max-w-4xl mx-auto">
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-4">
                Ready for UAE&apos;s E-Invoicing Mandate (July 2026)?
              </h2>
              <p className="text-gray-600 mb-6">
                Join 200+ UAE businesses already collecting payments faster with Reminder.
                Get first-mover advantage before the e-invoicing mandate hits.
              </p>
              <Button asChild variant="premium" size="xl" className="text-lg px-8 py-3">
                <Link href="/auth/signup">
                  Get Started - No Credit Card Required
                </Link>
              </Button>
            </div>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-300 mt-16">
        <div className="container mx-auto px-4 py-12">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <h3 className="text-white font-bold text-lg mb-4">Reminder</h3>
              <p className="text-sm">
                Automated invoice follow-ups for UAE businesses. Get paid faster with culturally-appropriate reminders.
              </p>
            </div>
            <div>
              <h3 className="text-white font-semibold mb-4">Product</h3>
              <ul className="space-y-2 text-sm">
                <li><Link href="#features" className="hover:text-white transition-colors">Features</Link></li>
                <li><Link href="#pricing" className="hover:text-white transition-colors">Pricing</Link></li>
                <li><Link href="/auth/signup" className="hover:text-white transition-colors">Free Trial</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="text-white font-semibold mb-4">Company</h3>
              <ul className="space-y-2 text-sm">
                <li><Link href="/about" className="hover:text-white transition-colors">About Us</Link></li>
                <li><Link href="/contact" className="hover:text-white transition-colors">Contact</Link></li>
                <li><Link href="/blog" className="hover:text-white transition-colors">Blog</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="text-white font-semibold mb-4">Legal</h3>
              <ul className="space-y-2 text-sm">
                <li><Link href="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link></li>
                <li><Link href="/terms" className="hover:text-white transition-colors">Terms of Service</Link></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-8 pt-8 text-sm text-center">
            <p>&copy; {new Date().getFullYear()} Reminder. All rights reserved. Made for UAE businesses.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
