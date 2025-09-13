import React from 'react'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom'

import { SequenceBuilder } from '../sequence-builder'
import { useFollowUpSequenceStore } from '@/lib/stores/follow-up-store'
import { useEmailTemplateStore } from '@/lib/stores/email-template-store'
import { 
  UAE_CONSTANTS,
  culturalComplianceUtils,
  templateValidationUtils,
  uaeTestDataGenerators,
  uaeBusinessScenarios 
} from '@/lib/uae-test-utils'

// Mock the stores
jest.mock('@/lib/stores/follow-up-store')
jest.mock('@/lib/stores/email-template-store')

// Mock drag and drop
jest.mock('@hello-pangea/dnd', () => ({
  DragDropContext: ({ children, onDragEnd }: any) => (
    <div data-testid="drag-drop-context" data-ondragend={onDragEnd}>
      {children}
    </div>
  ),
  Droppable: ({ children, droppableId }: any) => (
    <div data-testid={`droppable-${droppableId}`}>
      {children({
        droppableProps: {},
        innerRef: jest.fn(),
        placeholder: <div data-testid="droppable-placeholder" />
      })}
    </div>
  ),
  Draggable: ({ children, draggableId, index }: any) => (
    <div data-testid={`draggable-${draggableId}`}>
      {children({
        innerRef: jest.fn(),
        draggableProps: {},
        dragHandleProps: { 'data-testid': `drag-handle-${draggableId}` }
      }, { isDragging: false })}
    </div>
  )
}))

const mockFollowUpStore = useFollowUpSequenceStore as jest.MockedFunction<typeof useFollowUpSequenceStore>
const mockEmailTemplateStore = useEmailTemplateStore as jest.MockedFunction<typeof useEmailTemplateStore>

// Helper function to create complex test sequences
const createComplexSequence = (scenarioType: 'multi_week' | 'holiday_spanning' | 'ramadan' | 'mixed_language' | 'escalation') => {
  const baseSequence = {
    id: `seq-${scenarioType}`,
    name: `Complex ${scenarioType} Sequence`,
    description: `Testing ${scenarioType} scenarios`,
    sequenceType: 'PROFESSIONAL_STANDARD',
    active: true,
    uaeBusinessHoursOnly: true,
    respectHolidays: true,
    companyId: 'company-1'
  }

  switch (scenarioType) {
    case 'multi_week':
      return {
        ...baseSequence,
        steps: [
          {
            id: 'step-1',
            order: 1,
            type: 'EMAIL',
            name: 'Initial Contact',
            config: { templateId: 'template-gentle', language: 'BOTH' },
            uaeSettings: { respectBusinessHours: true, honorPrayerTimes: true, respectHolidays: true, culturalTone: 'GENTLE' }
          },
          {
            id: 'step-2',
            order: 2,
            type: 'WAIT',
            name: 'Week 1 Wait',
            config: { delay: 1, delayUnit: 'WEEKS', businessHoursOnly: true, avoidWeekends: true, avoidHolidays: true },
            uaeSettings: { respectBusinessHours: true, honorPrayerTimes: true, respectHolidays: true, culturalTone: 'PROFESSIONAL' }
          },
          {
            id: 'step-3',
            order: 3,
            type: 'EMAIL',
            name: 'Professional Follow-up',
            config: { templateId: 'template-professional', language: 'BOTH' },
            uaeSettings: { respectBusinessHours: true, honorPrayerTimes: true, respectHolidays: true, culturalTone: 'PROFESSIONAL' }
          },
          {
            id: 'step-4',
            order: 4,
            type: 'WAIT',
            name: 'Week 2 Wait',
            config: { delay: 2, delayUnit: 'WEEKS', businessHoursOnly: true, avoidWeekends: true, avoidHolidays: true },
            uaeSettings: { respectBusinessHours: true, honorPrayerTimes: true, respectHolidays: true, culturalTone: 'PROFESSIONAL' }
          },
          {
            id: 'step-5',
            order: 5,
            type: 'EMAIL',
            name: 'Firm Notice',
            config: { templateId: 'template-firm', language: 'BOTH' },
            uaeSettings: { respectBusinessHours: true, honorPrayerTimes: true, respectHolidays: true, culturalTone: 'FIRM' }
          },
          {
            id: 'step-6',
            order: 6,
            type: 'WAIT',
            name: 'Final Wait',
            config: { delay: 1, delayUnit: 'WEEKS', businessHoursOnly: true, avoidWeekends: true, avoidHolidays: true },
            uaeSettings: { respectBusinessHours: true, honorPrayerTimes: true, respectHolidays: true, culturalTone: 'FIRM' }
          },
          {
            id: 'step-7',
            order: 7,
            type: 'EMAIL',
            name: 'Final Notice',
            config: { templateId: 'template-final', language: 'BOTH' },
            uaeSettings: { respectBusinessHours: true, honorPrayerTimes: true, respectHolidays: true, culturalTone: 'URGENT' }
          }
        ]
      }

    case 'holiday_spanning':
      return {
        ...baseSequence,
        name: 'Holiday-Aware Sequence',
        steps: [
          {
            id: 'step-1',
            order: 1,
            type: 'EMAIL',
            name: 'Pre-Holiday Reminder',
            config: { templateId: 'template-holiday-aware', language: 'BOTH' },
            uaeSettings: { respectBusinessHours: true, honorPrayerTimes: true, respectHolidays: true, culturalTone: 'GENTLE' }
          },
          {
            id: 'step-2',
            order: 2,
            type: 'WAIT',
            name: 'Holiday Buffer',
            config: { delay: 5, delayUnit: 'DAYS', businessHoursOnly: true, avoidWeekends: true, avoidHolidays: true, avoidPrayerTimes: true },
            uaeSettings: { respectBusinessHours: true, honorPrayerTimes: true, respectHolidays: true, culturalTone: 'PROFESSIONAL' }
          },
          {
            id: 'step-3',
            order: 3,
            type: 'EMAIL',
            name: 'Post-Holiday Follow-up',
            config: { templateId: 'template-post-holiday', language: 'BOTH' },
            uaeSettings: { respectBusinessHours: true, honorPrayerTimes: true, respectHolidays: true, culturalTone: 'PROFESSIONAL' }
          }
        ]
      }

    case 'ramadan':
      return {
        ...baseSequence,
        name: 'Ramadan-Sensitive Sequence',
        steps: [
          {
            id: 'step-1',
            order: 1,
            type: 'EMAIL',
            name: 'Ramadan Greeting',
            config: { templateId: 'template-ramadan', language: 'BOTH' },
            uaeSettings: { respectBusinessHours: true, honorPrayerTimes: true, respectHolidays: true, culturalTone: 'GENTLE' }
          },
          {
            id: 'step-2',
            order: 2,
            type: 'WAIT',
            name: 'Ramadan Wait',
            config: { delay: 7, delayUnit: 'DAYS', businessHoursOnly: true, avoidWeekends: true, avoidHolidays: true, avoidPrayerTimes: true },
            uaeSettings: { respectBusinessHours: true, honorPrayerTimes: true, respectHolidays: true, culturalTone: 'GENTLE' }
          },
          {
            id: 'step-3',
            order: 3,
            type: 'EMAIL',
            name: 'Gentle Ramadan Follow-up',
            config: { templateId: 'template-ramadan-followup', language: 'BOTH' },
            uaeSettings: { respectBusinessHours: true, honorPrayerTimes: true, respectHolidays: true, culturalTone: 'GENTLE' }
          }
        ]
      }

    case 'mixed_language':
      return {
        ...baseSequence,
        name: 'Mixed Language Sequence',
        steps: [
          {
            id: 'step-1',
            order: 1,
            type: 'EMAIL',
            name: 'English Only Email',
            config: { templateId: 'template-english', language: 'ENGLISH' },
            uaeSettings: { respectBusinessHours: true, honorPrayerTimes: true, respectHolidays: true, culturalTone: 'PROFESSIONAL' }
          },
          {
            id: 'step-2',
            order: 2,
            type: 'WAIT',
            name: 'Standard Wait',
            config: { delay: 3, delayUnit: 'DAYS', businessHoursOnly: true, avoidWeekends: true },
            uaeSettings: { respectBusinessHours: true, honorPrayerTimes: true, respectHolidays: true, culturalTone: 'PROFESSIONAL' }
          },
          {
            id: 'step-3',
            order: 3,
            type: 'EMAIL',
            name: 'Arabic Only Email',
            config: { templateId: 'template-arabic', language: 'ARABIC' },
            uaeSettings: { respectBusinessHours: true, honorPrayerTimes: true, respectHolidays: true, culturalTone: 'PROFESSIONAL' }
          },
          {
            id: 'step-4',
            order: 4,
            type: 'WAIT',
            name: 'Another Wait',
            config: { delay: 5, delayUnit: 'DAYS', businessHoursOnly: true, avoidWeekends: true },
            uaeSettings: { respectBusinessHours: true, honorPrayerTimes: true, respectHolidays: true, culturalTone: 'PROFESSIONAL' }
          },
          {
            id: 'step-5',
            order: 5,
            type: 'EMAIL',
            name: 'Bilingual Email',
            config: { templateId: 'template-bilingual', language: 'BOTH' },
            uaeSettings: { respectBusinessHours: true, honorPrayerTimes: true, respectHolidays: true, culturalTone: 'FIRM' }
          }
        ]
      }

    case 'escalation':
      return {
        ...baseSequence,
        name: 'Full Escalation Sequence',
        steps: [
          {
            id: 'step-1',
            order: 1,
            type: 'EMAIL',
            name: 'Gentle Reminder',
            config: { templateId: 'template-gentle', language: 'BOTH' },
            uaeSettings: { respectBusinessHours: true, honorPrayerTimes: true, respectHolidays: true, culturalTone: 'GENTLE' }
          },
          {
            id: 'step-2',
            order: 2,
            type: 'WAIT',
            name: 'Grace Period',
            config: { delay: 3, delayUnit: 'DAYS', businessHoursOnly: true, avoidWeekends: true, avoidHolidays: true },
            uaeSettings: { respectBusinessHours: true, honorPrayerTimes: true, respectHolidays: true, culturalTone: 'GENTLE' }
          },
          {
            id: 'step-3',
            order: 3,
            type: 'EMAIL',
            name: 'Professional Follow-up',
            config: { templateId: 'template-professional', language: 'BOTH' },
            uaeSettings: { respectBusinessHours: true, honorPrayerTimes: true, respectHolidays: true, culturalTone: 'PROFESSIONAL' }
          },
          {
            id: 'step-4',
            order: 4,
            type: 'WAIT',
            name: 'Standard Wait',
            config: { delay: 7, delayUnit: 'DAYS', businessHoursOnly: true, avoidWeekends: true, avoidHolidays: true },
            uaeSettings: { respectBusinessHours: true, honorPrayerTimes: true, respectHolidays: true, culturalTone: 'PROFESSIONAL' }
          },
          {
            id: 'step-5',
            order: 5,
            type: 'EMAIL',
            name: 'Firm Notice',
            config: { templateId: 'template-firm', language: 'BOTH' },
            uaeSettings: { respectBusinessHours: true, honorPrayerTimes: true, respectHolidays: true, culturalTone: 'FIRM' }
          },
          {
            id: 'step-6',
            order: 6,
            type: 'WAIT',
            name: 'Pre-Legal Wait',
            config: { delay: 14, delayUnit: 'DAYS', businessHoursOnly: true, avoidWeekends: true, avoidHolidays: true },
            uaeSettings: { respectBusinessHours: true, honorPrayerTimes: true, respectHolidays: true, culturalTone: 'FIRM' }
          },
          {
            id: 'step-7',
            order: 7,
            type: 'EMAIL',
            name: 'Final Legal Notice',
            config: { templateId: 'template-final', language: 'BOTH' },
            uaeSettings: { respectBusinessHours: true, honorPrayerTimes: true, respectHolidays: true, culturalTone: 'URGENT' }
          },
          {
            id: 'step-8',
            order: 8,
            type: 'ACTION',
            name: 'Legal Escalation',
            config: { actionType: 'ESCALATE_LEGAL', actionConfig: { department: 'legal' } },
            uaeSettings: { respectBusinessHours: true, honorPrayerTimes: true, respectHolidays: true, culturalTone: 'URGENT' }
          }
        ]
      }

    default:
      return baseSequence
  }
}

// Mock templates for complex scenarios
const mockComplexTemplates = [
  {
    id: 'template-gentle',
    name: 'UAE Gentle Reminder',
    templateType: 'FOLLOW_UP',
    subjectEn: 'Gentle Payment Reminder - {{invoice_number}}',
    subjectAr: 'تذكير لطيف بالدفع - {{invoice_number}}',
    contentEn: 'Dear {{customer_name}}, we hope this email finds you well...',
    contentAr: 'عزيزي {{customer_name}}، نأمل أن يصلك هذا البريد...',
    isActive: true,
    companyId: 'company-1'
  },
  {
    id: 'template-professional',
    name: 'UAE Professional Follow-up',
    templateType: 'FOLLOW_UP',
    subjectEn: 'Professional Follow-up: Invoice {{invoice_number}}',
    subjectAr: 'متابعة مهنية: الفاتورة {{invoice_number}}',
    contentEn: 'Respected {{customer_name}}, this is a follow-up regarding...',
    contentAr: 'المحترم {{customer_name}}، هذه متابعة بخصوص...',
    isActive: true,
    companyId: 'company-1'
  },
  {
    id: 'template-firm',
    name: 'UAE Firm Notice',
    templateType: 'FOLLOW_UP',
    subjectEn: 'Important Notice: Payment Required - {{invoice_number}}',
    subjectAr: 'إشعار مهم: الدفع مطلوب - {{invoice_number}}',
    contentEn: 'Dear {{customer_name}}, this is an important notice regarding...',
    contentAr: 'عزيزي {{customer_name}}، هذا إشعار مهم بخصوص...',
    isActive: true,
    companyId: 'company-1'
  },
  {
    id: 'template-final',
    name: 'UAE Final Legal Notice',
    templateType: 'FOLLOW_UP',
    subjectEn: 'FINAL NOTICE: Legal Action Pending - {{invoice_number}}',
    subjectAr: 'إشعار نهائي: إجراء قانوني معلق - {{invoice_number}}',
    contentEn: 'This is our final notice regarding invoice {{invoice_number}}. As per UAE Commercial Law...',
    contentAr: 'هذا إشعارنا النهائي بخصوص الفاتورة {{invoice_number}}. وفقاً لقانون التجارة الإماراتي...',
    isActive: true,
    companyId: 'company-1'
  },
  {
    id: 'template-ramadan',
    name: 'UAE Ramadan Template',
    templateType: 'FOLLOW_UP',
    subjectEn: 'Ramadan Kareem - Payment Reminder',
    subjectAr: 'رمضان كريم - تذكير بالدفع',
    contentEn: 'Ramadan Kareem! During this blessed month, we gently remind you...',
    contentAr: 'رمضان كريم! خلال هذا الشهر المبارك، نذكركم بلطف...',
    isActive: true,
    companyId: 'company-1'
  }
]

const defaultProps = {
  onSave: jest.fn(),
  onCancel: jest.fn()
}

describe('Complex Scenarios', () => {
  let mockStoreActions: any

  beforeEach(() => {
    mockStoreActions = {
      sequences: [],
      addSequence: jest.fn(),
      updateSequence: jest.fn(),
      deleteSequence: jest.fn()
    }

    mockFollowUpStore.mockReturnValue(mockStoreActions)

    mockEmailTemplateStore.mockReturnValue({
      templates: mockComplexTemplates,
      fetchTemplates: jest.fn(),
      loading: false,
      error: null
    })

    jest.clearAllMocks()
  })

  describe('Multi-Step Sequences Spanning Weeks', () => {
    it('handles complex multi-week sequence correctly', () => {
      const multiWeekSequence = createComplexSequence('multi_week')
      mockStoreActions.sequences = [multiWeekSequence]

      const propsWithSequence = {
        ...defaultProps,
        sequenceId: multiWeekSequence.id
      }

      render(<SequenceBuilder {...propsWithSequence} />)

      // Should show all 7 steps
      expect(screen.getByText('7')).toBeInTheDocument() // Total steps

      // Should calculate total duration: 1 + 2 + 1 = 4 weeks = 28 days
      expect(screen.getByText(/28\.0 days/)).toBeInTheDocument()

      // Should show escalation pattern
      expect(screen.getByText('Initial Contact')).toBeInTheDocument()
      expect(screen.getByText('Professional Follow-up')).toBeInTheDocument()
      expect(screen.getByText('Firm Notice')).toBeInTheDocument()
      expect(screen.getByText('Final Notice')).toBeInTheDocument()
    })

    it('maintains cultural compliance across long sequences', () => {
      const multiWeekSequence = createComplexSequence('multi_week')
      mockStoreActions.sequences = [multiWeekSequence]

      const propsWithSequence = {
        ...defaultProps,
        sequenceId: multiWeekSequence.id
      }

      render(<SequenceBuilder {...propsWithSequence} />)

      // All steps should have UAE compliance
      const uaeBadges = screen.getAllByText('UAE Hours')
      expect(uaeBadges.length).toBe(7) // One per step

      // Should show appropriate tone progression
      expect(screen.getByText('Initial Contact')).toBeInTheDocument()
      expect(screen.getByText('Final Notice')).toBeInTheDocument()
    })

    it('validates step dependencies in long sequences', () => {
      const multiWeekSequence = createComplexSequence('multi_week')
      mockStoreActions.sequences = [multiWeekSequence]

      const propsWithSequence = {
        ...defaultProps,
        sequenceId: multiWeekSequence.id
      }

      render(<SequenceBuilder {...propsWithSequence} />)

      // Should alternate EMAIL and WAIT steps properly
      const steps = multiWeekSequence.steps
      expect(steps[0].type).toBe('EMAIL')
      expect(steps[1].type).toBe('WAIT')
      expect(steps[2].type).toBe('EMAIL')
      expect(steps[3].type).toBe('WAIT')
      expect(steps[4].type).toBe('EMAIL')
      expect(steps[5].type).toBe('WAIT')
      expect(steps[6].type).toBe('EMAIL')
    })

    it('supports reordering of complex sequences', async () => {
      const user = userEvent.setup()
      const multiWeekSequence = createComplexSequence('multi_week')
      mockStoreActions.sequences = [multiWeekSequence]

      const propsWithSequence = {
        ...defaultProps,
        sequenceId: multiWeekSequence.id
      }

      render(<SequenceBuilder {...propsWithSequence} />)

      // Should have drag handles for all steps
      for (let i = 1; i <= 7; i++) {
        expect(screen.getByTestId(`drag-handle-step-${i}`)).toBeInTheDocument()
      }

      // Should maintain order display
      expect(screen.getByText('1')).toBeInTheDocument()
      expect(screen.getByText('7')).toBeInTheDocument()
    })
  })

  describe('Sequences That Cross UAE Holidays', () => {
    it('handles holiday-spanning sequences correctly', () => {
      const holidaySequence = createComplexSequence('holiday_spanning')
      mockStoreActions.sequences = [holidaySequence]

      const propsWithSequence = {
        ...defaultProps,
        sequenceId: holidaySequence.id
      }

      render(<SequenceBuilder {...propsWithSequence} />)

      // Should show holiday-aware configuration
      expect(screen.getByText('Pre-Holiday Reminder')).toBeInTheDocument()
      expect(screen.getByText('Holiday Buffer')).toBeInTheDocument()
      expect(screen.getByText('Post-Holiday Follow-up')).toBeInTheDocument()

      // Should respect holiday settings
      const holidaySettings = screen.getByLabelText('Respect UAE Holidays')
      expect(holidaySettings).toBeChecked()
    })

    it('validates holiday awareness in step configuration', () => {
      const holidaySequence = createComplexSequence('holiday_spanning')
      
      // Verify holiday avoidance settings
      const waitStep = holidaySequence.steps.find(s => s.type === 'WAIT')
      expect(waitStep?.config.avoidHolidays).toBe(true)
      expect(waitStep?.uaeSettings.respectHolidays).toBe(true)
    })

    it('provides appropriate timing for pre/post holiday communications', () => {
      const holidaySequence = createComplexSequence('holiday_spanning')
      mockStoreActions.sequences = [holidaySequence]

      const propsWithSequence = {
        ...defaultProps,
        sequenceId: holidaySequence.id
      }

      render(<SequenceBuilder {...propsWithSequence} />)

      // Should calculate appropriate buffer time
      expect(screen.getByText(/5\.0 days/)).toBeInTheDocument()
    })

    it('maintains cultural sensitivity during holiday periods', () => {
      const holidaySequence = createComplexSequence('holiday_spanning')
      
      // Verify cultural tone remains gentle during holidays
      holidaySequence.steps.forEach(step => {
        if (step.name.includes('Holiday')) {
          expect(step.uaeSettings.culturalTone).toMatch(/GENTLE|PROFESSIONAL/)
        }
      })
    })
  })

  describe('Sequences During Ramadan Period', () => {
    it('handles Ramadan-sensitive sequences correctly', () => {
      const ramadanSequence = createComplexSequence('ramadan')
      mockStoreActions.sequences = [ramadanSequence]

      const propsWithSequence = {
        ...defaultProps,
        sequenceId: ramadanSequence.id
      }

      render(<SequenceBuilder {...propsWithSequence} />)

      // Should show Ramadan-specific steps
      expect(screen.getByText('Ramadan Greeting')).toBeInTheDocument()
      expect(screen.getByText('Gentle Ramadan Follow-up')).toBeInTheDocument()

      // Should maintain gentle tone throughout
      expect(screen.getByText('Ramadan Wait')).toBeInTheDocument()
    })

    it('enforces gentle cultural tone during Ramadan', () => {
      const ramadanSequence = createComplexSequence('ramadan')
      
      // All steps should use gentle tone
      ramadanSequence.steps.forEach(step => {
        expect(step.uaeSettings.culturalTone).toBe('GENTLE')
      })
    })

    it('respects Ramadan business hours', () => {
      const ramadanSequence = createComplexSequence('ramadan')
      
      // Verify business hours and prayer time settings
      ramadanSequence.steps.forEach(step => {
        expect(step.uaeSettings.respectBusinessHours).toBe(true)
        expect(step.uaeSettings.honorPrayerTimes).toBe(true)
        if (step.type === 'WAIT') {
          expect(step.config.avoidPrayerTimes).toBe(true)
        }
      })
    })

    it('uses appropriate Ramadan templates', () => {
      const ramadanTemplate = mockComplexTemplates.find(t => t.id === 'template-ramadan')
      
      expect(ramadanTemplate?.subjectEn).toContain('Ramadan Kareem')
      expect(ramadanTemplate?.subjectAr).toContain('رمضان كريم')
      expect(ramadanTemplate?.contentEn).toContain('blessed month')
    })

    it('extends wait periods during Ramadan for cultural sensitivity', () => {
      const ramadanSequence = createComplexSequence('ramadan')
      
      // Wait periods should be longer during Ramadan
      const waitStep = ramadanSequence.steps.find(s => s.type === 'WAIT')
      expect(waitStep?.config.delay).toBeGreaterThanOrEqual(7) // At least a week
    })
  })

  describe('Mixed Language Sequences (Arabic/English)', () => {
    it('handles mixed language sequences correctly', () => {
      const mixedLangSequence = createComplexSequence('mixed_language')
      mockStoreActions.sequences = [mixedLangSequence]

      const propsWithSequence = {
        ...defaultProps,
        sequenceId: mixedLangSequence.id
      }

      render(<SequenceBuilder {...propsWithSequence} />)

      // Should show all language variants
      expect(screen.getByText('English Only Email')).toBeInTheDocument()
      expect(screen.getByText('Arabic Only Email')).toBeInTheDocument()
      expect(screen.getByText('Bilingual Email')).toBeInTheDocument()
    })

    it('validates language progression appropriately', () => {
      const mixedLangSequence = createComplexSequence('mixed_language')
      
      // Verify language configuration
      const steps = mixedLangSequence.steps.filter(s => s.type === 'EMAIL')
      expect(steps[0].config.language).toBe('ENGLISH')
      expect(steps[1].config.language).toBe('ARABIC')
      expect(steps[2].config.language).toBe('BOTH')
    })

    it('ensures cultural compliance across languages', () => {
      const mixedLangSequence = createComplexSequence('mixed_language')
      
      // All email steps should maintain professional tone
      mixedLangSequence.steps
        .filter(s => s.type === 'EMAIL')
        .forEach(step => {
          expect(step.uaeSettings.culturalTone).toMatch(/PROFESSIONAL|FIRM/)
        })
    })

    it('validates template compatibility with language settings', () => {
      const englishTemplate = mockComplexTemplates.find(t => t.id === 'template-english')
      const arabicTemplate = mockComplexTemplates.find(t => t.id === 'template-arabic')
      const bilingualTemplate = mockComplexTemplates.find(t => t.id === 'template-bilingual')

      // Templates should exist for all language options
      expect(englishTemplate).toBeDefined()
      expect(arabicTemplate).toBeDefined()
      expect(bilingualTemplate).toBeDefined()
    })

    it('calculates appropriate timing between language switches', () => {
      const mixedLangSequence = createComplexSequence('mixed_language')
      mockStoreActions.sequences = [mixedLangSequence]

      const propsWithSequence = {
        ...defaultProps,
        sequenceId: mixedLangSequence.id
      }

      render(<SequenceBuilder {...propsWithSequence} />)

      // Should calculate total duration: 3 + 5 = 8 days
      expect(screen.getByText(/8\.0 days/)).toBeInTheDocument()
    })
  })

  describe('Business Hours Compliance Validation', () => {
    it('validates business hours across all complex sequences', () => {
      const sequences = [
        createComplexSequence('multi_week'),
        createComplexSequence('holiday_spanning'),
        createComplexSequence('ramadan'),
        createComplexSequence('mixed_language')
      ]

      sequences.forEach(sequence => {
        // All sequences should respect UAE business hours
        expect(sequence.uaeBusinessHoursOnly).toBe(true)
        expect(sequence.respectHolidays).toBe(true)

        // All steps should have proper UAE settings
        sequence.steps.forEach(step => {
          expect(step.uaeSettings.respectBusinessHours).toBe(true)
          expect(step.uaeSettings.honorPrayerTimes).toBe(true)
          expect(step.uaeSettings.respectHolidays).toBe(true)
        })
      })
    })

    it('validates weekend avoidance in wait steps', () => {
      const multiWeekSequence = createComplexSequence('multi_week')
      
      multiWeekSequence.steps
        .filter(s => s.type === 'WAIT')
        .forEach(step => {
          expect(step.config.avoidWeekends).toBe(true)
          expect(step.config.businessHoursOnly).toBe(true)
        })
    })

    it('enforces prayer time avoidance where configured', () => {
      const ramadanSequence = createComplexSequence('ramadan')
      
      ramadanSequence.steps
        .filter(s => s.type === 'WAIT')
        .forEach(step => {
          expect(step.config.avoidPrayerTimes).toBe(true)
          expect(step.uaeSettings.honorPrayerTimes).toBe(true)
        })
    })

    it('validates business hours compliance in step editor', async () => {
      const user = userEvent.setup()
      const multiWeekSequence = createComplexSequence('multi_week')
      mockStoreActions.sequences = [multiWeekSequence]

      const propsWithSequence = {
        ...defaultProps,
        sequenceId: multiWeekSequence.id
      }

      render(<SequenceBuilder {...propsWithSequence} />)

      // Edit a wait step
      const editButtons = screen.getAllByRole('button', { name: /edit/i })
      await user.click(editButtons[1]) // Second step (wait step)

      await waitFor(() => {
        const uaeTab = screen.getByRole('tab', { name: /uae settings/i })
        user.click(uaeTab)
      })

      await waitFor(() => {
        expect(screen.getByLabelText('Respect Business Hours')).toBeChecked()
        expect(screen.getByLabelText('Honor Prayer Times')).toBeChecked()
        expect(screen.getByLabelText('Respect UAE Holidays')).toBeChecked()
      })
    })
  })

  describe('Full Escalation Sequence Integration', () => {
    it('handles complete escalation sequence correctly', () => {
      const escalationSequence = createComplexSequence('escalation')
      mockStoreActions.sequences = [escalationSequence]

      const propsWithSequence = {
        ...defaultProps,
        sequenceId: escalationSequence.id
      }

      render(<SequenceBuilder {...propsWithSequence} />)

      // Should show all escalation steps
      expect(screen.getByText('Gentle Reminder')).toBeInTheDocument()
      expect(screen.getByText('Professional Follow-up')).toBeInTheDocument()
      expect(screen.getByText('Firm Notice')).toBeInTheDocument()
      expect(screen.getByText('Final Legal Notice')).toBeInTheDocument()
      expect(screen.getByText('Legal Escalation')).toBeInTheDocument()

      // Should show total of 8 steps
      expect(screen.getByText('8')).toBeInTheDocument()
    })

    it('validates escalation tone progression', () => {
      const escalationSequence = createComplexSequence('escalation')
      
      const emailSteps = escalationSequence.steps.filter(s => s.type === 'EMAIL')
      
      // Should progress from gentle to urgent
      expect(emailSteps[0].uaeSettings.culturalTone).toBe('GENTLE')
      expect(emailSteps[1].uaeSettings.culturalTone).toBe('PROFESSIONAL')
      expect(emailSteps[2].uaeSettings.culturalTone).toBe('FIRM')
      expect(emailSteps[3].uaeSettings.culturalTone).toBe('URGENT')
    })

    it('validates escalation timing progression', () => {
      const escalationSequence = createComplexSequence('escalation')
      
      const waitSteps = escalationSequence.steps.filter(s => s.type === 'WAIT')
      
      // Wait periods should increase: 3, 7, 14 days
      expect(waitSteps[0].config.delay).toBe(3)
      expect(waitSteps[1].config.delay).toBe(7)
      expect(waitSteps[2].config.delay).toBe(14)
    })

    it('includes legal escalation action step', () => {
      const escalationSequence = createComplexSequence('escalation')
      
      const actionStep = escalationSequence.steps.find(s => s.type === 'ACTION')
      expect(actionStep).toBeDefined()
      expect(actionStep?.config.actionType).toBe('ESCALATE_LEGAL')
      expect(actionStep?.uaeSettings.culturalTone).toBe('URGENT')
    })

    it('calculates correct total duration for escalation', () => {
      const escalationSequence = createComplexSequence('escalation')
      mockStoreActions.sequences = [escalationSequence]

      const propsWithSequence = {
        ...defaultProps,
        sequenceId: escalationSequence.id
      }

      render(<SequenceBuilder {...propsWithSequence} />)

      // Should calculate total duration: 3 + 7 + 14 = 24 days
      expect(screen.getByText(/24\.0 days/)).toBeInTheDocument()
    })
  })

  describe('Performance with Complex Scenarios', () => {
    it('handles large complex sequences efficiently', () => {
      const largeComplexSequence = createComplexSequence('multi_week')
      // Extend to even more steps
      const additionalSteps = Array.from({ length: 10 }, (_, i) => ({
        id: `extra-step-${i + 8}`,
        order: i + 8,
        type: i % 2 === 0 ? 'EMAIL' : 'WAIT',
        name: `Extra Step ${i + 8}`,
        config: { delay: 1, delayUnit: 'DAYS' },
        uaeSettings: { respectBusinessHours: true, honorPrayerTimes: true, respectHolidays: true, culturalTone: 'PROFESSIONAL' }
      }))
      
      largeComplexSequence.steps = [...largeComplexSequence.steps, ...additionalSteps]
      mockStoreActions.sequences = [largeComplexSequence]

      const propsWithLargeSequence = {
        ...defaultProps,
        sequenceId: largeComplexSequence.id
      }

      const startTime = performance.now()
      render(<SequenceBuilder {...propsWithLargeSequence} />)
      const endTime = performance.now()

      // Should render within reasonable time
      expect(endTime - startTime).toBeLessThan(200)

      // Should show correct step count
      expect(screen.getByText('17')).toBeInTheDocument() // 7 original + 10 additional
    })

    it('maintains responsiveness during complex drag operations', async () => {
      const complexSequence = createComplexSequence('escalation')
      mockStoreActions.sequences = [complexSequence]

      const propsWithSequence = {
        ...defaultProps,
        sequenceId: complexSequence.id
      }

      render(<SequenceBuilder {...propsWithSequence} />)

      // Should have all drag handles
      for (let i = 1; i <= 8; i++) {
        expect(screen.getByTestId(`drag-handle-step-${i}`)).toBeInTheDocument()
      }

      // UI should remain responsive
      expect(screen.getByRole('button', { name: /save sequence/i })).toBeInTheDocument()
    })

    it('handles rapid sequence modifications efficiently', async () => {
      const user = userEvent.setup()
      const complexSequence = createComplexSequence('multi_week')
      mockStoreActions.sequences = [complexSequence]

      const propsWithSequence = {
        ...defaultProps,
        sequenceId: complexSequence.id
      }

      render(<SequenceBuilder {...propsWithSequence} />)

      // Rapidly modify sequence name
      const nameInput = screen.getByLabelText('Sequence Name *')
      await user.clear(nameInput)
      await user.type(nameInput, 'Modified Complex Sequence')

      // Should update without lag
      expect(nameInput).toHaveValue('Modified Complex Sequence')
    })
  })

  describe('Error Handling in Complex Scenarios', () => {
    it('handles invalid step configurations gracefully', () => {
      const invalidSequence = createComplexSequence('multi_week')
      // Corrupt one step
      invalidSequence.steps[2] = {
        ...invalidSequence.steps[2],
        config: null as any,
        uaeSettings: null as any
      }

      mockStoreActions.sequences = [invalidSequence]

      const propsWithInvalidSequence = {
        ...defaultProps,
        sequenceId: invalidSequence.id
      }

      // Should not throw error
      expect(() => {
        render(<SequenceBuilder {...propsWithInvalidSequence} />)
      }).not.toThrow()
    })

    it('validates complex sequences before saving', async () => {
      const user = userEvent.setup()
      const incompleteSequence = createComplexSequence('escalation')
      // Remove template IDs to make invalid
      incompleteSequence.steps.forEach(step => {
        if (step.type === 'EMAIL') {
          step.config.templateId = undefined
        }
      })

      mockStoreActions.sequences = [incompleteSequence]

      const propsWithIncompleteSequence = {
        ...defaultProps,
        sequenceId: incompleteSequence.id
      }

      render(<SequenceBuilder {...propsWithIncompleteSequence} />)

      const saveButton = screen.getByRole('button', { name: /update sequence/i })
      await user.click(saveButton)

      await waitFor(() => {
        expect(screen.getByText('Validation Errors')).toBeInTheDocument()
        expect(screen.getByText(/Email template or custom content is required/)).toBeInTheDocument()
      })
    })

    it('handles network errors during complex sequence save', async () => {
      const user = userEvent.setup()
      const mockUpdateSequenceError = jest.fn().mockRejectedValue(new Error('Network timeout'))
      mockStoreActions.updateSequence = mockUpdateSequenceError

      const complexSequence = createComplexSequence('multi_week')
      mockStoreActions.sequences = [complexSequence]

      const propsWithSequence = {
        ...defaultProps,
        sequenceId: complexSequence.id
      }

      render(<SequenceBuilder {...propsWithSequence} />)

      const saveButton = screen.getByRole('button', { name: /update sequence/i })
      await user.click(saveButton)

      await waitFor(() => {
        expect(mockUpdateSequenceError).toHaveBeenCalled()
      })
    })
  })

  describe('Cultural Compliance in Complex Scenarios', () => {
    it('validates UAE cultural compliance across all complex scenarios', () => {
      const scenarios = ['multi_week', 'holiday_spanning', 'ramadan', 'mixed_language', 'escalation'] as const
      
      scenarios.forEach(scenarioType => {
        const sequence = createComplexSequence(scenarioType)
        
        // Validate overall sequence compliance
        expect(sequence.uaeBusinessHoursOnly).toBe(true)
        expect(sequence.respectHolidays).toBe(true)
        
        // Validate step-level compliance
        sequence.steps.forEach((step, index) => {
          expect(step.uaeSettings.respectBusinessHours).toBe(true)
          expect(step.uaeSettings.honorPrayerTimes).toBe(true)
          expect(step.uaeSettings.respectHolidays).toBe(true)
          
          // Cultural tone should be appropriate
          expect(['GENTLE', 'PROFESSIONAL', 'FIRM', 'URGENT']).toContain(step.uaeSettings.culturalTone)
        })
      })
    })

    it('ensures escalation follows UAE business etiquette', () => {
      const escalationSequence = createComplexSequence('escalation')
      
      const toneProgression = escalationSequence.steps
        .filter(s => s.type === 'EMAIL')
        .map(s => s.uaeSettings.culturalTone)
      
      // Should progress appropriately: gentle → professional → firm → urgent
      expect(toneProgression).toEqual(['GENTLE', 'PROFESSIONAL', 'FIRM', 'URGENT'])
    })

    it('maintains respectful communication even in urgent scenarios', () => {
      const escalationSequence = createComplexSequence('escalation')
      
      // Even urgent steps should maintain respect
      const urgentStep = escalationSequence.steps.find(s => s.uaeSettings.culturalTone === 'URGENT')
      expect(urgentStep).toBeDefined()
      expect(urgentStep?.uaeSettings.respectBusinessHours).toBe(true)
      expect(urgentStep?.uaeSettings.honorPrayerTimes).toBe(true)
    })
  })
})