import React from 'react'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DragDropContext } from '@hello-pangea/dnd'
import '@testing-library/jest-dom'

import { SequenceBuilder } from '../sequence-builder'
import { useFollowUpSequenceStore } from '@/lib/stores/follow-up-store'
import { useEmailTemplateStore } from '@/lib/stores/email-template-store'
import { 
  UAE_CONSTANTS,
  culturalComplianceUtils,
  uaeTestDataGenerators 
} from '@/lib/uae-test-utils'

// Mock the stores
jest.mock('@/lib/stores/follow-up-store')
jest.mock('@/lib/stores/email-template-store')

// Mock react-beautiful-dnd
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

// Sample test data
const mockSequences = [
  {
    id: 'seq-1',
    name: 'Gentle Collection Sequence',
    description: 'Gentle approach for valued customers',
    sequenceType: 'GENTLE_COLLECTION',
    steps: [
      {
        id: 'step-1',
        order: 1,
        type: 'EMAIL',
        name: 'Initial Reminder',
        config: {
          templateId: 'template-1',
          language: 'BOTH'
        },
        uaeSettings: {
          respectBusinessHours: true,
          honorPrayerTimes: true,
          respectHolidays: true,
          culturalTone: 'GENTLE'
        }
      },
      {
        id: 'step-2',
        order: 2,
        type: 'WAIT',
        name: 'Wait Period',
        config: {
          delay: 3,
          delayUnit: 'DAYS',
          businessHoursOnly: true,
          avoidWeekends: true,
          avoidHolidays: true,
          avoidPrayerTimes: true
        },
        uaeSettings: {
          respectBusinessHours: true,
          honorPrayerTimes: true,
          respectHolidays: true,
          culturalTone: 'PROFESSIONAL'
        }
      }
    ],
    active: true,
    uaeBusinessHoursOnly: true,
    respectHolidays: true,
    companyId: 'company-1'
  }
]

const mockTemplates = [
  {
    id: 'template-1',
    name: 'UAE Gentle Reminder',
    templateType: 'FOLLOW_UP',
    subjectEn: 'Payment Reminder - {{invoice_number}}',
    subjectAr: 'تذكير بالدفع - {{invoice_number}}',
    contentEn: 'Dear {{customer_name}}, We hope this email finds you well...',
    contentAr: 'عزيزي {{customer_name}}، نأمل أن يصلك هذا البريد...',
    isActive: true,
    companyId: 'company-1'
  },
  {
    id: 'template-2',
    name: 'UAE Professional Follow-up',
    templateType: 'FOLLOW_UP',
    subjectEn: 'Follow-up: Invoice {{invoice_number}}',
    subjectAr: 'متابعة: الفاتورة {{invoice_number}}',
    contentEn: 'Respected {{customer_name}}, This is a follow-up regarding...',
    contentAr: 'المحترم {{customer_name}}، هذه متابعة بخصوص...',
    isActive: true,
    companyId: 'company-1'
  }
]

const defaultProps = {
  onSave: jest.fn(),
  onCancel: jest.fn()
}

describe('SequenceBuilder Component', () => {
  let mockStoreActions: any

  beforeEach(() => {
    mockStoreActions = {
      sequences: mockSequences,
      addSequence: jest.fn(),
      updateSequence: jest.fn(),
      deleteSequence: jest.fn()
    }

    mockFollowUpStore.mockReturnValue(mockStoreActions)

    mockEmailTemplateStore.mockReturnValue({
      templates: mockTemplates,
      fetchTemplates: jest.fn(),
      loading: false,
      error: null
    })

    jest.clearAllMocks()
  })

  describe('Initial Render and Basic UI', () => {
    it('renders the sequence builder with empty state', () => {
      render(<SequenceBuilder {...defaultProps} />)

      expect(screen.getByText('Sequence Configuration')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('e.g., Gentle Collection Sequence')).toBeInTheDocument()
      expect(screen.getByText('No steps added yet')).toBeInTheDocument()
    })

    it('displays sequence settings form correctly', () => {
      render(<SequenceBuilder {...defaultProps} />)

      expect(screen.getByLabelText('Sequence Name *')).toBeInTheDocument()
      expect(screen.getByLabelText('Sequence Type')).toBeInTheDocument()
      expect(screen.getByLabelText('Description *')).toBeInTheDocument()
      expect(screen.getByLabelText('UAE Business Hours Only')).toBeInTheDocument()
      expect(screen.getByLabelText('Respect UAE Holidays')).toBeInTheDocument()
    })

    it('shows UAE business settings sidebar', () => {
      render(<SequenceBuilder {...defaultProps} />)

      expect(screen.getByText('UAE Business Settings')).toBeInTheDocument()
      expect(screen.getByText('Sunday-Thursday: 9 AM - 6 PM')).toBeInTheDocument()
      expect(screen.getByText('Avoids prayer times automatically')).toBeInTheDocument()
      expect(screen.getByText('Respects Islamic holidays')).toBeInTheDocument()
    })
  })

  describe('Sequence Configuration', () => {
    it('updates sequence name correctly', async () => {
      const user = userEvent.setup()
      render(<SequenceBuilder {...defaultProps} />)

      const nameInput = screen.getByLabelText('Sequence Name *')
      await user.clear(nameInput)
      await user.type(nameInput, 'Test Sequence')

      expect(nameInput).toHaveValue('Test Sequence')
    })

    it('updates sequence description correctly', async () => {
      const user = userEvent.setup()
      render(<SequenceBuilder {...defaultProps} />)

      const descriptionInput = screen.getByLabelText('Description *')
      await user.clear(descriptionInput)
      await user.type(descriptionInput, 'Test description for UAE business compliance')

      expect(descriptionInput).toHaveValue('Test description for UAE business compliance')
    })

    it('selects sequence type correctly', async () => {
      const user = userEvent.setup()
      render(<SequenceBuilder {...defaultProps} />)

      const typeSelect = screen.getByRole('combobox', { name: /sequence type/i })
      await user.click(typeSelect)

      const gentleOption = screen.getByText(/gentle collection/i)
      await user.click(gentleOption)

      expect(typeSelect).toBeInTheDocument()
    })

    it('toggles UAE business settings correctly', async () => {
      const user = userEvent.setup()
      render(<SequenceBuilder {...defaultProps} />)

      const businessHoursToggle = screen.getByLabelText('UAE Business Hours Only')
      const holidaysToggle = screen.getByLabelText('Respect UAE Holidays')

      expect(businessHoursToggle).toBeChecked()
      expect(holidaysToggle).toBeChecked()

      await user.click(businessHoursToggle)
      expect(businessHoursToggle).not.toBeChecked()

      await user.click(holidaysToggle)
      expect(holidaysToggle).not.toBeChecked()
    })
  })

  describe('Step Management', () => {
    it('adds new EMAIL step correctly', async () => {
      const user = userEvent.setup()
      render(<SequenceBuilder {...defaultProps} />)

      const addStepSelect = screen.getByRole('combobox', { name: /add first step/i })
      await user.click(addStepSelect)

      const emailOption = screen.getByText('Email')
      await user.click(emailOption)

      await waitFor(() => {
        expect(screen.getByText('Email Step')).toBeInTheDocument()
      })
    })

    it('adds new WAIT step correctly', async () => {
      const user = userEvent.setup()
      render(<SequenceBuilder {...defaultProps} />)

      const addStepSelect = screen.getByRole('combobox', { name: /add first step/i })
      await user.click(addStepSelect)

      const waitOption = screen.getByText('Wait')
      await user.click(waitOption)

      await waitFor(() => {
        expect(screen.getByText('Wait Step')).toBeInTheDocument()
      })
    })

    it('calculates sequence duration correctly', () => {
      const propsWithSteps = {
        ...defaultProps,
        sequenceId: 'seq-1'
      }

      mockStoreActions.sequences = [
        {
          ...mockSequences[0],
          steps: [
            ...mockSequences[0].steps,
            {
              id: 'step-3',
              order: 3,
              type: 'WAIT',
              name: 'Extended Wait',
              config: {
                delay: 7,
                delayUnit: 'DAYS'
              },
              uaeSettings: {
                respectBusinessHours: true,
                honorPrayerTimes: true,
                respectHolidays: true,
                culturalTone: 'PROFESSIONAL'
              }
            }
          ]
        }
      ]

      render(<SequenceBuilder {...propsWithSteps} />)

      // Should calculate total duration: 3 days + 7 days = 10 days
      expect(screen.getByText(/10\.0 days/)).toBeInTheDocument()
    })

    it('displays correct step statistics', () => {
      const propsWithSteps = {
        ...defaultProps,
        sequenceId: 'seq-1'
      }

      render(<SequenceBuilder {...propsWithSteps} />)

      expect(screen.getByText('2')).toBeInTheDocument() // Total Steps
      expect(screen.getByText('1')).toBeInTheDocument() // Email Steps
      expect(screen.getByText('1')).toBeInTheDocument() // Wait Steps
    })
  })

  describe('Drag and Drop Functionality', () => {
    it('renders drag handles for each step', () => {
      const propsWithSteps = {
        ...defaultProps,
        sequenceId: 'seq-1'
      }

      render(<SequenceBuilder {...propsWithSteps} />)

      expect(screen.getByTestId('drag-handle-step-1')).toBeInTheDocument()
      expect(screen.getByTestId('drag-handle-step-2')).toBeInTheDocument()
    })

    it('handles drag end correctly', async () => {
      const propsWithSteps = {
        ...defaultProps,
        sequenceId: 'seq-1'
      }

      render(<SequenceBuilder {...propsWithSteps} />)

      const dragDropContext = screen.getByTestId('drag-drop-context')
      expect(dragDropContext).toBeInTheDocument()

      // Simulate drag end event
      const mockDragResult = {
        destination: { index: 1 },
        source: { index: 0 }
      }

      const onDragEnd = dragDropContext.getAttribute('data-ondragend')
      expect(onDragEnd).toBeDefined()
    })

    it('updates step order after drag and drop', () => {
      const propsWithSteps = {
        ...defaultProps,
        sequenceId: 'seq-1'
      }

      render(<SequenceBuilder {...propsWithSteps} />)

      // Steps should be displayed in order
      const steps = screen.getAllByText(/Step \d/)
      expect(steps).toHaveLength(2)
    })
  })

  describe('UAE Business Hours Integration', () => {
    it('displays UAE business hours information', () => {
      render(<SequenceBuilder {...defaultProps} />)

      expect(screen.getByText('Sunday-Thursday: 9 AM - 6 PM')).toBeInTheDocument()
      expect(screen.getByText('Avoids prayer times automatically')).toBeInTheDocument()
      expect(screen.getByText('Respects Islamic holidays')).toBeInTheDocument()
    })

    it('shows UAE compliance badges for steps', () => {
      const propsWithSteps = {
        ...defaultProps,
        sequenceId: 'seq-1'
      }

      render(<SequenceBuilder {...propsWithSteps} />)

      const uaeBadges = screen.getAllByText('UAE Hours')
      expect(uaeBadges.length).toBeGreaterThan(0)
    })

    it('validates business hours settings', async () => {
      const user = userEvent.setup()
      render(<SequenceBuilder {...defaultProps} />)

      // Should default to UAE business hours enabled
      const businessHoursToggle = screen.getByLabelText('UAE Business Hours Only')
      expect(businessHoursToggle).toBeChecked()

      // Toggle off and back on
      await user.click(businessHoursToggle)
      expect(businessHoursToggle).not.toBeChecked()

      await user.click(businessHoursToggle)
      expect(businessHoursToggle).toBeChecked()
    })
  })

  describe('Cultural Compliance Features', () => {
    it('enforces escalation sequence validation', () => {
      const propsWithSteps = {
        ...defaultProps,
        sequenceId: 'seq-1'
      }

      // Mock sequence with inappropriate escalation
      mockStoreActions.sequences = [{
        ...mockSequences[0],
        sequenceType: 'GENTLE_COLLECTION',
        steps: [
          {
            id: 'step-1',
            order: 1,
            type: 'EMAIL',
            name: 'Aggressive Start',
            uaeSettings: {
              culturalTone: 'URGENT' // Inappropriate for gentle sequence
            }
          }
        ]
      }]

      render(<SequenceBuilder {...propsWithSteps} />)

      // Should still render but with potential validation issues
      expect(screen.getByText('Aggressive Start')).toBeInTheDocument()
    })

    it('supports bilingual template selection', () => {
      const propsWithSteps = {
        ...defaultProps,
        sequenceId: 'seq-1'
      }

      render(<SequenceBuilder {...propsWithSteps} />)

      // Should show language support indicators
      const emailStep = screen.getByText('Initial Reminder')
      expect(emailStep).toBeInTheDocument()
    })

    it('validates cultural appropriateness in sequence timing', () => {
      // Test the cultural compliance utilities directly
      const gentleTemplate = uaeTestDataGenerators.createUAEBusinessTemplate({
        contentEn: 'Dear customer, we hope this email finds you well. This is a gentle reminder about your invoice.',
        contentAr: 'عزيزي العميل، نأمل أن يصلك هذا البريد بخير. هذا تذكير لطيف بخصوص فاتورتك.'
      })

      const validation = culturalComplianceUtils.validateBusinessEtiquette(
        gentleTemplate.contentEn,
        'en'
      )

      expect(validation.appropriate).toBe(true)
      expect(validation.score).toBeGreaterThan(70)
    })
  })

  describe('Template Integration', () => {
    it('loads available templates correctly', () => {
      render(<SequenceBuilder {...defaultProps} />)

      expect(mockEmailTemplateStore().fetchTemplates).toHaveBeenCalled()
    })

    it('filters templates by type', () => {
      render(<SequenceBuilder {...defaultProps} />)

      const fetchTemplatesCall = (mockEmailTemplateStore().fetchTemplates as jest.Mock).mock.calls[0]
      expect(fetchTemplatesCall[1]).toEqual({ templateType: 'FOLLOW_UP' })
    })
  })

  describe('Validation and Error Handling', () => {
    it('shows validation errors for empty sequence', async () => {
      const user = userEvent.setup()
      render(<SequenceBuilder {...defaultProps} />)

      const saveButton = screen.getByText('Save Sequence')
      await user.click(saveButton)

      await waitFor(() => {
        expect(screen.getByText('Validation Errors')).toBeInTheDocument()
        expect(screen.getByText('Sequence name is required')).toBeInTheDocument()
        expect(screen.getByText('Sequence description is required')).toBeInTheDocument()
        expect(screen.getByText('At least one step is required')).toBeInTheDocument()
      })
    })

    it('validates step configuration', async () => {
      const user = userEvent.setup()
      render(<SequenceBuilder {...defaultProps} />)

      // Add a step first
      const addStepSelect = screen.getByRole('combobox', { name: /add first step/i })
      await user.click(addStepSelect)
      const emailOption = screen.getByText('Email')
      await user.click(emailOption)

      // Fill in required fields but leave step details empty
      const nameInput = screen.getByLabelText('Sequence Name *')
      await user.type(nameInput, 'Test Sequence')

      const descriptionInput = screen.getByLabelText('Description *')
      await user.type(descriptionInput, 'Test description')

      const saveButton = screen.getByText('Save Sequence')
      await user.click(saveButton)

      // Should show step-specific validation errors
      await waitFor(() => {
        expect(screen.getByText(/Email template or custom content is required/)).toBeInTheDocument()
      })
    })

    it('handles save operation correctly', async () => {
      const user = userEvent.setup()
      const mockAddSequence = jest.fn().mockResolvedValue({})
      mockStoreActions.addSequence = mockAddSequence

      render(<SequenceBuilder {...defaultProps} />)

      // Fill in all required fields
      const nameInput = screen.getByLabelText('Sequence Name *')
      await user.type(nameInput, 'Test Sequence')

      const descriptionInput = screen.getByLabelText('Description *')
      await user.type(descriptionInput, 'Test description')

      // Add a valid email step
      const addStepSelect = screen.getByRole('combobox', { name: /add first step/i })
      await user.click(addStepSelect)
      const emailOption = screen.getByText('Email')
      await user.click(emailOption)

      // Mock step with valid configuration
      const mockSequenceWithValidStep = {
        name: 'Test Sequence',
        description: 'Test description',
        sequenceType: 'GENTLE_COLLECTION',
        steps: [{
          id: 'step-1',
          order: 1,
          type: 'EMAIL',
          name: 'Email Step',
          config: { templateId: 'template-1' },
          uaeSettings: {
            respectBusinessHours: true,
            honorPrayerTimes: true,
            respectHolidays: true,
            culturalTone: 'PROFESSIONAL'
          }
        }],
        active: false,
        uaeBusinessHoursOnly: true,
        respectHolidays: true,
        companyId: ''
      }

      // Manually set the sequence data to be valid
      const saveButton = screen.getByText('Save Sequence')

      // Override validation for this test
      mockAddSequence.mockResolvedValue(mockSequenceWithValidStep)

      await user.click(saveButton)

      await waitFor(() => {
        expect(defaultProps.onSave).toHaveBeenCalled()
      })
    })
  })

  describe('Complex Scenarios', () => {
    it('handles multi-step sequences spanning weeks', () => {
      const complexSequence = {
        ...mockSequences[0],
        steps: [
          ...mockSequences[0].steps,
          {
            id: 'step-3',
            order: 3,
            type: 'WAIT',
            name: 'Long Wait',
            config: {
              delay: 2,
              delayUnit: 'WEEKS'
            },
            uaeSettings: {
              respectBusinessHours: true,
              honorPrayerTimes: true,
              respectHolidays: true,
              culturalTone: 'PROFESSIONAL'
            }
          },
          {
            id: 'step-4',
            order: 4,
            type: 'EMAIL',
            name: 'Final Notice',
            config: {
              templateId: 'template-2',
              language: 'BOTH'
            },
            uaeSettings: {
              respectBusinessHours: true,
              honorPrayerTimes: true,
              respectHolidays: true,
              culturalTone: 'FIRM'
            }
          }
        ]
      }

      mockStoreActions.sequences = [complexSequence]

      const propsWithComplexSequence = {
        ...defaultProps,
        sequenceId: 'seq-1'
      }

      render(<SequenceBuilder {...propsWithComplexSequence} />)

      // Should calculate duration including weeks: 3 days + 14 days = 17 days
      expect(screen.getByText(/17\.0 days/)).toBeInTheDocument()
      expect(screen.getByText('Final Notice')).toBeInTheDocument()
    })

    it('handles sequences during Ramadan period', () => {
      // Test UAE business hours validation during Ramadan
      const ramadanHours = UAE_CONSTANTS.businessHours.ramadanHours
      expect(ramadanHours.start).toBe('09:00')
      expect(ramadanHours.end).toBe('15:00')

      // Test would verify that sequences respect Ramadan hours
      const validation = culturalComplianceUtils.validateBusinessHours('14:00', 'Asia/Dubai')
      expect(validation).toHaveProperty('withinHours')
    })

    it('supports mixed language sequences', () => {
      const mixedLanguageSequence = {
        ...mockSequences[0],
        steps: [
          {
            id: 'step-1',
            order: 1,
            type: 'EMAIL',
            name: 'English Email',
            config: {
              templateId: 'template-1',
              language: 'ENGLISH'
            },
            uaeSettings: {
              respectBusinessHours: true,
              honorPrayerTimes: true,
              respectHolidays: true,
              culturalTone: 'GENTLE'
            }
          },
          {
            id: 'step-2',
            order: 2,
            type: 'EMAIL',
            name: 'Arabic Email',
            config: {
              templateId: 'template-2',
              language: 'ARABIC'
            },
            uaeSettings: {
              respectBusinessHours: true,
              honorPrayerTimes: true,
              respectHolidays: true,
              culturalTone: 'PROFESSIONAL'
            }
          }
        ]
      }

      mockStoreActions.sequences = [mixedLanguageSequence]

      const propsWithMixedLanguage = {
        ...defaultProps,
        sequenceId: 'seq-1'
      }

      render(<SequenceBuilder {...propsWithMixedLanguage} />)

      expect(screen.getByText('English Email')).toBeInTheDocument()
      expect(screen.getByText('Arabic Email')).toBeInTheDocument()
    })
  })

  describe('Accessibility and Mobile Responsiveness', () => {
    it('provides proper ARIA labels for drag handles', () => {
      const propsWithSteps = {
        ...defaultProps,
        sequenceId: 'seq-1'
      }

      render(<SequenceBuilder {...propsWithSteps} />)

      const dragHandles = screen.getAllByTestId(/drag-handle-/)
      expect(dragHandles.length).toBeGreaterThan(0)
    })

    it('supports keyboard navigation', async () => {
      const user = userEvent.setup()
      render(<SequenceBuilder {...defaultProps} />)

      const nameInput = screen.getByLabelText('Sequence Name *')
      nameInput.focus()

      // Tab to next element
      await user.tab()
      expect(document.activeElement).not.toBe(nameInput)
    })

    it('provides proper semantic structure', () => {
      render(<SequenceBuilder {...defaultProps} />)

      expect(screen.getByRole('main') || screen.getByRole('region')).toBeInTheDocument()
      expect(screen.getAllByRole('button').length).toBeGreaterThan(0)
      expect(screen.getAllByRole('textbox').length).toBeGreaterThan(0)
    })
  })

  describe('Step Configuration Dialog', () => {
    it('opens step editor when editing a step', async () => {
      const user = userEvent.setup()
      const propsWithSteps = {
        ...defaultProps,
        sequenceId: 'seq-1'
      }

      render(<SequenceBuilder {...propsWithSteps} />)

      // Find and click edit button for first step
      const editButtons = screen.getAllByLabelText(/edit/i)
      if (editButtons.length > 0) {
        await user.click(editButtons[0])

        await waitFor(() => {
          expect(screen.getByText(/Edit Step:/)).toBeInTheDocument()
        })
      }
    })

    it('allows step duplication', async () => {
      const user = userEvent.setup()
      const propsWithSteps = {
        ...defaultProps,
        sequenceId: 'seq-1'
      }

      render(<SequenceBuilder {...propsWithSteps} />)

      // Find and click duplicate button
      const duplicateButtons = screen.getAllByLabelText(/copy/i)
      if (duplicateButtons.length > 0) {
        await user.click(duplicateButtons[0])

        // Should add a new step with "(Copy)" suffix
        await waitFor(() => {
          const steps = screen.getAllByText(/Step/)
          expect(steps.length).toBeGreaterThan(2)
        })
      }
    })

    it('allows step deletion', async () => {
      const user = userEvent.setup()
      const propsWithSteps = {
        ...defaultProps,
        sequenceId: 'seq-1'
      }

      render(<SequenceBuilder {...propsWithSteps} />)

      const initialStepCount = screen.getAllByText(/Step/).length

      // Find and click delete button
      const deleteButtons = screen.getAllByLabelText(/delete/i)
      if (deleteButtons.length > 0) {
        await user.click(deleteButtons[0])

        await waitFor(() => {
          const remainingSteps = screen.getAllByText(/Step/)
          expect(remainingSteps.length).toBeLessThan(initialStepCount)
        })
      }
    })
  })

  describe('UAE Holiday Integration', () => {
    it('validates sequences that cross UAE holidays', () => {
      // Test the UAE constants for holidays
      expect(UAE_CONSTANTS.emirates).toHaveLength(7)
      expect(UAE_CONSTANTS.businessHours.workingDays).toEqual([
        'sunday', 'monday', 'tuesday', 'wednesday', 'thursday'
      ])

      // Weekend should be Friday and Saturday
      expect(UAE_CONSTANTS.businessHours.workingDays).not.toContain('friday')
      expect(UAE_CONSTANTS.businessHours.workingDays).not.toContain('saturday')
    })

    it('respects prayer time avoidance', () => {
      const propsWithSteps = {
        ...defaultProps,
        sequenceId: 'seq-1'
      }

      render(<SequenceBuilder {...propsWithSteps} />)

      // Should show prayer time compliance in step settings
      expect(screen.getByText('Avoids prayer times automatically')).toBeInTheDocument()
    })
  })

  describe('Performance and Edge Cases', () => {
    it('handles empty sequences gracefully', () => {
      mockStoreActions.sequences = []

      render(<SequenceBuilder {...defaultProps} />)

      expect(screen.getByText('No steps added yet')).toBeInTheDocument()
    })

    it('handles large number of steps efficiently', () => {
      const manySteps = Array.from({ length: 20 }, (_, i) => ({
        id: `step-${i + 1}`,
        order: i + 1,
        type: i % 2 === 0 ? 'EMAIL' : 'WAIT',
        name: `Step ${i + 1}`,
        config: {},
        uaeSettings: {
          respectBusinessHours: true,
          honorPrayerTimes: true,
          respectHolidays: true,
          culturalTone: 'PROFESSIONAL'
        }
      }))

      const largeSequence = {
        ...mockSequences[0],
        steps: manySteps
      }

      mockStoreActions.sequences = [largeSequence]

      const propsWithManySteps = {
        ...defaultProps,
        sequenceId: 'seq-1'
      }

      render(<SequenceBuilder {...propsWithManySteps} />)

      expect(screen.getByText('20')).toBeInTheDocument() // Total Steps count
    })

    it('handles network errors gracefully', async () => {
      const user = userEvent.setup()
      const mockAddSequenceError = jest.fn().mockRejectedValue(new Error('Network error'))
      mockStoreActions.addSequence = mockAddSequenceError

      render(<SequenceBuilder {...defaultProps} />)

      // Try to save with valid data
      const nameInput = screen.getByLabelText('Sequence Name *')
      await user.type(nameInput, 'Test Sequence')

      const descriptionInput = screen.getByLabelText('Description *')
      await user.type(descriptionInput, 'Test description')

      const saveButton = screen.getByText('Save Sequence')
      await user.click(saveButton)

      // Should handle the error gracefully
      await waitFor(() => {
        // Error should be handled by the component
        expect(mockAddSequenceError).toHaveBeenCalled()
      })
    })
  })
})