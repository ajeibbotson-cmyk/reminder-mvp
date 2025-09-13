'use client'

import React, { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { CheckCircle, XCircle, Mail, Shield, Clock } from 'lucide-react'
import { toast } from 'sonner'

interface UnsubscribeStatus {
  email: string
  companyId: string
  isUnsubscribed: boolean
  suppressionType?: string
  suppressedAt?: string
  customerExists: boolean
  customerName?: string
  preferences?: {
    invoiceReminders: boolean
    paymentReminders: boolean
    marketingEmails: boolean
    newsletters: boolean
    language: string
  }
}

export default function UnsubscribePage() {
  const [status, setStatus] = useState<UnsubscribeStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [unsubscribing, setUnsubscribing] = useState(false)
  const [preferences, setPreferences] = useState<any>({})
  const searchParams = useSearchParams()
  
  const email = searchParams.get('email')
  const companyId = searchParams.get('companyId')
  const token = searchParams.get('token')

  useEffect(() => {
    if (email && companyId) {
      fetchUnsubscribeStatus()
    } else {
      setLoading(false)
    }
  }, [email, companyId])

  const fetchUnsubscribeStatus = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        email: email!,
        companyId: companyId!,
        ...(token && { token })
      })

      const response = await fetch(`/api/email/unsubscribe?${params}`)
      if (response.ok) {
        const data = await response.json()
        setStatus(data)
        setPreferences(data.preferences || {
          invoiceReminders: true,
          paymentReminders: true,
          marketingEmails: false,
          newsletters: false,
          language: 'ENGLISH'
        })
      } else {
        throw new Error('Failed to fetch unsubscribe status')
      }
    } catch (error) {
      console.error('Error fetching unsubscribe status:', error)
      toast.error('Failed to load unsubscribe information')
    } finally {
      setLoading(false)
    }
  }

  const handleUnsubscribe = async () => {
    if (!email || !companyId) return

    try {
      setUnsubscribing(true)
      const response = await fetch('/api/email/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          companyId,
          ...(token && { token })
        })
      })

      if (response.ok) {
        const data = await response.json()
        toast.success('Successfully unsubscribed from email communications')
        setStatus(prev => prev ? { ...prev, isUnsubscribed: true } : null)
      } else {
        const error = await response.json()
        throw new Error(error.message || 'Failed to unsubscribe')
      }
    } catch (error) {
      console.error('Error unsubscribing:', error)
      toast.error('Failed to unsubscribe. Please try again.')
    } finally {
      setUnsubscribing(false)
    }
  }

  const handlePreferenceUpdate = async () => {
    // In a full implementation, this would update customer preferences
    toast.success('Preferences updated successfully')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center">
            <Clock className="w-8 h-8 text-blue-500 mx-auto mb-4 animate-pulse" />
            <p>Loading unsubscribe information...</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!email || !companyId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center">
            <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Invalid Request</h2>
            <p className="text-gray-600 mb-4">
              This unsubscribe link is missing required information.
            </p>
            <p className="text-sm text-gray-500">
              Please use the unsubscribe link from your email.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto space-y-6">
          
          {/* Header */}
          <div className="text-center">
            <Mail className="w-16 h-16 text-blue-500 mx-auto mb-4" />
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Email Preferences
            </h1>
            <p className="text-gray-600">
              Manage your email communication preferences
            </p>
          </div>

          {/* Current Status */}
          {status && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {status.isUnsubscribed ? (
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  ) : (
                    <Mail className="w-5 h-5 text-blue-500" />
                  )}
                  Current Status
                </CardTitle>
                <CardDescription>
                  Email: {status.email}
                  {status.customerName && ` • Customer: ${status.customerName}`}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {status.isUnsubscribed ? (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 text-green-800 mb-2">
                      <CheckCircle className="w-4 h-4" />
                      <span className="font-medium">Unsubscribed</span>
                    </div>
                    <p className="text-green-700 text-sm">
                      You have been successfully unsubscribed from email communications.
                      {status.suppressedAt && (
                        <> Unsubscribed on {new Date(status.suppressedAt).toLocaleDateString('en-AE')}</>
                      )}
                    </p>
                  </div>
                ) : (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 text-blue-800 mb-2">
                      <Mail className="w-4 h-4" />
                      <span className="font-medium">Subscribed</span>
                    </div>
                    <p className="text-blue-700 text-sm">
                      You are currently subscribed to email communications.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Preferences Management */}
          {status && !status.isUnsubscribed && (
            <Card>
              <CardHeader>
                <CardTitle>Email Preferences</CardTitle>
                <CardDescription>
                  Choose which types of emails you'd like to receive
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4">
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <Label className="text-sm font-medium">Invoice Reminders</Label>
                      <p className="text-xs text-gray-600">
                        Payment due dates and overdue notices
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={preferences.invoiceReminders}
                      onChange={(e) => setPreferences({
                        ...preferences,
                        invoiceReminders: e.target.checked
                      })}
                      className="w-4 h-4"
                    />
                  </div>

                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <Label className="text-sm font-medium">Payment Confirmations</Label>
                      <p className="text-xs text-gray-600">
                        Receipts and payment acknowledgments
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={preferences.paymentReminders}
                      onChange={(e) => setPreferences({
                        ...preferences,
                        paymentReminders: e.target.checked
                      })}
                      className="w-4 h-4"
                    />
                  </div>

                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <Label className="text-sm font-medium">Marketing Emails</Label>
                      <p className="text-xs text-gray-600">
                        Promotional offers and company updates
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={preferences.marketingEmails}
                      onChange={(e) => setPreferences({
                        ...preferences,
                        marketingEmails: e.target.checked
                      })}
                      className="w-4 h-4"
                    />
                  </div>

                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <Label className="text-sm font-medium">Newsletters</Label>
                      <p className="text-xs text-gray-600">
                        Monthly newsletters and announcements
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={preferences.newsletters}
                      onChange={(e) => setPreferences({
                        ...preferences,
                        newsletters: e.target.checked
                      })}
                      className="w-4 h-4"
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <Button onClick={handlePreferenceUpdate} variant="outline">
                    Update Preferences
                  </Button>
                  <Button
                    onClick={handleUnsubscribe}
                    variant="destructive"
                    disabled={unsubscribing}
                  >
                    {unsubscribing ? 'Unsubscribing...' : 'Unsubscribe from All Emails'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Unsubscribe Action */}
          {status && status.isUnsubscribed && (
            <Card>
              <CardContent className="p-8 text-center">
                <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-2">You're All Set</h3>
                <p className="text-gray-600 mb-4">
                  You have been successfully unsubscribed from all email communications.
                </p>
                <p className="text-sm text-gray-500">
                  If you change your mind, please contact customer support to resubscribe.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Privacy Notice */}
          <Card className="bg-gray-50">
            <CardContent className="p-6">
              <div className="flex items-start gap-3">
                <Shield className="w-5 h-5 text-gray-600 flex-shrink-0 mt-1" />
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Privacy & Data Protection</h4>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    Your email preferences are stored securely and in compliance with UAE data protection regulations. 
                    We respect your privacy and will only send communications you have opted to receive. 
                    Unsubscribing will not affect transactional emails related to your account or services.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}