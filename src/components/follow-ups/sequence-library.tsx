'use client'

import { useState } from 'react'
import { 
  Search, 
  Filter, 
  Download, 
  Star, 
  Clock, 
  Users, 
  TrendingUp,
  CheckCircle,
  ArrowRight,
  Heart,
  Zap,
  Timer,
  Calendar,
  Globe,
  Target,
  Mail,
  Shield
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { cn } from '@/lib/utils'

interface SequenceLibraryProps {
  onImport: (sequence: UAESequenceTemplate) => void
  onClose: () => void
}

interface UAESequenceTemplate {
  id: string
  name: string
  description: string
  sequenceType: string
  category: 'COLLECTION' | 'RELATIONSHIP' | 'LEGAL' | 'CUSTOM'
  difficulty: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED'
  popularity: number
  effectiveness: number
  industryFocus?: string[]
  steps: SequenceStep[]
  uaeSpecific: {
    respectsBusinessHours: boolean
    honorsPrayerTimes: boolean
    respectsHolidays: boolean
    culturallyAppropriate: boolean
    bilingualSupport: boolean
  }
  previewImages?: string[]
  tags: string[]
}

interface SequenceStep {
  id: string
  order: number
  type: 'EMAIL' | 'WAIT' | 'CONDITION' | 'ACTION'
  name: string
  description: string
  timing: {
    delay: number
    unit: 'HOURS' | 'DAYS' | 'WEEKS'
    businessHoursOnly: boolean
    avoidWeekends: boolean
    avoidHolidays: boolean
  }
  template?: {
    subjectEn: string
    subjectAr?: string
    tone: 'GENTLE' | 'PROFESSIONAL' | 'FIRM' | 'URGENT'
    contentPreview: string
  }
  conditions?: any[]
}

export function SequenceLibrary({ onImport, onClose }: SequenceLibraryProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [difficultyFilter, setDifficultyFilter] = useState('all')
  const [selectedSequence, setSelectedSequence] = useState<UAESequenceTemplate | null>(null)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')

  // Pre-built UAE Business Sequence Templates
  const sequenceTemplates: UAESequenceTemplate[] = [
    {
      id: 'gentle-collection-3-7-14',
      name: 'Gentle Collection (3-7-14 Days)',
      description: 'Most popular UAE business sequence. Maintains relationships while ensuring payment collection.',
      sequenceType: 'GENTLE_COLLECTION',
      category: 'COLLECTION',
      difficulty: 'BEGINNER',
      popularity: 95,
      effectiveness: 87.5,
      industryFocus: ['Retail', 'Services', 'Consulting', 'Technology'],
      steps: [
        {
          id: 'step-1',
          order: 1,
          type: 'EMAIL',
          name: 'Gentle Reminder',
          description: 'Friendly reminder with assumption of oversight',
          timing: {
            delay: 3,
            unit: 'DAYS',
            businessHoursOnly: true,
            avoidWeekends: true,
            avoidHolidays: true
          },
          template: {
            subjectEn: 'Friendly Payment Reminder - Invoice {{invoiceNumber}}',
            subjectAr: 'تذكير ودود بالدفع - فاتورة {{invoiceNumber}}',
            tone: 'GENTLE',
            contentPreview: 'Hope this message finds you well. We wanted to gently remind you about the pending payment for invoice {{invoiceNumber}}...'
          }
        },
        {
          id: 'step-2',
          order: 2,
          type: 'EMAIL',
          name: 'Professional Follow-up',
          description: 'More formal but still respectful approach',
          timing: {
            delay: 7,
            unit: 'DAYS',
            businessHoursOnly: true,
            avoidWeekends: true,
            avoidHolidays: true
          },
          template: {
            subjectEn: 'Payment Required - Invoice {{invoiceNumber}}',
            subjectAr: 'مطلوب الدفع - فاتورة {{invoiceNumber}}',
            tone: 'PROFESSIONAL',
            contentPreview: 'We have not yet received payment for invoice {{invoiceNumber}}. We value our business relationship...'
          }
        },
        {
          id: 'step-3',
          order: 3,
          type: 'EMAIL',
          name: 'Firm Notice',
          description: 'Clear expectation setting while maintaining respect',
          timing: {
            delay: 14,
            unit: 'DAYS',
            businessHoursOnly: true,
            avoidWeekends: true,
            avoidHolidays: true
          },
          template: {
            subjectEn: 'Urgent: Payment Overdue - Invoice {{invoiceNumber}}',
            subjectAr: 'عاجل: الدفع متأخر - فاتورة {{invoiceNumber}}',
            tone: 'FIRM',
            contentPreview: 'This is to inform you that payment for invoice {{invoiceNumber}} is now {{daysPastDue}} days overdue...'
          }
        }
      ],
      uaeSpecific: {
        respectsBusinessHours: true,
        honorsPrayerTimes: true,
        respectsHolidays: true,
        culturallyAppropriate: true,
        bilingualSupport: true
      },
      tags: ['Popular', 'Gentle', 'Relationship-Focused', 'UAE-Optimized']
    },
    {
      id: 'professional-standard-3-7-15-30',
      name: 'Professional Standard (3-7-15-30 Days)',
      description: 'Balanced approach suitable for most B2B transactions in UAE.',
      sequenceType: 'PROFESSIONAL_STANDARD',
      category: 'COLLECTION',
      difficulty: 'BEGINNER',
      popularity: 88,
      effectiveness: 82.3,
      industryFocus: ['Manufacturing', 'Distribution', 'Construction', 'Healthcare'],
      steps: [
        {
          id: 'step-1',
          order: 1,
          type: 'EMAIL',
          name: 'Initial Reminder',
          description: 'Professional first contact',
          timing: {
            delay: 3,
            unit: 'DAYS',
            businessHoursOnly: true,
            avoidWeekends: true,
            avoidHolidays: true
          },
          template: {
            subjectEn: 'Payment Reminder - Invoice {{invoiceNumber}}',
            subjectAr: 'تذكير بالدفع - فاتورة {{invoiceNumber}}',
            tone: 'PROFESSIONAL',
            contentPreview: 'This is a reminder that payment for invoice {{invoiceNumber}} was due on {{dueDate}}...'
          }
        },
        {
          id: 'step-2',
          order: 2,
          type: 'EMAIL',
          name: 'Second Notice',
          description: 'Formal second reminder',
          timing: {
            delay: 7,
            unit: 'DAYS',
            businessHoursOnly: true,
            avoidWeekends: true,
            avoidHolidays: true
          },
          template: {
            subjectEn: 'Second Notice - Payment Required for Invoice {{invoiceNumber}}',
            subjectAr: 'إشعار ثاني - مطلوب الدفع للفاتورة {{invoiceNumber}}',
            tone: 'PROFESSIONAL',
            contentPreview: 'We have not received payment for invoice {{invoiceNumber}}. Please arrange payment immediately...'
          }
        },
        {
          id: 'step-3',
          order: 3,
          type: 'EMAIL',
          name: 'Formal Notice',
          description: 'Clear statement of consequences',
          timing: {
            delay: 15,
            unit: 'DAYS',
            businessHoursOnly: true,
            avoidWeekends: true,
            avoidHolidays: true
          },
          template: {
            subjectEn: 'Formal Notice - Overdue Payment for Invoice {{invoiceNumber}}',
            subjectAr: 'إشعار رسمي - دفع متأخر للفاتورة {{invoiceNumber}}',
            tone: 'FIRM',
            contentPreview: 'This is a formal notice that payment for invoice {{invoiceNumber}} is seriously overdue...'
          }
        },
        {
          id: 'step-4',
          order: 4,
          type: 'EMAIL',
          name: 'Final Notice',
          description: 'Last attempt before escalation',
          timing: {
            delay: 30,
            unit: 'DAYS',
            businessHoursOnly: true,
            avoidWeekends: true,
            avoidHolidays: true
          },
          template: {
            subjectEn: 'FINAL NOTICE - Invoice {{invoiceNumber}}',
            subjectAr: 'إشعار أخير - فاتورة {{invoiceNumber}}',
            tone: 'URGENT',
            contentPreview: 'This is the final notice before we refer this matter for collection action...'
          }
        }
      ],
      uaeSpecific: {
        respectsBusinessHours: true,
        honorsPrayerTimes: true,
        respectsHolidays: true,
        culturallyAppropriate: true,
        bilingualSupport: true
      },
      tags: ['Professional', 'Standard', 'B2B', 'Balanced']
    },
    {
      id: 'relationship-preserving-5-10-20-35',
      name: 'Relationship Preserving (5-10-20-35 Days)',
      description: 'Emphasizes long-term business relationships while collecting payments.',
      sequenceType: 'RELATIONSHIP_PRESERVING',
      category: 'RELATIONSHIP',
      difficulty: 'INTERMEDIATE',
      popularity: 76,
      effectiveness: 79.2,
      industryFocus: ['Luxury', 'High-Value Services', 'Long-term Contracts'],
      steps: [
        {
          id: 'step-1',
          order: 1,
          type: 'EMAIL',
          name: 'Courtesy Check',
          description: 'Personal touch with genuine concern',
          timing: {
            delay: 5,
            unit: 'DAYS',
            businessHoursOnly: true,
            avoidWeekends: true,
            avoidHolidays: true
          },
          template: {
            subjectEn: 'Checking In - Invoice {{invoiceNumber}}',
            subjectAr: 'استفسار - فاتورة {{invoiceNumber}}',
            tone: 'GENTLE',
            contentPreview: 'Hope all is well with you and your business. We wanted to check if everything is okay regarding invoice {{invoiceNumber}}...'
          }
        },
        {
          id: 'step-2',
          order: 2,
          type: 'EMAIL',
          name: 'Partnership Reminder',
          description: 'Emphasize business relationship value',
          timing: {
            delay: 10,
            unit: 'DAYS',
            businessHoursOnly: true,
            avoidWeekends: true,
            avoidHolidays: true
          },
          template: {
            subjectEn: 'Our Partnership - Payment for Invoice {{invoiceNumber}}',
            subjectAr: 'شراكتنا - دفع فاتورة {{invoiceNumber}}',
            tone: 'PROFESSIONAL',
            contentPreview: 'We value our business partnership and wanted to discuss the outstanding payment for invoice {{invoiceNumber}}...'
          }
        },
        {
          id: 'step-3',
          order: 3,
          type: 'EMAIL',
          name: 'Professional Notice',
          description: 'Formal but relationship-focused',
          timing: {
            delay: 20,
            unit: 'DAYS',
            businessHoursOnly: true,
            avoidWeekends: true,
            avoidHolidays: true
          },
          template: {
            subjectEn: 'Important: Outstanding Payment - Invoice {{invoiceNumber}}',
            subjectAr: 'مهم: دفع مستحق - فاتورة {{invoiceNumber}}',
            tone: 'PROFESSIONAL',
            contentPreview: 'We need to address the outstanding payment for invoice {{invoiceNumber}} to maintain our positive business relationship...'
          }
        },
        {
          id: 'step-4',
          order: 4,
          type: 'EMAIL',
          name: 'Final Partnership Appeal',
          description: 'Last attempt to preserve relationship',
          timing: {
            delay: 35,
            unit: 'DAYS',
            businessHoursOnly: true,
            avoidWeekends: true,
            avoidHolidays: true
          },
          template: {
            subjectEn: 'Final Appeal - Preserving Our Partnership',
            subjectAr: 'نداء أخير - الحفاظ على شراكتنا',
            tone: 'FIRM',
            contentPreview: 'Before taking further action, we want to give you one final opportunity to settle invoice {{invoiceNumber}} and preserve our valuable partnership...'
          }
        }
      ],
      uaeSpecific: {
        respectsBusinessHours: true,
        honorsPrayerTimes: true,
        respectsHolidays: true,
        culturallyAppropriate: true,
        bilingualSupport: true
      },
      tags: ['Relationship-First', 'High-Value', 'Partnership', 'Gentle']
    },
    {
      id: 'quick-collection-1-3-7',
      name: 'Quick Collection (1-3-7 Days)',
      description: 'Fast-paced sequence for urgent collections while maintaining professionalism.',
      sequenceType: 'QUICK_COLLECTION',
      category: 'COLLECTION',
      difficulty: 'ADVANCED',
      popularity: 65,
      effectiveness: 91.7,
      industryFocus: ['Fast-moving Goods', 'Services', 'Small Transactions'],
      steps: [
        {
          id: 'step-1',
          order: 1,
          type: 'EMAIL',
          name: 'Immediate Reminder',
          description: 'Prompt professional reminder',
          timing: {
            delay: 1,
            unit: 'DAYS',
            businessHoursOnly: true,
            avoidWeekends: true,
            avoidHolidays: true
          },
          template: {
            subjectEn: 'Payment Due - Invoice {{invoiceNumber}}',
            subjectAr: 'الدفع مستحق - فاتورة {{invoiceNumber}}',
            tone: 'PROFESSIONAL',
            contentPreview: 'Your payment for invoice {{invoiceNumber}} is now due. Please arrange immediate payment...'
          }
        },
        {
          id: 'step-2',
          order: 2,
          type: 'EMAIL',
          name: 'Urgent Follow-up',
          description: 'Clear urgency while remaining respectful',
          timing: {
            delay: 3,
            unit: 'DAYS',
            businessHoursOnly: true,
            avoidWeekends: true,
            avoidHolidays: true
          },
          template: {
            subjectEn: 'URGENT: Payment Overdue - Invoice {{invoiceNumber}}',
            subjectAr: 'عاجل: الدفع متأخر - فاتورة {{invoiceNumber}}',
            tone: 'FIRM',
            contentPreview: 'Payment for invoice {{invoiceNumber}} is now overdue. Immediate action is required...'
          }
        },
        {
          id: 'step-3',
          order: 3,
          type: 'EMAIL',
          name: 'Final Demand',
          description: 'Last notice before escalation',
          timing: {
            delay: 7,
            unit: 'DAYS',
            businessHoursOnly: true,
            avoidWeekends: true,
            avoidHolidays: true
          },
          template: {
            subjectEn: 'FINAL DEMAND - Invoice {{invoiceNumber}}',
            subjectAr: 'مطالبة أخيرة - فاتورة {{invoiceNumber}}',
            tone: 'URGENT',
            contentPreview: 'This is your final notice. Payment must be received within 24 hours to avoid further action...'
          }
        }
      ],
      uaeSpecific: {
        respectsBusinessHours: true,
        honorsPrayerTimes: true,
        respectsHolidays: true,
        culturallyAppropriate: true,
        bilingualSupport: true
      },
      tags: ['Fast', 'Urgent', 'High-Effectiveness', 'Short-Term']
    },
    {
      id: 'firm-recovery-7-14-30-45',
      name: 'Firm Recovery (7-14-30-45 Days)',
      description: 'Direct approach for difficult collections while respecting UAE business customs.',
      sequenceType: 'FIRM_RECOVERY',
      category: 'COLLECTION',
      difficulty: 'ADVANCED',
      popularity: 58,
      effectiveness: 85.1,
      industryFocus: ['Manufacturing', 'Construction', 'Large Transactions'],
      steps: [
        {
          id: 'step-1',
          order: 1,
          type: 'EMAIL',
          name: 'Direct Notice',
          description: 'Clear, direct communication',
          timing: {
            delay: 7,
            unit: 'DAYS',
            businessHoursOnly: true,
            avoidWeekends: true,
            avoidHolidays: true
          },
          template: {
            subjectEn: 'Payment Required - Invoice {{invoiceNumber}}',
            subjectAr: 'مطلوب الدفع - فاتورة {{invoiceNumber}}',
            tone: 'FIRM',
            contentPreview: 'Payment for invoice {{invoiceNumber}} is overdue. We require immediate settlement...'
          }
        },
        {
          id: 'step-2',
          order: 2,
          type: 'EMAIL',
          name: 'Formal Demand',
          description: 'Legal tone with clear consequences',
          timing: {
            delay: 14,
            unit: 'DAYS',
            businessHoursOnly: true,
            avoidWeekends: true,
            avoidHolidays: true
          },
          template: {
            subjectEn: 'Formal Demand - Invoice {{invoiceNumber}}',
            subjectAr: 'مطالبة رسمية - فاتورة {{invoiceNumber}}',
            tone: 'FIRM',
            contentPreview: 'This constitutes a formal demand for payment of invoice {{invoiceNumber}}. Failure to pay may result in legal action...'
          }
        },
        {
          id: 'step-3',
          order: 3,
          type: 'EMAIL',
          name: 'Pre-Legal Notice',
          description: 'Warning of impending legal action',
          timing: {
            delay: 30,
            unit: 'DAYS',
            businessHoursOnly: true,
            avoidWeekends: true,
            avoidHolidays: true
          },
          template: {
            subjectEn: 'Notice of Intent - Legal Action for Invoice {{invoiceNumber}}',
            subjectAr: 'إشعار بالنية - إجراء قانوني للفاتورة {{invoiceNumber}}',
            tone: 'URGENT',
            contentPreview: 'Unless payment is received within 7 days, this matter will be referred to our legal department...'
          }
        },
        {
          id: 'step-4',
          order: 4,
          type: 'ACTION',
          name: 'Legal Referral',
          description: 'Automatic escalation to legal team',
          timing: {
            delay: 45,
            unit: 'DAYS',
            businessHoursOnly: true,
            avoidWeekends: true,
            avoidHolidays: true
          }
        }
      ],
      uaeSpecific: {
        respectsBusinessHours: true,
        honorsPrayerTimes: true,
        respectsHolidays: true,
        culturallyAppropriate: false,
        bilingualSupport: true
      },
      tags: ['Firm', 'Legal', 'High-Value', 'Recovery']
    },
    {
      id: 'extended-courtesy-7-14-21-45-60',
      name: 'Extended Courtesy (7-14-21-45-60 Days)',
      description: 'Maximum patience approach for valued long-term clients.',
      sequenceType: 'EXTENDED_COURTESY',
      category: 'RELATIONSHIP',
      difficulty: 'INTERMEDIATE',
      popularity: 42,
      effectiveness: 72.8,
      industryFocus: ['Enterprise', 'Government', 'Strategic Accounts'],
      steps: [
        {
          id: 'step-1',
          order: 1,
          type: 'EMAIL',
          name: 'Gentle Inquiry',
          description: 'Very soft initial approach',
          timing: {
            delay: 7,
            unit: 'DAYS',
            businessHoursOnly: true,
            avoidWeekends: true,
            avoidHolidays: true
          },
          template: {
            subjectEn: 'Account Inquiry - Invoice {{invoiceNumber}}',
            subjectAr: 'استفسار حساب - فاتورة {{invoiceNumber}}',
            tone: 'GENTLE',
            contentPreview: 'We hope this message finds you well. We wanted to inquire about the status of invoice {{invoiceNumber}}...'
          }
        },
        {
          id: 'step-2',
          order: 2,
          type: 'EMAIL',
          name: 'Friendly Reminder',
          description: 'Maintains gentle tone',
          timing: {
            delay: 14,
            unit: 'DAYS',
            businessHoursOnly: true,
            avoidWeekends: true,
            avoidHolidays: true
          },
          template: {
            subjectEn: 'Friendly Reminder - Invoice {{invoiceNumber}}',
            subjectAr: 'تذكير ودود - فاتورة {{invoiceNumber}}',
            tone: 'GENTLE',
            contentPreview: 'Just a friendly reminder about invoice {{invoiceNumber}}. We understand that sometimes invoices can be overlooked...'
          }
        },
        {
          id: 'step-3',
          order: 3,
          type: 'EMAIL',
          name: 'Account Review',
          description: 'Professional follow-up',
          timing: {
            delay: 21,
            unit: 'DAYS',
            businessHoursOnly: true,
            avoidWeekends: true,
            avoidHolidays: true
          },
          template: {
            subjectEn: 'Account Review - Invoice {{invoiceNumber}}',
            subjectAr: 'مراجعة الحساب - فاتورة {{invoiceNumber}}',
            tone: 'PROFESSIONAL',
            contentPreview: 'We are conducting a review of outstanding accounts and noted that invoice {{invoiceNumber}} remains unpaid...'
          }
        },
        {
          id: 'step-4',
          order: 4,
          type: 'EMAIL',
          name: 'Management Notice',
          description: 'Escalation to management level',
          timing: {
            delay: 45,
            unit: 'DAYS',
            businessHoursOnly: true,
            avoidWeekends: true,
            avoidHolidays: true
          },
          template: {
            subjectEn: 'Management Notice - Outstanding Invoice {{invoiceNumber}}',
            subjectAr: 'إشعار الإدارة - فاتورة مستحقة {{invoiceNumber}}',
            tone: 'PROFESSIONAL',
            contentPreview: 'This matter has been escalated to management. We need to address the outstanding payment for invoice {{invoiceNumber}}...'
          }
        },
        {
          id: 'step-5',
          order: 5,
          type: 'EMAIL',
          name: 'Final Courtesy Notice',
          description: 'Last diplomatic attempt',
          timing: {
            delay: 60,
            unit: 'DAYS',
            businessHoursOnly: true,
            avoidWeekends: true,
            avoidHolidays: true
          },
          template: {
            subjectEn: 'Final Courtesy Notice - Invoice {{invoiceNumber}}',
            subjectAr: 'إشعار مجاملة أخير - فاتورة {{invoiceNumber}}',
            tone: 'FIRM',
            contentPreview: 'As a valued client, we are extending one final courtesy notice for the settlement of invoice {{invoiceNumber}}...'
          }
        }
      ],
      uaeSpecific: {
        respectsBusinessHours: true,
        honorsPrayerTimes: true,
        respectsHolidays: true,
        culturallyAppropriate: true,
        bilingualSupport: true
      },
      tags: ['Extended', 'Courtesy', 'VIP', 'Long-term']
    }
  ]

  const filteredTemplates = sequenceTemplates.filter(template => {
    const matchesSearch = template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         template.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         template.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
    
    const matchesCategory = categoryFilter === 'all' || template.category === categoryFilter
    const matchesDifficulty = difficultyFilter === 'all' || template.difficulty === difficultyFilter

    return matchesSearch && matchesCategory && matchesDifficulty
  })

  const categories = [
    { value: 'COLLECTION', label: 'Collection Focus', icon: '💰', color: 'blue' },
    { value: 'RELATIONSHIP', label: 'Relationship Focus', icon: '🤝', color: 'green' },
    { value: 'LEGAL', label: 'Legal Approach', icon: '⚖️', color: 'red' },
    { value: 'CUSTOM', label: 'Custom Solutions', icon: '🎨', color: 'purple' }
  ]

  const difficulties = [
    { value: 'BEGINNER', label: 'Beginner', icon: '🟢', description: 'Easy to use and configure' },
    { value: 'INTERMEDIATE', label: 'Intermediate', icon: '🟡', description: 'Requires some customization' },
    { value: 'ADVANCED', label: 'Advanced', icon: '🔴', description: 'Complex setup and targeting' }
  ]

  const getDifficultyInfo = (difficulty: string) => {
    return difficulties.find(d => d.value === difficulty) || difficulties[0]
  }

  const getCategoryInfo = (category: string) => {
    return categories.find(c => c.value === category) || categories[0]
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">UAE Business Sequence Library</h2>
          <p className="text-gray-600">
            Pre-built sequences optimized for UAE business culture and practices
          </p>
        </div>
        <Button variant="outline" onClick={onClose}>
          Close
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4" />
              <Input
                placeholder="Search templates..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-64"
              />
            </div>

            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map(category => (
                  <SelectItem key={category.value} value={category.value}>
                    {category.icon} {category.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={difficultyFilter} onValueChange={setDifficultyFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Levels</SelectItem>
                {difficulties.map(difficulty => (
                  <SelectItem key={difficulty.value} value={difficulty.value}>
                    {difficulty.icon} {difficulty.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Filter className="h-4 w-4" />
              {filteredTemplates.length} of {sequenceTemplates.length} templates
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Templates Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {filteredTemplates.map((template) => {
          const categoryInfo = getCategoryInfo(template.category)
          const difficultyInfo = getDifficultyInfo(template.difficulty)
          
          return (
            <Card key={template.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold text-lg">{template.name}</h3>
                      {template.popularity > 80 && (
                        <Badge variant="default" className="bg-yellow-100 text-yellow-800">
                          <Star className="h-3 w-3 mr-1" />
                          Popular
                        </Badge>
                      )}
                    </div>
                    
                    <p className="text-gray-600 text-sm mb-3">
                      {template.description}
                    </p>

                    <div className="flex flex-wrap gap-2 mb-3">
                      <Badge variant="outline">
                        {categoryInfo.icon} {categoryInfo.label}
                      </Badge>
                      <Badge variant="outline">
                        {difficultyInfo.icon} {difficultyInfo.label}
                      </Badge>
                      <Badge variant="outline">
                        <Timer className="h-3 w-3 mr-1" />
                        {template.steps.length} Steps
                      </Badge>
                    </div>
                  </div>
                  
                  <div className="text-right ml-4">
                    <div className="text-2xl font-bold text-green-600">
                      {template.effectiveness.toFixed(1)}%
                    </div>
                    <div className="text-xs text-gray-500">Effectiveness</div>
                  </div>
                </div>
              </CardHeader>

              <CardContent>
                {/* UAE Specific Features */}
                <div className="mb-4">
                  <h4 className="font-medium mb-2 text-sm">UAE Business Features:</h4>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="flex items-center gap-1">
                      {template.uaeSpecific.respectsBusinessHours ? (
                        <CheckCircle className="h-3 w-3 text-green-500" />
                      ) : (
                        <XCircle className="h-3 w-3 text-red-500" />
                      )}
                      <span>Business Hours</span>
                    </div>
                    <div className="flex items-center gap-1">
                      {template.uaeSpecific.honorsPrayerTimes ? (
                        <CheckCircle className="h-3 w-3 text-green-500" />
                      ) : (
                        <XCircle className="h-3 w-3 text-red-500" />
                      )}
                      <span>Prayer Times</span>
                    </div>
                    <div className="flex items-center gap-1">
                      {template.uaeSpecific.respectsHolidays ? (
                        <CheckCircle className="h-3 w-3 text-green-500" />
                      ) : (
                        <XCircle className="h-3 w-3 text-red-500" />
                      )}
                      <span>UAE Holidays</span>
                    </div>
                    <div className="flex items-center gap-1">
                      {template.uaeSpecific.bilingualSupport ? (
                        <CheckCircle className="h-3 w-3 text-green-500" />
                      ) : (
                        <XCircle className="h-3 w-3 text-red-500" />
                      )}
                      <span>Arabic Support</span>
                    </div>
                  </div>
                </div>

                {/* Sequence Steps Preview */}
                <div className="mb-4">
                  <h4 className="font-medium mb-2 text-sm">Sequence Timeline:</h4>
                  <div className="space-y-2">
                    {template.steps.slice(0, 3).map((step, index) => (
                      <div key={step.id} className="flex items-center gap-3 text-xs">
                        <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-medium">
                          {index + 1}
                        </div>
                        <div className="flex-1">
                          <div className="font-medium">{step.name}</div>
                          <div className="text-gray-500">
                            Day {step.timing.delay} • {step.template?.tone || 'Action'}
                          </div>
                        </div>
                        <ArrowRight className="h-3 w-3 text-gray-400" />
                      </div>
                    ))}
                    {template.steps.length > 3 && (
                      <div className="text-xs text-gray-500 pl-9">
                        +{template.steps.length - 3} more steps...
                      </div>
                    )}
                  </div>
                </div>

                {/* Industry Focus */}
                {template.industryFocus && (
                  <div className="mb-4">
                    <h4 className="font-medium mb-2 text-sm">Best For Industries:</h4>
                    <div className="flex flex-wrap gap-1">
                      {template.industryFocus.slice(0, 3).map((industry, index) => (
                        <Badge key={index} variant="secondary" className="text-xs">
                          {industry}
                        </Badge>
                      ))}
                      {template.industryFocus.length > 3 && (
                        <Badge variant="secondary" className="text-xs">
                          +{template.industryFocus.length - 3} more
                        </Badge>
                      )}
                    </div>
                  </div>
                )}

                {/* Stats */}
                <div className="flex items-center justify-between text-xs text-gray-500 mb-4">
                  <div className="flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    {template.popularity}% popularity
                  </div>
                  <div className="flex items-center gap-1">
                    <TrendingUp className="h-3 w-3" />
                    {template.effectiveness.toFixed(1)}% effective
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {template.steps.length} steps
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <Button 
                    className="flex-1"
                    onClick={() => onImport(template)}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Import Template
                  </Button>
                  <Button 
                    variant="outline"
                    onClick={() => setSelectedSequence(template)}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {filteredTemplates.length === 0 && (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <Search className="h-16 w-16 mx-auto mb-4 text-gray-400" />
              <h3 className="text-lg font-semibold mb-2">No templates found</h3>
              <p className="text-gray-600">
                Try adjusting your search criteria or browse all templates
              </p>
              <Button 
                variant="outline" 
                className="mt-4"
                onClick={() => {
                  setSearchQuery('')
                  setCategoryFilter('all')
                  setDifficultyFilter('all')
                }}
              >
                Clear Filters
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Detailed Template View Modal */}
      {selectedSequence && (
        <Dialog open={!!selectedSequence} onOpenChange={() => setSelectedSequence(null)}>
          <DialogContent className="max-w-4xl h-[90vh]">
            <DialogHeader>
              <DialogTitle>{selectedSequence.name}</DialogTitle>
              <DialogDescription>
                Detailed view of the sequence template
              </DialogDescription>
            </DialogHeader>
            
            <div className="flex-1 overflow-auto space-y-6">
              {/* Template Overview */}
              <div>
                <h3 className="font-semibold mb-3">Overview</h3>
                <p className="text-gray-600 mb-4">{selectedSequence.description}</p>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-medium mb-2">Template Details</h4>
                    <div className="space-y-1 text-sm">
                      <div>Category: {getCategoryInfo(selectedSequence.category).label}</div>
                      <div>Difficulty: {getDifficultyInfo(selectedSequence.difficulty).label}</div>
                      <div>Steps: {selectedSequence.steps.length}</div>
                      <div>Effectiveness: {selectedSequence.effectiveness.toFixed(1)}%</div>
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="font-medium mb-2">UAE Features</h4>
                    <div className="space-y-1 text-sm">
                      <div className="flex items-center gap-2">
                        {selectedSequence.uaeSpecific.respectsBusinessHours ? (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-500" />
                        )}
                        Respects Business Hours
                      </div>
                      <div className="flex items-center gap-2">
                        {selectedSequence.uaeSpecific.bilingualSupport ? (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-500" />
                        )}
                        Arabic/English Support
                      </div>
                      <div className="flex items-center gap-2">
                        {selectedSequence.uaeSpecific.culturallyAppropriate ? (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        ) : (
                          <AlertCircle className="h-4 w-4 text-yellow-500" />
                        )}
                        Culturally Appropriate
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Detailed Steps */}
              <div>
                <h3 className="font-semibold mb-3">Sequence Steps</h3>
                <div className="space-y-4">
                  {selectedSequence.steps.map((step, index) => (
                    <Card key={step.id}>
                      <CardContent className="p-4">
                        <div className="flex items-start gap-4">
                          <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-medium">
                            {index + 1}
                          </div>
                          
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h4 className="font-medium">{step.name}</h4>
                              <Badge variant="outline">{step.type}</Badge>
                              {step.template && (
                                <Badge variant="secondary">{step.template.tone}</Badge>
                              )}
                            </div>
                            
                            <p className="text-gray-600 text-sm mb-3">{step.description}</p>
                            
                            <div className="grid grid-cols-2 gap-4 text-sm">
                              <div>
                                <strong>Timing:</strong> {step.timing.delay} {step.timing.unit.toLowerCase()} after trigger
                              </div>
                              <div>
                                <strong>Business Hours:</strong> {step.timing.businessHoursOnly ? 'Yes' : 'No'}
                              </div>
                            </div>
                            
                            {step.template && (
                              <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                                <div className="text-sm font-medium mb-1">Email Subject (EN):</div>
                                <div className="text-sm text-gray-600 mb-2">{step.template.subjectEn}</div>
                                {step.template.subjectAr && (
                                  <>
                                    <div className="text-sm font-medium mb-1">Email Subject (AR):</div>
                                    <div className="text-sm text-gray-600 mb-2">{step.template.subjectAr}</div>
                                  </>
                                )}
                                <div className="text-sm font-medium mb-1">Content Preview:</div>
                                <div className="text-sm text-gray-600">{step.template.contentPreview}</div>
                              </div>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>

              {/* Import Action */}
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setSelectedSequence(null)}>
                  Close
                </Button>
                <Button onClick={() => {
                  onImport(selectedSequence)
                  setSelectedSequence(null)
                }}>
                  <Download className="h-4 w-4 mr-2" />
                  Import This Template
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}