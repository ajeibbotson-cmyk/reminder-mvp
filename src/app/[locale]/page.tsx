import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold text-gray-900 mb-6">
            Reminder
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
            E-invoicing gets your invoices delivered. Reminder gets them paid.
          </p>
          <p className="text-lg text-gray-500 mb-12 max-w-2xl mx-auto">
            Reduce payment delays by 25% with automated, culturally-appropriate follow-ups for UAE businesses.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button asChild size="lg" className="text-lg px-8 py-3">
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

        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                📧 Automated Follow-ups
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
                💰 Payment Tracking
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
                📊 UAE-Focused Reports
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

        <div className="text-center mt-16 p-8 bg-white rounded-lg shadow-lg max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            Ready for UAE's E-Invoicing Mandate (July 2026)?
          </h2>
          <p className="text-gray-600 mb-6">
            Join 200+ UAE businesses already collecting payments faster with Reminder. 
            Get first-mover advantage before the e-invoicing mandate hits.
          </p>
          <Button asChild size="lg" className="text-lg px-8 py-3">
            <Link href="/auth/signup">
              Get Started - No Credit Card Required
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
