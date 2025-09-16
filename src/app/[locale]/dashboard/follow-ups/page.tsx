'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { 
  Mail, 
  Plus, 
  Edit, 
  Eye, 
  Copy, 
  Trash2, 
  Search,
  Filter,
  Download,
  Play,
  Pause,
  Settings,
  Target,
  TrendingUp,
  Users,
  Calendar,
  Clock,
  Zap,
  Heart,
  Globe,
  Sparkles,
  BarChart3,
  Activity,
  Timer,
  CheckCircle,
  XCircle,
  AlertCircle,
  ArrowRight,
  TestTube
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Progress } from "@/components/ui/progress"
import { SequenceBuilder } from '@/components/follow-ups/sequence-builder'
import { SequenceLibrary } from '@/components/follow-ups/sequence-library'
import { SequenceTester } from '@/components/follow-ups/sequence-tester'
import { AutomationDashboard } from '@/components/follow-ups/automation-dashboard'
import { SequenceTimeline } from '@/components/follow-ups/sequence-timeline'
import { FollowUpHistoryTable } from '@/components/follow-ups/follow-up-history-table'
import { SequenceMetrics } from '@/components/follow-ups/sequence-metrics'
import { useFollowUpSequenceStore } from '@/lib/stores/follow-up-store'
import { UAEErrorBoundary } from '@/components/error-boundaries/uae-error-boundary'
import { cn } from '@/lib/utils'

export default function FollowUpsPage() {
  const { data: session } = useSession()
  const t = useTranslations('followUps')
  const router = useRouter()
  
  const [activeTab, setActiveTab] = useState('dashboard')
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [selectedSequence, setSelectedSequence] = useState<any>(null)
  const [showBuilder, setShowBuilder] = useState(false)
  const [showLibrary, setShowLibrary] = useState(false)
  const [showTester, setShowTester] = useState(false)
  const [editingSequence, setEditingSequence] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')

  const { 
    sequences, 
    fetchSequences, 
    addSequence, 
    updateSequence, 
    deleteSequence,
    toggleSequenceActive,
    loading, 
    error 
  } = useFollowUpSequenceStore()

  useEffect(() => {
    if (session?.user?.companyId) {
      fetchSequences(session.user.companyId)
    }
  }, [session?.user?.companyId, fetchSequences])

  const filteredSequences = sequences.filter(sequence => {
    const matchesSearch = sequence.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         sequence.description?.toLowerCase().includes(searchQuery.toLowerCase())
    
    const matchesStatus = statusFilter === 'all' || 
                         (statusFilter === 'active' && sequence.active) ||
                         (statusFilter === 'inactive' && !sequence.active)
    
    const matchesType = typeFilter === 'all' || sequence.sequenceType === typeFilter

    return matchesSearch && matchesStatus && matchesType
  })

  const sequenceTypes = [
    { value: 'GENTLE_COLLECTION', label: 'Gentle Collection', icon: '💌', color: 'blue' },
    { value: 'PROFESSIONAL_STANDARD', label: 'Professional Standard', icon: '📋', color: 'orange' },
    { value: 'FIRM_RECOVERY', label: 'Firm Recovery', icon: '⚠️', color: 'red' },
    { value: 'RELATIONSHIP_PRESERVING', label: 'Relationship Preserving', icon: '🤝', color: 'green' },
    { value: 'QUICK_COLLECTION', label: 'Quick Collection', icon: '⚡', color: 'purple' },
    { value: 'EXTENDED_COURTESY', label: 'Extended Courtesy', icon: '🕒', color: 'indigo' }
  ]

  const handleCreateSequence = () => {
    setEditingSequence(null)
    setShowBuilder(true)
  }

  const handleCreateFromLibrary = () => {
    setShowLibrary(true)
  }

  const handleEditSequence = (sequence: any) => {
    setSelectedSequence(sequence)
    setEditingSequence(sequence.id)
    setShowBuilder(true)
  }

  const handleTestSequence = (sequence: any) => {
    setSelectedSequence(sequence)
    setShowTester(true)
  }

  const handleDuplicateSequence = async (sequence: any) => {
    try {
      const duplicateData = {
        ...sequence,
        name: `${sequence.name} (Copy)`,
        active: false
      }
      delete duplicateData.id
      delete duplicateData.createdAt
      delete duplicateData.updatedAt
      
      await addSequence(duplicateData)
    } catch (error) {
      console.error('Failed to duplicate sequence:', error)
    }
  }

  const handleDeleteSequence = async (sequenceId: string) => {
    if (confirm('Are you sure you want to delete this sequence?')) {
      try {
        await deleteSequence(sequenceId)
      } catch (error) {
        console.error('Failed to delete sequence:', error)
      }
    }
  }

  const handleToggleActive = async (sequenceId: string) => {
    try {
      await toggleSequenceActive(sequenceId)
    } catch (error) {
      console.error('Failed to toggle sequence status:', error)
    }
  }

  const getSequenceTypeInfo = (type: string) => {
    return sequenceTypes.find(t => t.value === type) || { 
      label: type, 
      icon: '📧', 
      color: 'gray' 
    }
  }

  const getSequenceStats = () => {
    const typeStats = sequenceTypes.reduce((acc, type) => {
      acc[type.value] = sequences.filter(s => s.sequenceType === type.value).length
      return acc
    }, {} as Record<string, number>)

    const recentActivity = sequences
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 5)

    return {
      total: sequences.length,
      active: sequences.filter(s => s.active).length,
      inactive: sequences.filter(s => !s.active).length,
      byType: typeStats,
      recentActivity,
      mostEffective: sequences.sort((a, b) => (b.effectiveness || 0) - (a.effectiveness || 0))[0],
      totalEmailsSent: sequences.reduce((acc, s) => acc + (s.emailsSent || 0), 0),
      averageResponseRate: sequences.reduce((acc, s) => acc + (s.responseRate || 0), 0) / (sequences.length || 1)
    }
  }

  const stats = getSequenceStats()

  if (!session) {
    return (
      <div className="flex items-center justify-center h-96">
        <Mail className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading...</span>
      </div>
    )
  }

  return (
    <UAEErrorBoundary>
      <div className="container mx-auto px-4 py-8 space-y-8">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Target className="h-8 w-8" />
              Follow-up Sequences
            </h1>
            <p className="text-gray-600 mt-2">
              Create automated payment reminder sequences that respect UAE business culture
            </p>
          </div>
          
          <div className="flex items-center gap-4">
            <Button variant="outline" onClick={() => router.push('/dashboard')}>
              Back to Dashboard
            </Button>
            
            <Button variant="outline" onClick={handleCreateFromLibrary}>
              <Sparkles className="h-4 w-4 mr-2" />
              Browse Library
            </Button>
            
            <Button onClick={handleCreateSequence}>
              <Plus className="h-4 w-4 mr-2" />
              Create Sequence
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Sequences</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
              <p className="text-xs text-muted-foreground">
                {stats.active} active, {stats.inactive} inactive
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Emails Sent</CardTitle>
              <Mail className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{stats.totalEmailsSent.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">
                Across all sequences
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Response Rate</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {stats.averageResponseRate.toFixed(1)}%
              </div>
              <p className="text-xs text-muted-foreground">
                Customer engagement
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Most Effective</CardTitle>
              <Zap className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-lg font-bold text-yellow-600">
                {stats.mostEffective?.name || 'N/A'}
              </div>
              <p className="text-xs text-muted-foreground">
                {stats.mostEffective?.effectiveness?.toFixed(1)}% success rate
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>
              Get started with UAE-optimized payment collection sequences
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Button 
                variant="outline" 
                className="h-20 flex flex-col items-center gap-2"
                onClick={handleCreateFromLibrary}
              >
                <Sparkles className="h-6 w-6" />
                <span>Browse Template Library</span>
              </Button>
              
              <Button 
                variant="outline" 
                className="h-20 flex flex-col items-center gap-2"
                onClick={handleCreateSequence}
              >
                <Plus className="h-6 w-6" />
                <span>Create New Sequence</span>
              </Button>
              
              <Button 
                variant="outline" 
                className="h-20 flex flex-col items-center gap-2"
                onClick={() => setActiveTab('analytics')}
              >
                <BarChart3 className="h-6 w-6" />
                <span>View Analytics</span>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Main Content Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="automation">Automation</TabsTrigger>
            <TabsTrigger value="sequences">Sequences</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-6">
            {/* Recent Activity */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
                <CardDescription>
                  Latest sequence updates and performance highlights
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {stats.recentActivity.map((sequence, index) => (
                    <div key={sequence.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="text-xl">
                          {getSequenceTypeInfo(sequence.sequenceType).icon}
                        </div>
                        <div>
                          <h4 className="font-medium">{sequence.name}</h4>
                          <p className="text-sm text-gray-600">
                            Updated {new Date(sequence.updatedAt).toLocaleDateString('en-AE')}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={sequence.active ? "default" : "secondary"}>
                          {sequence.active ? "Active" : "Inactive"}
                        </Badge>
                        <Button variant="ghost" size="sm" onClick={() => handleEditSequence(sequence)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Sequence Type Distribution */}
            <Card>
              <CardHeader>
                <CardTitle>Sequence Types</CardTitle>
                <CardDescription>
                  Distribution of sequence types in your library
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {sequenceTypes.map((type) => (
                    <div key={type.value} className="flex items-center gap-3 p-3 border rounded-lg">
                      <div className="text-2xl">{type.icon}</div>
                      <div>
                        <h4 className="font-medium text-sm">{type.label}</h4>
                        <p className="text-lg font-bold text-gray-600">
                          {stats.byType[type.value] || 0}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="automation" className="space-y-6">
            <AutomationDashboard
              companyId={session?.user?.companyId}
              refreshInterval={30000}
              onSequenceClick={(sequenceId) => {
                setEditingSequence(sequenceId)
                setShowBuilder(true)
              }}
              onInvoiceClick={(invoiceId) => {
                router.push(`/dashboard/invoices/${invoiceId}`)
              }}
            />
          </TabsContent>

          <TabsContent value="sequences" className="space-y-6">
            {/* Filters */}
            <Card>
              <CardHeader>
                <CardTitle>Sequence Management</CardTitle>
                <CardDescription>
                  Manage your automated follow-up sequences
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Search className="h-4 w-4" />
                    <Input
                      placeholder="Search sequences..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-64"
                    />
                  </div>

                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[140px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={typeFilter} onValueChange={setTypeFilter}>
                    <SelectTrigger className="w-[200px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      {sequenceTypes.map(type => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Filter className="h-4 w-4" />
                    Showing {filteredSequences.length} of {sequences.length} sequences
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Sequences List */}
            <Card>
              <CardContent className="p-6">
                {filteredSequences.length > 0 ? (
                  <div className="space-y-4">
                    {filteredSequences.map((sequence) => {
                      const typeInfo = getSequenceTypeInfo(sequence.sequenceType)
                      
                      return (
                        <div
                          key={sequence.id}
                          className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                        >
                          <div className="flex items-center gap-4 flex-1">
                            <div className="text-2xl">{typeInfo.icon}</div>
                            
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <h3 className="font-semibold">{sequence.name}</h3>
                                {sequence.active ? (
                                  <Badge variant="default" className="bg-green-100 text-green-800">
                                    <CheckCircle className="h-3 w-3 mr-1" />
                                    Active
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="text-gray-600">
                                    <XCircle className="h-3 w-3 mr-1" />
                                    Inactive
                                  </Badge>
                                )}
                                <Badge variant="outline">
                                  {typeInfo.label}
                                </Badge>
                              </div>
                              
                              <p className="text-sm text-gray-600 mt-1">
                                {sequence.description}
                              </p>
                              
                              <div className="flex items-center gap-4 text-xs text-gray-500 mt-2">
                                <span>Steps: {sequence.stepCount || 0}</span>
                                <span>Sent: {sequence.emailsSent || 0}</span>
                                <span>Response: {sequence.responseRate?.toFixed(1) || 0}%</span>
                                <span>Updated: {new Date(sequence.updatedAt).toLocaleDateString('en-AE')}</span>
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleTestSequence(sequence)}
                            >
                              <TestTube className="h-4 w-4" />
                            </Button>
                            
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditSequence(sequence)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDuplicateSequence(sequence)}
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                            
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleToggleActive(sequence.id)}
                            >
                              {sequence.active ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                            </Button>
                            
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteSequence(sequence.id)}
                              className="text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Target className="h-16 w-16 mx-auto mb-4 text-gray-400" />
                    <h3 className="text-lg font-semibold mb-2">No sequences found</h3>
                    <p className="text-gray-600 mb-4">
                      Create your first automated follow-up sequence to start collecting payments more efficiently
                    </p>
                    <div className="flex justify-center gap-2">
                      <Button onClick={handleCreateSequence}>
                        <Plus className="h-4 w-4 mr-2" />
                        Create Sequence
                      </Button>
                      <Button variant="outline" onClick={handleCreateFromLibrary}>
                        <Sparkles className="h-4 w-4 mr-2" />
                        Browse Library
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history" className="space-y-6">
            {/* Timeline and History */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Follow-up Timeline</CardTitle>
                  <CardDescription>
                    Recent activity and events across all sequences
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <SequenceTimeline
                    events={[]} // This would be populated with real timeline data
                    autoRefresh={true}
                    refreshInterval={30000}
                    onEventClick={(event) => {
                      console.log('Timeline event clicked:', event)
                    }}
                    onInvoiceClick={(invoiceId) => {
                      router.push(`/dashboard/invoices/${invoiceId}`)
                    }}
                    onCustomerClick={(customerId) => {
                      router.push(`/dashboard/customers/${customerId}`)
                    }}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Email History Summary</CardTitle>
                  <CardDescription>
                    Quick overview of recent email activity
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="text-center p-4 border rounded-lg">
                        <div className="text-2xl font-bold text-blue-600">0</div>
                        <div className="text-sm text-gray-600">Emails Sent Today</div>
                      </div>
                      <div className="text-center p-4 border rounded-lg">
                        <div className="text-2xl font-bold text-green-600">0%</div>
                        <div className="text-sm text-gray-600">Response Rate</div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Detailed History Table */}
            <FollowUpHistoryTable
              records={[]} // This would be populated with real history data
              loading={false}
              onRecordClick={(record) => {
                console.log('History record clicked:', record)
              }}
              onInvoiceClick={(invoiceId) => {
                router.push(`/dashboard/invoices/${invoiceId}`)
              }}
              onCustomerClick={(customerId) => {
                router.push(`/dashboard/customers/${customerId}`)
              }}
              onResendEmail={(recordId) => {
                console.log('Resend email:', recordId)
              }}
              onBulkAction={(action, recordIds) => {
                console.log('Bulk action:', action, recordIds)
              }}
            />
          </TabsContent>

          <TabsContent value="analytics" className="space-y-6">
            <SequenceMetrics
              sequences={sequences.map(seq => ({
                id: seq.id,
                name: seq.name,
                type: seq.sequenceType,
                status: seq.active ? 'ACTIVE' : 'PAUSED',
                metrics: {
                  emailsSent: seq.emailsSent || 0,
                  emailsDelivered: Math.floor((seq.emailsSent || 0) * 0.95),
                  emailsOpened: Math.floor((seq.emailsSent || 0) * 0.35),
                  emailsClicked: Math.floor((seq.emailsSent || 0) * 0.15),
                  responseRate: seq.responseRate || 0,
                  conversionRate: seq.effectiveness || 0,
                  paymentReceived: Math.floor((seq.emailsSent || 0) * 0.1 * 500), // Mock calculation
                  averageResponseTime: Math.random() * 48 + 2, // Mock 2-50 hours
                  bounceRate: Math.random() * 5, // Mock 0-5%
                  unsubscribeRate: Math.random() * 2 // Mock 0-2%
                },
                timeSeriesData: Array.from({ length: 30 }, (_, i) => ({
                  date: new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                  emailsSent: Math.floor(Math.random() * 50),
                  responseRate: Math.random() * 30 + 10,
                  conversionRate: Math.random() * 15 + 5,
                  paymentAmount: Math.random() * 10000
                })),
                stepPerformance: [
                  {
                    stepOrder: 1,
                    stepName: 'Initial Reminder',
                    stepType: 'EMAIL',
                    emailsSent: seq.emailsSent || 0,
                    responseRate: (seq.responseRate || 0) * 1.2,
                    effectiveness: (seq.effectiveness || 0) * 1.1
                  },
                  {
                    stepOrder: 2,
                    stepName: 'Follow-up Notice',
                    stepType: 'EMAIL',
                    emailsSent: Math.floor((seq.emailsSent || 0) * 0.7),
                    responseRate: (seq.responseRate || 0) * 0.9,
                    effectiveness: (seq.effectiveness || 0) * 0.8
                  }
                ],
                uaeMetrics: {
                  businessHoursCompliance: seq.uaeBusinessHoursOnly ? 100 : 70,
                  holidayRespect: seq.respectHolidays ? 100 : 60,
                  prayerTimeAvoidance: 95,
                  culturalAppropriatenesScore: 85
                }
              }))}
              timeRange="30d"
              onTimeRangeChange={(range) => {
                console.log('Time range changed:', range)
              }}
              companyId={session?.user?.companyId}
            />
          </TabsContent>

          <TabsContent value="settings" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>UAE Business Settings</CardTitle>
                <CardDescription>
                  Configure settings for UAE business hours and cultural preferences
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12">
                  <Settings className="h-16 w-16 mx-auto mb-4 text-gray-400" />
                  <h3 className="text-lg font-semibold mb-2">Settings Panel</h3>
                  <p className="text-gray-600">
                    UAE business hours, holiday calendar, and cultural settings
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Sequence Builder Dialog */}
        <Dialog open={showBuilder} onOpenChange={setShowBuilder}>
          <DialogContent className="max-w-7xl h-[95vh]">
            <DialogHeader>
              <DialogTitle>
                {editingSequence ? 'Edit Sequence' : 'Create New Sequence'}
              </DialogTitle>
              <DialogDescription>
                Build automated follow-up sequences with UAE business logic
              </DialogDescription>
            </DialogHeader>
            
            <div className="flex-1 overflow-hidden">
              <SequenceBuilder
                sequenceId={editingSequence || undefined}
                onSave={() => {
                  setShowBuilder(false)
                  setEditingSequence(null)
                  if (session?.user?.companyId) {
                    fetchSequences(session.user.companyId)
                  }
                }}
                onCancel={() => {
                  setShowBuilder(false)
                  setEditingSequence(null)
                }}
              />
            </div>
          </DialogContent>
        </Dialog>

        {/* Sequence Library Dialog */}
        <Dialog open={showLibrary} onOpenChange={setShowLibrary}>
          <DialogContent className="max-w-6xl h-[90vh]">
            <DialogHeader>
              <DialogTitle>
                UAE Business Sequence Library
              </DialogTitle>
              <DialogDescription>
                Choose from pre-built sequences optimized for UAE business culture
              </DialogDescription>
            </DialogHeader>
            
            <div className="flex-1 overflow-auto">
              <SequenceLibrary
                onImport={async (librarySequence) => {
                  try {
                    const sequenceData = {
                      companyId: session?.user?.companyId,
                      name: librarySequence.name,
                      description: librarySequence.description,
                      sequenceType: librarySequence.sequenceType,
                      steps: librarySequence.steps,
                      active: false,
                      uaeBusinessHoursOnly: true,
                      respectHolidays: true
                    }
                    
                    await addSequence(sequenceData)
                    if (session?.user?.companyId) {
                      fetchSequences(session.user.companyId)
                    }
                    setShowLibrary(false)
                  } catch (error) {
                    console.error('Failed to import sequence:', error)
                  }
                }}
                onClose={() => setShowLibrary(false)}
              />
            </div>
          </DialogContent>
        </Dialog>

        {/* Sequence Tester Dialog */}
        <Dialog open={showTester} onOpenChange={setShowTester}>
          <DialogContent className="max-w-6xl h-[90vh]">
            <DialogHeader>
              <DialogTitle>
                Test Sequence - {selectedSequence?.name}
              </DialogTitle>
              <DialogDescription>
                Simulate your sequence with test data and UAE calendar integration
              </DialogDescription>
            </DialogHeader>
            
            <div className="flex-1 overflow-auto">
              {selectedSequence && (
                <SequenceTester
                  sequence={selectedSequence}
                  onClose={() => setShowTester(false)}
                />
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </UAEErrorBoundary>
  )
}