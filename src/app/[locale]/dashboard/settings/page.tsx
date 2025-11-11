'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  Building2,
  Mail,
  Bell,
  Shield,
  Globe,
  CreditCard,
  Users,
  Calendar,
  Save,
  AlertTriangle,
  Loader2
} from 'lucide-react';

interface CompanySettings {
  id: string;
  name: string;
  trn?: string | null;
  address?: string | null;
  defaultVatRate?: number;
  emailSettings: {
    fromName: string;
    replyTo: string;
    signature: string;
  };
  businessHours: {
    timezone: string;
    workingDays: number[];
    startTime: string;
    endTime: string;
  };
  settings: {
    currency: string;
    dateFormat: string;
    language: 'en' | 'ar';
  };
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  async function fetchSettings() {
    try {
      const res = await fetch('/api/settings');
      if (!res.ok) {
        throw new Error('Failed to fetch settings');
      }
      const data = await res.json();
      setSettings(data);
    } catch (error) {
      toast.error('Failed to load settings. Please refresh the page.');
    } finally{
      setLoading(false);
    }
  }

  async function saveSettings() {
    if (!settings) return;

    setSaving(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: settings.name,
          trn: settings.trn,
          address: settings.address,
          defaultVatRate: settings.defaultVatRate,
          emailSettings: settings.emailSettings,
          businessHours: settings.businessHours,
          settings: settings.settings,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to save settings');
      }

      toast.success('Settings saved successfully');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="p-6">
        <div className="text-center">
          <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Failed to Load Settings</h2>
          <p className="text-gray-600 mb-4">Unable to load company settings.</p>
          <Button onClick={fetchSettings}>Retry</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Settings</h1>
          <p className="text-gray-600">Manage your Reminder account and preferences</p>
        </div>
        <Button onClick={saveSettings} disabled={saving}>
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Save Changes
            </>
          )}
        </Button>
      </div>

      <Tabs defaultValue="company" className="space-y-6">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="company">Company</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="integrations">Integrations</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="billing">Billing</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
        </TabsList>

        <TabsContent value="company" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Company Information
              </CardTitle>
              <CardDescription>Update your company details and UAE registration information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="company-name">Company Name</Label>
                  <Input
                    id="company-name"
                    value={settings.name}
                    onChange={(e) => setSettings({ ...settings, name: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="trn">Trade Registration Number (TRN)</Label>
                  <Input
                    id="trn"
                    value={settings.trn || ''}
                    onChange={(e) => setSettings({ ...settings, trn: e.target.value })}
                    placeholder="15-digit TRN"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="address">Business Address</Label>
                <Textarea
                  id="address"
                  value={settings.address || ''}
                  onChange={(e) => setSettings({ ...settings, address: e.target.value })}
                  rows={3}
                  placeholder="Full business address"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Email Settings
              </CardTitle>
              <CardDescription>Configure your email sender information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="from-name">From Name</Label>
                  <Input
                    id="from-name"
                    value={settings.emailSettings.fromName}
                    onChange={(e) => setSettings({
                      ...settings,
                      emailSettings: { ...settings.emailSettings, fromName: e.target.value }
                    })}
                    placeholder="Your Company Name"
                  />
                </div>
                <div>
                  <Label htmlFor="reply-to">Reply-To Email</Label>
                  <Input
                    id="reply-to"
                    type="email"
                    value={settings.emailSettings.replyTo}
                    onChange={(e) => setSettings({
                      ...settings,
                      emailSettings: { ...settings.emailSettings, replyTo: e.target.value }
                    })}
                    placeholder="replies@yourcompany.com"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="signature">Email Signature</Label>
                <Textarea
                  id="signature"
                  value={settings.emailSettings.signature}
                  onChange={(e) => setSettings({
                    ...settings,
                    emailSettings: { ...settings.emailSettings, signature: e.target.value }
                  })}
                  rows={4}
                  placeholder="Best regards,&#10;Your Company Name&#10;+971 4 123 4567"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5" />
                Regional Preferences
              </CardTitle>
              <CardDescription>Configure UAE-specific business settings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="timezone">Timezone</Label>
                  <Select
                    value={settings.businessHours.timezone}
                    onValueChange={(value) => setSettings({
                      ...settings,
                      businessHours: { ...settings.businessHours, timezone: value }
                    })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select timezone" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Asia/Dubai">Asia/Dubai (GST +4)</SelectItem>
                      <SelectItem value="Asia/Riyadh">Asia/Riyadh (AST +3)</SelectItem>
                      <SelectItem value="Asia/Qatar">Asia/Qatar (AST +3)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="currency">Default Currency</Label>
                  <Select
                    value={settings.settings.currency}
                    onValueChange={(value) => setSettings({
                      ...settings,
                      settings: { ...settings.settings, currency: value }
                    })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select currency" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="AED">AED - UAE Dirham</SelectItem>
                      <SelectItem value="SAR">SAR - Saudi Riyal</SelectItem>
                      <SelectItem value="USD">USD - US Dollar</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="language">Default Language</Label>
                  <Select
                    value={settings.settings.language}
                    onValueChange={(value: 'en' | 'ar') => setSettings({
                      ...settings,
                      settings: { ...settings.settings, language: value }
                    })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select language" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="ar">العربية (Arabic)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="vat-rate">Default VAT Rate (%)</Label>
                  <Input
                    id="vat-rate"
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={settings.defaultVatRate || 5}
                    onChange={(e) => setSettings({
                      ...settings,
                      defaultVatRate: parseFloat(e.target.value)
                    })}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Email Notifications
              </CardTitle>
              <CardDescription>Configure when and how you receive notifications</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-base">Invoice Payment Notifications</Label>
                  <p className="text-sm text-gray-600">Get notified when invoices are paid</p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-base">Overdue Invoice Alerts</Label>
                  <p className="text-sm text-gray-600">Daily alerts for overdue payments</p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-base">Follow-up Sequence Updates</Label>
                  <p className="text-sm text-gray-600">Updates on email automation status</p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-base">Weekly Business Reports</Label>
                  <p className="text-sm text-gray-600">Summary of business performance</p>
                </div>
                <Switch />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                UAE Business Hours
              </CardTitle>
              <CardDescription>Configure business hours for automated follow-ups</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="start-time">Start Time</Label>
                  <Input
                    id="start-time"
                    type="time"
                    value={settings.businessHours.startTime}
                    onChange={(e) => setSettings({
                      ...settings,
                      businessHours: { ...settings.businessHours, startTime: e.target.value }
                    })}
                  />
                </div>
                <div>
                  <Label htmlFor="end-time">End Time</Label>
                  <Input
                    id="end-time"
                    type="time"
                    value={settings.businessHours.endTime}
                    onChange={(e) => setSettings({
                      ...settings,
                      businessHours: { ...settings.businessHours, endTime: e.target.value }
                    })}
                  />
                </div>
              </div>
              <div className="p-4 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-800">
                  <strong>Working Days:</strong> Sunday - Thursday (UAE standard)
                </p>
                <p className="text-xs text-blue-600 mt-1">
                  Automated emails will only be sent during these hours on working days
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="integrations" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Email Service
              </CardTitle>
              <CardDescription>Configure your email delivery service</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-blue-50 rounded-lg">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-blue-600 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-blue-800">AWS SES ME-South Region</p>
                    <p className="text-xs text-blue-600">
                      Currently configured for Middle East (Bahrain) region for optimal UAE delivery rates.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Available Integrations</CardTitle>
              <CardDescription>Connect Reminder with your existing business tools</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                      <CreditCard className="h-5 w-5 text-green-600" />
                    </div>
                    <div>
                      <p className="font-medium">Zoho Books</p>
                      <p className="text-sm text-gray-600">Sync invoices and customer data</p>
                    </div>
                  </div>
                  <Badge variant="outline">Coming Soon</Badge>
                </div>
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                      <Building2 className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-medium">QuickBooks</p>
                      <p className="text-sm text-gray-600">Accounting software integration</p>
                    </div>
                  </div>
                  <Badge variant="outline">Coming Soon</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Team Members
              </CardTitle>
              <CardDescription>Manage user access and permissions</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="p-4 text-center text-gray-600">
                <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>User management coming soon</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="billing" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Current Plan
              </CardTitle>
              <CardDescription>Manage your Reminder subscription</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="p-4 text-center text-gray-600">
                <CreditCard className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>Billing information coming soon</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Security Settings
              </CardTitle>
              <CardDescription>Protect your account with additional security measures</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="p-4 text-center text-gray-600">
                <Shield className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>Security settings coming soon</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
