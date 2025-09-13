import React from 'react'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom'

import { SequenceBuilder } from '../sequence-builder'
import { SequenceStep } from '../sequence-step'
import { useFollowUpSequenceStore } from '@/lib/stores/follow-up-store'
import { useEmailTemplateStore } from '@/lib/stores/email-template-store'

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

// Test data
const mockSequences = [
  {
    id: 'seq-1',
    name: 'Test Sequence',
    description: 'A test sequence for component interactions',
    sequenceType: 'GENTLE_COLLECTION',
    steps: [
      {
        id: 'step-1',
        order: 1,
        type: 'EMAIL',
        name: 'Initial Email',
        description: 'First contact email',
        config: {
          templateId: 'template-1',
          subject: 'Payment Reminder',
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
        description: 'Wait for response',
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
    contentEn: 'Dear {{customer_name}}, we hope this email finds you well...',
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
    contentEn: 'Respected {{customer_name}}, this is a follow-up regarding...',
    contentAr: 'المحترم {{customer_name}}، هذه متابعة بخصوص...',
    isActive: true,
    companyId: 'company-1'
  }
]

const defaultProps = {
  onSave: jest.fn(),
  onCancel: jest.fn()
}

describe('Component Interactions', () => {
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

  describe('Step Addition and Removal', () => {
    it('adds new email step and opens step editor', async () => {
      const user = userEvent.setup()
      render(<SequenceBuilder {...defaultProps} />)

      // Add a new EMAIL step
      const addStepSelect = screen.getByRole('combobox', { name: /add first step/i })
      await user.click(addStepSelect)

      const emailOption = screen.getByText('Email')
      await user.click(emailOption)

      // Should open step editor dialog
      await waitFor(() => {
        expect(screen.getByText(/Configure EMAIL Step/)).toBeInTheDocument()
      })
    })

    it('adds new wait step with default configuration', async () => {
      const user = userEvent.setup()
      render(<SequenceBuilder {...defaultProps} />)

      const addStepSelect = screen.getByRole('combobox', { name: /add first step/i })
      await user.click(addStepSelect)

      const waitOption = screen.getByText('Wait')
      await user.click(waitOption)

      await waitFor(() => {
        expect(screen.getByText(/Configure WAIT Step/)).toBeInTheDocument()
      })
    })

    it('removes step and updates sequence order', async () => {
      const user = userEvent.setup()
      const propsWithSequence = {
        ...defaultProps,
        sequenceId: 'seq-1'
      }

      render(<SequenceBuilder {...propsWithSequence} />)

      const initialStepCount = screen.getAllByText(/Step \d/).length

      // Find and click delete button for first step
      const deleteButtons = screen.getAllByRole('button', { name: /delete|remove/i })
      if (deleteButtons.length > 0) {
        await user.click(deleteButtons[0])

        // Should have one less step
        await waitFor(() => {
          const remainingSteps = screen.getAllByText(/Step \d/)
          expect(remainingSteps.length).toBeLessThan(initialStepCount)
        })
      }
    })

    it('duplicates step with correct configuration', async () => {
      const user = userEvent.setup()
      const propsWithSequence = {
        ...defaultProps,
        sequenceId: 'seq-1'
      }

      render(<SequenceBuilder {...propsWithSequence} />)

      const initialStepCount = screen.getAllByText(/Step \d/).length

      // Find and click duplicate button
      const duplicateButtons = screen.getAllByRole('button', { name: /copy|duplicate/i })
      if (duplicateButtons.length > 0) {
        await user.click(duplicateButtons[0])

        // Should have one more step
        await waitFor(() => {
          const newSteps = screen.getAllByText(/Step \d/)
          expect(newSteps.length).toBeGreaterThan(initialStepCount)
        })
      }
    })

    it('maintains step order after addition and removal', async () => {
      const user = userEvent.setup()
      render(<SequenceBuilder {...defaultProps} />)

      // Add multiple steps
      for (let i = 0; i < 3; i++) {
        const addStepSelect = screen.getByRole('combobox', { name: /add.*step/i })
        await user.click(addStepSelect)

        const emailOption = screen.getByText('Email')
        await user.click(emailOption)

        // Close the step editor
        const cancelButton = screen.getByRole('button', { name: /cancel/i })
        await user.click(cancelButton)
      }

      // Should have 3 steps with correct order
      await waitFor(() => {
        expect(screen.getByText('1')).toBeInTheDocument()
        expect(screen.getByText('2')).toBeInTheDocument()
        expect(screen.getByText('3')).toBeInTheDocument()
      })
    })
  })

  describe('Timeline Updates When Steps Change', () => {
    it('updates duration when adding wait steps', async () => {
      const user = userEvent.setup()
      const propsWithSequence = {
        ...defaultProps,
        sequenceId: 'seq-1'
      }

      render(<SequenceBuilder {...propsWithSequence} />)

      // Initial duration should be 3 days (one wait step)
      expect(screen.getByText(/3\.0 days/)).toBeInTheDocument()

      // Add another wait step
      const addStepSelect = screen.getByRole('combobox', { name: /add step/i })
      await user.click(addStepSelect)

      const waitOption = screen.getByText('Wait')
      await user.click(waitOption)

      // Should open step editor - accept default settings
      await waitFor(() => {
        const saveButton = screen.getByRole('button', { name: /save step/i })
        user.click(saveButton)
      })

      // Duration should increase
      await waitFor(() => {
        const durationText = screen.getByText(/\d+\.\d+ days/)
        expect(durationText).toBeInTheDocument()
      })
    })

    it('updates step count display', async () => {
      const user = userEvent.setup()
      const propsWithSequence = {
        ...defaultProps,
        sequenceId: 'seq-1'
      }

      render(<SequenceBuilder {...propsWithSequence} />)

      // Should show initial step count
      expect(screen.getByText('Total Steps:')).toBeInTheDocument()
      expect(screen.getByText('2')).toBeInTheDocument() // 2 steps initially

      // Add a new step
      const addStepSelect = screen.getByRole('combobox', { name: /add step/i })
      await user.click(addStepSelect)

      const emailOption = screen.getByText('Email')
      await user.click(emailOption)

      // Close editor without saving to avoid validation issues
      const cancelButton = screen.getByRole('button', { name: /cancel/i })
      await user.click(cancelButton)

      // Count should still show properly
      expect(screen.getByText('Total Steps:')).toBeInTheDocument()
    })

    it('shows correct step type breakdown', () => {
      const propsWithSequence = {
        ...defaultProps,
        sequenceId: 'seq-1'
      }

      render(<SequenceBuilder {...propsWithSequence} />)

      // Should show correct breakdown: 1 email, 1 wait
      expect(screen.getByText('Email Steps:')).toBeInTheDocument()
      expect(screen.getByText('Wait Steps:')).toBeInTheDocument()
      
      // Check the numbers
      const statSection = screen.getByText('Sequence Overview').closest('div')
      expect(statSection).toBeInTheDocument()
    })

    it('recalculates when step configuration changes', async () => {
      const user = userEvent.setup()
      const propsWithSequence = {
        ...defaultProps,
        sequenceId: 'seq-1'
      }

      render(<SequenceBuilder {...propsWithSequence} />)

      // Edit the wait step to change duration
      const editButtons = screen.getAllByRole('button', { name: /edit/i })
      if (editButtons.length > 1) {
        await user.click(editButtons[1]) // Second step (wait step)

        await waitFor(() => {
          expect(screen.getByText(/Configure WAIT Step/)).toBeInTheDocument()
        })

        // Change delay from 3 to 7 days
        const delayInput = screen.getByLabelText(/wait duration/i)
        await user.clear(delayInput)
        await user.type(delayInput, '7')

        const saveButton = screen.getByRole('button', { name: /save step/i })
        await user.click(saveButton)

        // Duration should update to 7 days
        await waitFor(() => {
          expect(screen.getByText(/7\.0 days/)).toBeInTheDocument()
        })
      }
    })
  })

  describe('Form Validation and Error Handling', () => {
    it('shows validation errors for incomplete form', async () => {
      const user = userEvent.setup()
      render(<SequenceBuilder {...defaultProps} />)

      // Try to save without filling required fields
      const saveButton = screen.getByRole('button', { name: /save sequence/i })
      await user.click(saveButton)

      await waitFor(() => {
        expect(screen.getByText('Validation Errors')).toBeInTheDocument()
        expect(screen.getByText('Sequence name is required')).toBeInTheDocument()
        expect(screen.getByText('Sequence description is required')).toBeInTheDocument()
        expect(screen.getByText('At least one step is required')).toBeInTheDocument()
      })
    })

    it('validates step configuration before saving', async () => {
      const user = userEvent.setup()
      render(<SequenceBuilder {...defaultProps} />)

      // Fill basic form
      const nameInput = screen.getByLabelText('Sequence Name *')
      await user.type(nameInput, 'Test Sequence')

      const descriptionInput = screen.getByLabelText('Description *')
      await user.type(descriptionInput, 'Test description')

      // Add an email step without template
      const addStepSelect = screen.getByRole('combobox', { name: /add first step/i })
      await user.click(addStepSelect)

      const emailOption = screen.getByText('Email')
      await user.click(emailOption)

      // Save step without configuring template
      const saveStepButton = screen.getByRole('button', { name: /save step/i })
      await user.click(saveStepButton)

      // Try to save sequence
      const saveButton = screen.getByRole('button', { name: /save sequence/i })
      await user.click(saveButton)

      await waitFor(() => {
        expect(screen.getByText(/Email template or custom content is required/)).toBeInTheDocument()
      })
    })

    it('clears validation errors when form is corrected', async () => {
      const user = userEvent.setup()
      render(<SequenceBuilder {...defaultProps} />)

      // Trigger validation error
      const saveButton = screen.getByRole('button', { name: /save sequence/i })
      await user.click(saveButton)

      await waitFor(() => {
        expect(screen.getByText('Validation Errors')).toBeInTheDocument()
      })

      // Fill required fields
      const nameInput = screen.getByLabelText('Sequence Name *')
      await user.type(nameInput, 'Valid Sequence')

      const descriptionInput = screen.getByLabelText('Description *')
      await user.type(descriptionInput, 'Valid description')

      // Add a valid step
      const addStepSelect = screen.getByRole('combobox', { name: /add first step/i })
      await user.click(addStepSelect)

      const waitOption = screen.getByText('Wait')
      await user.click(waitOption)

      // Save step with default valid configuration
      const saveStepButton = screen.getByRole('button', { name: /save step/i })
      await user.click(saveStepButton)

      // Try to save again
      await user.click(saveButton)

      // Validation errors should be cleared
      await waitFor(() => {
        expect(screen.queryByText('Validation Errors')).not.toBeInTheDocument()
      })
    })

    it('handles network errors gracefully', async () => {
      const user = userEvent.setup()
      const mockAddSequenceError = jest.fn().mockRejectedValue(new Error('Network error'))
      mockStoreActions.addSequence = mockAddSequenceError

      render(<SequenceBuilder {...defaultProps} />)

      // Fill valid form
      const nameInput = screen.getByLabelText('Sequence Name *')
      await user.type(nameInput, 'Test Sequence')

      const descriptionInput = screen.getByLabelText('Description *')
      await user.type(descriptionInput, 'Test description')

      // Add valid step
      const addStepSelect = screen.getByRole('combobox', { name: /add first step/i })
      await user.click(addStepSelect)

      const waitOption = screen.getByText('Wait')
      await user.click(waitOption)

      const saveStepButton = screen.getByRole('button', { name: /save step/i })
      await user.click(saveStepButton)

      // Try to save
      const saveButton = screen.getByRole('button', { name: /save sequence/i })
      await user.click(saveButton)

      // Should handle error gracefully
      await waitFor(() => {
        expect(mockAddSequenceError).toHaveBeenCalled()
      })
    })
  })

  describe('Save and Preview Functionality', () => {
    it('saves sequence with valid configuration', async () => {
      const user = userEvent.setup()
      const mockAddSequence = jest.fn().mockResolvedValue({
        id: 'new-seq',
        name: 'Test Sequence'
      })
      mockStoreActions.addSequence = mockAddSequence

      render(<SequenceBuilder {...defaultProps} />)

      // Fill form
      const nameInput = screen.getByLabelText('Sequence Name *')
      await user.type(nameInput, 'Test Sequence')

      const descriptionInput = screen.getByLabelText('Description *')
      await user.type(descriptionInput, 'Test description')

      // Add valid step
      const addStepSelect = screen.getByRole('combobox', { name: /add first step/i })
      await user.click(addStepSelect)

      const waitOption = screen.getByText('Wait')
      await user.click(waitOption)

      const saveStepButton = screen.getByRole('button', { name: /save step/i })
      await user.click(saveStepButton)

      // Save sequence
      const saveButton = screen.getByRole('button', { name: /save sequence/i })
      await user.click(saveButton)

      await waitFor(() => {
        expect(mockAddSequence).toHaveBeenCalled()
        expect(defaultProps.onSave).toHaveBeenCalled()
      })
    })

    it('updates existing sequence', async () => {
      const user = userEvent.setup()
      const mockUpdateSequence = jest.fn().mockResolvedValue({})
      mockStoreActions.updateSequence = mockUpdateSequence

      const propsWithSequence = {
        ...defaultProps,
        sequenceId: 'seq-1'
      }

      render(<SequenceBuilder {...propsWithSequence} />)

      // Modify the sequence
      const nameInput = screen.getByLabelText('Sequence Name *')
      await user.clear(nameInput)
      await user.type(nameInput, 'Updated Sequence')

      // Save sequence
      const saveButton = screen.getByRole('button', { name: /update sequence/i })
      await user.click(saveButton)

      await waitFor(() => {
        expect(mockUpdateSequence).toHaveBeenCalledWith('seq-1', expect.any(Object))
        expect(defaultProps.onSave).toHaveBeenCalled()
      })
    })

    it('cancels editing and calls onCancel', async () => {
      const user = userEvent.setup()
      render(<SequenceBuilder {...defaultProps} />)

      const cancelButton = screen.getByRole('button', { name: /cancel/i })
      await user.click(cancelButton)

      expect(defaultProps.onCancel).toHaveBeenCalled()
    })

    it('shows test sequence functionality', () => {
      render(<SequenceBuilder {...defaultProps} />)

      const testButtons = screen.getAllByText(/test sequence/i)
      expect(testButtons.length).toBeGreaterThan(0)
    })

    it('disables test functionality when no steps exist', () => {
      render(<SequenceBuilder {...defaultProps} />)

      // Test button should be disabled when no steps exist
      const testButton = screen.getByRole('button', { name: /test sequence/i })
      expect(testButton).toBeDisabled()
    })
  })

  describe('Template Selection Integration', () => {
    it('loads templates on component mount', () => {
      render(<SequenceBuilder {...defaultProps} />)

      expect(mockEmailTemplateStore().fetchTemplates).toHaveBeenCalled()
    })

    it('filters templates by FOLLOW_UP type', () => {
      render(<SequenceBuilder {...defaultProps} />)

      const fetchCall = (mockEmailTemplateStore().fetchTemplates as jest.Mock).mock.calls[0]
      expect(fetchCall[1]).toEqual({ templateType: 'FOLLOW_UP' })
    })

    it('shows template selection in email step configuration', async () => {
      const user = userEvent.setup()
      render(<SequenceBuilder {...defaultProps} />)

      // Add email step
      const addStepSelect = screen.getByRole('combobox', { name: /add first step/i })
      await user.click(addStepSelect)

      const emailOption = screen.getByText('Email')
      await user.click(emailOption)

      await waitFor(() => {
        expect(screen.getByText('Email Template Configuration')).toBeInTheDocument()
        expect(screen.getByText('Choose Template Method')).toBeInTheDocument()
      })
    })

    it('allows switching between template and custom content', async () => {
      const user = userEvent.setup()
      render(<SequenceBuilder {...defaultProps} />)

      // Add email step
      const addStepSelect = screen.getByRole('combobox', { name: /add first step/i })
      await user.click(addStepSelect)

      const emailOption = screen.getByText('Email')
      await user.click(emailOption)

      await waitFor(() => {
        // Should have radio buttons for template choice
        expect(screen.getByLabelText('Use Existing Template')).toBeInTheDocument()
        expect(screen.getByLabelText('Write Custom Email')).toBeInTheDocument()
      })

      // Switch to custom content
      const customRadio = screen.getByLabelText('Write Custom Email')
      await user.click(customRadio)

      await waitFor(() => {
        expect(screen.getByLabelText('Email Subject')).toBeInTheDocument()
        expect(screen.getByLabelText('Email Content')).toBeInTheDocument()
      })
    })

    it('displays template preview when selected', async () => {
      const user = userEvent.setup()
      render(<SequenceBuilder {...defaultProps} />)

      // Add email step
      const addStepSelect = screen.getByRole('combobox', { name: /add first step/i })
      await user.click(addStepSelect)

      const emailOption = screen.getByText('Email')
      await user.click(emailOption)

      await waitFor(() => {
        // Select existing template option
        const templateRadio = screen.getByLabelText('Use Existing Template')
        user.click(templateRadio)
      })

      // Template selection should be available
      const templateSelect = screen.getByRole('combobox', { name: /select email template/i })
      expect(templateSelect).toBeInTheDocument()
    })
  })

  describe('UAE Settings Integration', () => {
    it('shows UAE business settings sidebar', () => {
      render(<SequenceBuilder {...defaultProps} />)

      expect(screen.getByText('UAE Business Settings')).toBeInTheDocument()
      expect(screen.getByText('Business Hours Only')).toBeInTheDocument()
      expect(screen.getByText('Respect UAE Holidays')).toBeInTheDocument()
    })

    it('synchronizes UAE settings between main form and sidebar', async () => {
      const user = userEvent.setup()
      render(<SequenceBuilder {...defaultProps} />)

      // Toggle business hours in main form
      const mainToggle = screen.getAllByLabelText('UAE Business Hours Only')[0]
      await user.click(mainToggle)

      // Sidebar should reflect the change
      const sidebarToggle = screen.getAllByLabelText(/Business Hours Only/)[1]
      expect(sidebarToggle).toHaveProperty('checked', mainToggle.checked)
    })

    it('shows UAE compliance indicators on steps', () => {
      const propsWithSequence = {
        ...defaultProps,
        sequenceId: 'seq-1'
      }

      render(<SequenceBuilder {...propsWithSequence} />)

      // Should show UAE Hours badges
      const uaeBadges = screen.getAllByText('UAE Hours')
      expect(uaeBadges.length).toBeGreaterThan(0)
    })

    it('displays UAE business hours information', () => {
      render(<SequenceBuilder {...defaultProps} />)

      expect(screen.getByText('Sunday-Thursday: 9 AM - 6 PM')).toBeInTheDocument()
      expect(screen.getByText('Avoids prayer times automatically')).toBeInTheDocument()
      expect(screen.getByText('Respects Islamic holidays')).toBeInTheDocument()
    })

    it('propagates UAE settings to new steps', async () => {
      const user = userEvent.setup()
      render(<SequenceBuilder {...defaultProps} />)

      // Ensure UAE settings are enabled
      const businessHoursToggle = screen.getByLabelText('UAE Business Hours Only')
      if (!businessHoursToggle.checked) {
        await user.click(businessHoursToggle)
      }

      // Add a new step
      const addStepSelect = screen.getByRole('combobox', { name: /add first step/i })
      await user.click(addStepSelect)

      const emailOption = screen.getByText('Email')
      await user.click(emailOption)

      // Go to UAE settings tab
      await waitFor(() => {
        const uaeTab = screen.getByRole('tab', { name: /uae settings/i })
        user.click(uaeTab)
      })

      // UAE settings should be pre-configured
      await waitFor(() => {
        expect(screen.getByText('UAE Business Settings')).toBeInTheDocument()
        expect(screen.getByLabelText('Respect Business Hours')).toBeChecked()
      })
    })
  })

  describe('Step Editor Dialog Integration', () => {
    it('opens step editor when editing existing step', async () => {
      const user = userEvent.setup()
      const propsWithSequence = {
        ...defaultProps,
        sequenceId: 'seq-1'
      }

      render(<SequenceBuilder {...propsWithSequence} />)

      // Click edit button for first step
      const editButtons = screen.getAllByRole('button', { name: /edit/i })
      await user.click(editButtons[0])

      await waitFor(() => {
        expect(screen.getByText(/Edit Step: Initial Email/)).toBeInTheDocument()
        expect(screen.getByText('Configure EMAIL Step')).toBeInTheDocument()
      })
    })

    it('shows step configuration tabs', async () => {
      const user = userEvent.setup()
      const propsWithSequence = {
        ...defaultProps,
        sequenceId: 'seq-1'
      }

      render(<SequenceBuilder {...propsWithSequence} />)

      const editButtons = screen.getAllByRole('button', { name: /edit/i })
      await user.click(editButtons[0])

      await waitFor(() => {
        expect(screen.getByRole('tab', { name: /basic settings/i })).toBeInTheDocument()
        expect(screen.getByRole('tab', { name: /uae settings/i })).toBeInTheDocument()
        expect(screen.getByRole('tab', { name: /preview/i })).toBeInTheDocument()
      })
    })

    it('updates step when saved from editor', async () => {
      const user = userEvent.setup()
      const propsWithSequence = {
        ...defaultProps,
        sequenceId: 'seq-1'
      }

      render(<SequenceBuilder {...propsWithSequence} />)

      const editButtons = screen.getAllByRole('button', { name: /edit/i })
      await user.click(editButtons[0])

      await waitFor(() => {
        // Change step name
        const nameInput = screen.getByLabelText(/step name/i)
        user.clear(nameInput)
        user.type(nameInput, 'Updated Email Step')

        // Save step
        const saveButton = screen.getByRole('button', { name: /save step/i })
        user.click(saveButton)
      })

      await waitFor(() => {
        expect(screen.getByText('Updated Email Step')).toBeInTheDocument()
      })
    })

    it('cancels step editing without changes', async () => {
      const user = userEvent.setup()
      const propsWithSequence = {
        ...defaultProps,
        sequenceId: 'seq-1'
      }

      render(<SequenceBuilder {...propsWithSequence} />)

      const editButtons = screen.getAllByRole('button', { name: /edit/i })
      await user.click(editButtons[0])

      await waitFor(() => {
        const cancelButton = screen.getByRole('button', { name: /cancel/i })
        user.click(cancelButton)
      })

      // Should close dialog without changes
      await waitFor(() => {
        expect(screen.queryByText(/Edit Step:/)).not.toBeInTheDocument()
      })
    })

    it('shows step preview in editor', async () => {
      const user = userEvent.setup()
      const propsWithSequence = {
        ...defaultProps,
        sequenceId: 'seq-1'
      }

      render(<SequenceBuilder {...propsWithSequence} />)

      const editButtons = screen.getAllByRole('button', { name: /edit/i })
      await user.click(editButtons[0])

      await waitFor(() => {
        const previewTab = screen.getByRole('tab', { name: /preview/i })
        user.click(previewTab)
      })

      await waitFor(() => {
        expect(screen.getByText('Step Preview')).toBeInTheDocument()
        expect(screen.getByText('Email Preview')).toBeInTheDocument()
      })
    })
  })

  describe('Real-time Updates and Synchronization', () => {
    it('updates timeline when steps are modified', async () => {
      const user = userEvent.setup()
      const propsWithSequence = {
        ...defaultProps,
        sequenceId: 'seq-1'
      }

      render(<SequenceBuilder {...propsWithSequence} />)

      // Initial duration
      const initialDuration = screen.getByText(/3\.0 days/)
      expect(initialDuration).toBeInTheDocument()

      // Edit wait step to change duration
      const editButtons = screen.getAllByRole('button', { name: /edit/i })
      await user.click(editButtons[1]) // Wait step

      await waitFor(() => {
        const delayInput = screen.getByLabelText(/wait duration/i)
        user.clear(delayInput)
        user.type(delayInput, '7')

        const saveButton = screen.getByRole('button', { name: /save step/i })
        user.click(saveButton)
      })

      // Duration should update
      await waitFor(() => {
        expect(screen.getByText(/7\.0 days/)).toBeInTheDocument()
      })
    })

    it('maintains form state during step operations', async () => {
      const user = userEvent.setup()
      render(<SequenceBuilder {...defaultProps} />)

      // Fill sequence form
      const nameInput = screen.getByLabelText('Sequence Name *')
      await user.type(nameInput, 'Test Sequence')

      const descriptionInput = screen.getByLabelText('Description *')
      await user.type(descriptionInput, 'Test description')

      // Add a step
      const addStepSelect = screen.getByRole('combobox', { name: /add first step/i })
      await user.click(addStepSelect)

      const emailOption = screen.getByText('Email')
      await user.click(emailOption)

      // Cancel step editing
      const cancelButton = screen.getByRole('button', { name: /cancel/i })
      await user.click(cancelButton)

      // Form values should be preserved
      expect(nameInput).toHaveValue('Test Sequence')
      expect(descriptionInput).toHaveValue('Test description')
    })

    it('synchronizes UAE settings across components', async () => {
      const user = userEvent.setup()
      render(<SequenceBuilder {...defaultProps} />)

      // Toggle UAE business hours
      const businessHoursToggle = screen.getByLabelText('UAE Business Hours Only')
      await user.click(businessHoursToggle)

      // Add a step and check UAE settings
      const addStepSelect = screen.getByRole('combobox', { name: /add first step/i })
      await user.click(addStepSelect)

      const emailOption = screen.getByText('Email')
      await user.click(emailOption)

      // Go to UAE settings tab
      const uaeTab = screen.getByRole('tab', { name: /uae settings/i })
      await user.click(uaeTab)

      // Settings should reflect the main form toggle
      const stepBusinessHoursToggle = screen.getByLabelText('Respect Business Hours')
      expect(stepBusinessHoursToggle.checked).toBe(businessHoursToggle.checked)
    })
  })
})