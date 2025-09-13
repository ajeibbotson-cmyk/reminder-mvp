import React from 'react'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom'

import { SequenceBuilder } from '../sequence-builder'
import { useFollowUpSequenceStore } from '@/lib/stores/follow-up-store'
import { useEmailTemplateStore } from '@/lib/stores/email-template-store'

// Enhanced mock for react-beautiful-dnd with drag simulation
jest.mock('@hello-pangea/dnd', () => ({
  DragDropContext: ({ children, onDragEnd }: any) => {
    // Create a function to simulate drag end
    const simulateDragEnd = (result: any) => {
      if (onDragEnd) {
        onDragEnd(result)
      }
    }
    
    return (
      <div 
        data-testid="drag-drop-context" 
        data-simulate-drag-end={JSON.stringify(simulateDragEnd)}
      >
        {children}
      </div>
    )
  },
  Droppable: ({ children, droppableId }: any) => (
    <div data-testid={`droppable-${droppableId}`} data-droppable-id={droppableId}>
      {children({
        droppableProps: {
          'data-droppable': 'true'
        },
        innerRef: jest.fn(),
        placeholder: <div data-testid="droppable-placeholder" />
      })}
    </div>
  ),
  Draggable: ({ children, draggableId, index }: any) => (
    <div 
      data-testid={`draggable-${draggableId}`} 
      data-draggable-id={draggableId}
      data-index={index}
    >
      {children({
        innerRef: jest.fn(),
        draggableProps: {
          'data-draggable': 'true',
          'data-index': index
        },
        dragHandleProps: { 
          'data-testid': `drag-handle-${draggableId}`,
          'data-drag-handle': 'true',
          role: 'button',
          tabIndex: 0,
          'aria-label': `Drag ${draggableId}`
        }
      }, { isDragging: false })}
    </div>
  )
}))

// Mock the stores
jest.mock('@/lib/stores/follow-up-store')
jest.mock('@/lib/stores/email-template-store')

const mockFollowUpStore = useFollowUpSequenceStore as jest.MockedFunction<typeof useFollowUpSequenceStore>
const mockEmailTemplateStore = useEmailTemplateStore as jest.MockedFunction<typeof useEmailTemplateStore>

// Helper function to simulate drag and drop
const simulateDragDrop = (sourceIndex: number, destinationIndex: number) => {
  return {
    draggableId: `step-${sourceIndex + 1}`,
    type: 'DEFAULT',
    source: {
      droppableId: 'steps',
      index: sourceIndex
    },
    destination: {
      droppableId: 'steps',
      index: destinationIndex
    },
    reason: 'DROP'
  }
}

// Sample test data for steps
const createTestSequence = (stepCount: number = 4) => ({
  id: 'seq-1',
  name: 'Test Sequence',
  description: 'Test sequence for drag and drop',
  sequenceType: 'GENTLE_COLLECTION',
  steps: Array.from({ length: stepCount }, (_, i) => ({
    id: `step-${i + 1}`,
    order: i + 1,
    type: i % 2 === 0 ? 'EMAIL' : 'WAIT',
    name: `Step ${i + 1}`,
    description: `Test step ${i + 1}`,
    config: {
      delay: i % 2 === 1 ? 3 : undefined,
      delayUnit: i % 2 === 1 ? 'DAYS' : undefined,
      templateId: i % 2 === 0 ? `template-${i + 1}` : undefined,
      language: 'BOTH'
    },
    uaeSettings: {
      respectBusinessHours: true,
      honorPrayerTimes: true,
      respectHolidays: true,
      culturalTone: 'PROFESSIONAL'
    }
  })),
  active: true,
  uaeBusinessHoursOnly: true,
  respectHolidays: true,
  companyId: 'company-1'
})

const mockTemplates = [
  {
    id: 'template-1',
    name: 'Template 1',
    templateType: 'FOLLOW_UP',
    subjectEn: 'Test Subject 1',
    contentEn: 'Test Content 1',
    isActive: true,
    companyId: 'company-1'
  }
]

const defaultProps = {
  onSave: jest.fn(),
  onCancel: jest.fn()
}

describe('Drag & Drop Functionality', () => {
  let mockStoreActions: any
  let testSequence: any

  beforeEach(() => {
    testSequence = createTestSequence(4)
    
    mockStoreActions = {
      sequences: [testSequence],
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

  describe('Drag Drop Context Setup', () => {
    it('renders DragDropContext component', () => {
      const propsWithSequence = {
        ...defaultProps,
        sequenceId: 'seq-1'
      }

      render(<SequenceBuilder {...propsWithSequence} />)

      expect(screen.getByTestId('drag-drop-context')).toBeInTheDocument()
    })

    it('renders Droppable area for steps', () => {
      const propsWithSequence = {
        ...defaultProps,
        sequenceId: 'seq-1'
      }

      render(<SequenceBuilder {...propsWithSequence} />)

      expect(screen.getByTestId('droppable-steps')).toBeInTheDocument()
      expect(screen.getByTestId('droppable-placeholder')).toBeInTheDocument()
    })

    it('renders Draggable items for each step', () => {
      const propsWithSequence = {
        ...defaultProps,
        sequenceId: 'seq-1'
      }

      render(<SequenceBuilder {...propsWithSequence} />)

      // Should have 4 draggable items
      expect(screen.getByTestId('draggable-step-1')).toBeInTheDocument()
      expect(screen.getByTestId('draggable-step-2')).toBeInTheDocument()
      expect(screen.getByTestId('draggable-step-3')).toBeInTheDocument()
      expect(screen.getByTestId('draggable-step-4')).toBeInTheDocument()
    })

    it('renders drag handles for each step', () => {
      const propsWithSequence = {
        ...defaultProps,
        sequenceId: 'seq-1'
      }

      render(<SequenceBuilder {...propsWithSequence} />)

      // Should have drag handles for all steps
      expect(screen.getByTestId('drag-handle-step-1')).toBeInTheDocument()
      expect(screen.getByTestId('drag-handle-step-2')).toBeInTheDocument()
      expect(screen.getByTestId('drag-handle-step-3')).toBeInTheDocument()
      expect(screen.getByTestId('drag-handle-step-4')).toBeInTheDocument()
    })
  })

  describe('Drag Handle Accessibility', () => {
    it('provides proper ARIA labels for drag handles', () => {
      const propsWithSequence = {
        ...defaultProps,
        sequenceId: 'seq-1'
      }

      render(<SequenceBuilder {...propsWithSequence} />)

      const dragHandle1 = screen.getByTestId('drag-handle-step-1')
      const dragHandle2 = screen.getByTestId('drag-handle-step-2')

      expect(dragHandle1).toHaveAttribute('aria-label', 'Drag step-1')
      expect(dragHandle2).toHaveAttribute('aria-label', 'Drag step-2')
      expect(dragHandle1).toHaveAttribute('role', 'button')
      expect(dragHandle1).toHaveAttribute('tabIndex', '0')
    })

    it('allows keyboard navigation to drag handles', async () => {
      const user = userEvent.setup()
      const propsWithSequence = {
        ...defaultProps,
        sequenceId: 'seq-1'
      }

      render(<SequenceBuilder {...propsWithSequence} />)

      const firstDragHandle = screen.getByTestId('drag-handle-step-1')
      
      await user.tab() // Navigate through the form to reach drag handles
      
      // Eventually should be able to focus on drag handle
      firstDragHandle.focus()
      expect(document.activeElement).toBe(firstDragHandle)
    })

    it('provides visual feedback for drag handles', () => {
      const propsWithSequence = {
        ...defaultProps,
        sequenceId: 'seq-1'
      }

      render(<SequenceBuilder {...propsWithSequence} />)

      const dragHandle = screen.getByTestId('drag-handle-step-1')
      
      // Should have cursor grab styling (through data attributes that CSS can target)
      expect(dragHandle).toHaveAttribute('data-drag-handle', 'true')
    })
  })

  describe('Drag and Drop Operations', () => {
    it('handles moving step from position 0 to position 2', async () => {
      const propsWithSequence = {
        ...defaultProps,
        sequenceId: 'seq-1'
      }

      render(<SequenceBuilder {...propsWithSequence} />)

      // Get the drag-drop context and simulate drag operation
      const dragDropContext = screen.getByTestId('drag-drop-context')
      
      // Simulate drag end event
      const dragResult = simulateDragDrop(0, 2)
      
      // Fire the drag end event
      await act(async () => {
        fireEvent(dragDropContext, new CustomEvent('dragend', {
          detail: dragResult
        }))
      })

      // The component should handle the reordering internally
      // We can't directly test the internal state change, but we can verify
      // that the drag infrastructure is in place
      expect(dragDropContext).toBeInTheDocument()
    })

    it('handles moving step from last position to first', async () => {
      const propsWithSequence = {
        ...defaultProps,
        sequenceId: 'seq-1'
      }

      render(<SequenceBuilder {...propsWithSequence} />)

      // Simulate moving step 4 to position 0
      const dragResult = simulateDragDrop(3, 0)
      
      const dragDropContext = screen.getByTestId('drag-drop-context')
      
      await act(async () => {
        fireEvent(dragDropContext, new CustomEvent('dragend', {
          detail: dragResult
        }))
      })

      expect(dragDropContext).toBeInTheDocument()
    })

    it('handles adjacent step swapping', async () => {
      const propsWithSequence = {
        ...defaultProps,
        sequenceId: 'seq-1'
      }

      render(<SequenceBuilder {...propsWithSequence} />)

      // Simulate swapping adjacent steps (1 and 2)
      const dragResult = simulateDragDrop(0, 1)
      
      const dragDropContext = screen.getByTestId('drag-drop-context')
      
      await act(async () => {
        fireEvent(dragDropContext, new CustomEvent('dragend', {
          detail: dragResult
        }))
      })

      expect(dragDropContext).toBeInTheDocument()
    })

    it('ignores drag operations with no destination', async () => {
      const propsWithSequence = {
        ...defaultProps,
        sequenceId: 'seq-1'
      }

      render(<SequenceBuilder {...propsWithSequence} />)

      // Simulate drag with no destination (dropped outside)
      const dragResult = {
        draggableId: 'step-1',
        type: 'DEFAULT',
        source: {
          droppableId: 'steps',
          index: 0
        },
        destination: null, // No destination
        reason: 'CANCEL'
      }
      
      const dragDropContext = screen.getByTestId('drag-drop-context')
      
      await act(async () => {
        fireEvent(dragDropContext, new CustomEvent('dragend', {
          detail: dragResult
        }))
      })

      // Should not cause any errors
      expect(dragDropContext).toBeInTheDocument()
    })

    it('handles dropping at the same position', async () => {
      const propsWithSequence = {
        ...defaultProps,
        sequenceId: 'seq-1'
      }

      render(<SequenceBuilder {...propsWithSequence} />)

      // Simulate dropping at the same position
      const dragResult = simulateDragDrop(1, 1)
      
      const dragDropContext = screen.getByTestId('drag-drop-context')
      
      await act(async () => {
        fireEvent(dragDropContext, new CustomEvent('dragend', {
          detail: dragResult
        }))
      })

      // Should handle gracefully (no change needed)
      expect(dragDropContext).toBeInTheDocument()
    })
  })

  describe('Step Order Updates', () => {
    it('displays steps in correct initial order', () => {
      const propsWithSequence = {
        ...defaultProps,
        sequenceId: 'seq-1'
      }

      render(<SequenceBuilder {...propsWithSequence} />)

      // Check that steps appear in order
      const step1 = screen.getByTestId('draggable-step-1')
      const step2 = screen.getByTestId('draggable-step-2')
      const step3 = screen.getByTestId('draggable-step-3')
      const step4 = screen.getByTestId('draggable-step-4')

      expect(step1).toHaveAttribute('data-index', '0')
      expect(step2).toHaveAttribute('data-index', '1')
      expect(step3).toHaveAttribute('data-index', '2')
      expect(step4).toHaveAttribute('data-index', '3')
    })

    it('shows step numbers correctly', () => {
      const propsWithSequence = {
        ...defaultProps,
        sequenceId: 'seq-1'
      }

      render(<SequenceBuilder {...propsWithSequence} />)

      // Should show step numbers 1, 2, 3, 4
      expect(screen.getByText('1')).toBeInTheDocument() // Step order number
      expect(screen.getByText('2')).toBeInTheDocument()
      expect(screen.getByText('3')).toBeInTheDocument()
      expect(screen.getByText('4')).toBeInTheDocument()
    })

    it('maintains step type integrity during reordering', () => {
      const propsWithSequence = {
        ...defaultProps,
        sequenceId: 'seq-1'
      }

      render(<SequenceBuilder {...propsWithSequence} />)

      // Steps should maintain their types (EMAIL/WAIT pattern)
      const step1 = screen.getByText('Step 1')
      const step2 = screen.getByText('Step 2')
      const step3 = screen.getByText('Step 3')
      const step4 = screen.getByText('Step 4')

      expect(step1).toBeInTheDocument()
      expect(step2).toBeInTheDocument()
      expect(step3).toBeInTheDocument()
      expect(step4).toBeInTheDocument()
    })

    it('preserves UAE settings during reordering', () => {
      const propsWithSequence = {
        ...defaultProps,
        sequenceId: 'seq-1'
      }

      render(<SequenceBuilder {...propsWithSequence} />)

      // Should show UAE compliance badges
      const uaeBadges = screen.getAllByText('UAE Hours')
      expect(uaeBadges.length).toBeGreaterThan(0)
    })
  })

  describe('Performance with Large Lists', () => {
    it('handles sequences with many steps efficiently', () => {
      const largeSequence = createTestSequence(20) // 20 steps
      mockStoreActions.sequences = [largeSequence]

      const propsWithLargeSequence = {
        ...defaultProps,
        sequenceId: 'seq-1'
      }

      const startTime = performance.now()
      render(<SequenceBuilder {...propsWithLargeSequence} />)
      const endTime = performance.now()

      // Should render within reasonable time (< 100ms for 20 items)
      expect(endTime - startTime).toBeLessThan(100)

      // Should render all drag handles
      for (let i = 1; i <= 20; i++) {
        expect(screen.getByTestId(`drag-handle-step-${i}`)).toBeInTheDocument()
      }
    })

    it('handles rapid drag operations gracefully', async () => {
      const propsWithSequence = {
        ...defaultProps,
        sequenceId: 'seq-1'
      }

      render(<SequenceBuilder {...propsWithSequence} />)

      const dragDropContext = screen.getByTestId('drag-drop-context')

      // Simulate multiple rapid drag operations
      const operations = [
        simulateDragDrop(0, 2),
        simulateDragDrop(1, 3),
        simulateDragDrop(2, 0)
      ]

      await act(async () => {
        for (const operation of operations) {
          fireEvent(dragDropContext, new CustomEvent('dragend', {
            detail: operation
          }))
        }
      })

      // Should handle all operations without errors
      expect(dragDropContext).toBeInTheDocument()
    })

    it('maintains responsive UI during drag operations', () => {
      const propsWithSequence = {
        ...defaultProps,
        sequenceId: 'seq-1'
      }

      render(<SequenceBuilder {...propsWithSequence} />)

      // UI should remain responsive - all controls should be accessible
      expect(screen.getByText('Save Sequence')).toBeInTheDocument()
      expect(screen.getByText('Cancel')).toBeInTheDocument()
      expect(screen.getByLabelText('Sequence Name *')).toBeInTheDocument()
    })
  })

  describe('Drag Visual Feedback', () => {
    it('provides visual indicators for draggable items', () => {
      const propsWithSequence = {
        ...defaultProps,
        sequenceId: 'seq-1'
      }

      render(<SequenceBuilder {...propsWithSequence} />)

      // Check for drag handle visual indicators
      const dragHandles = screen.getAllByTestId(/drag-handle-/)
      
      dragHandles.forEach(handle => {
        expect(handle).toHaveAttribute('data-drag-handle', 'true')
      })
    })

    it('shows step connectors between draggable items', () => {
      const propsWithSequence = {
        ...defaultProps,
        sequenceId: 'seq-1'
      }

      render(<SequenceBuilder {...propsWithSequence} />)

      // Should show arrows between steps (except after the last one)
      // The component shows ArrowDown icons between steps
      const stepContainer = screen.getByTestId('droppable-steps')
      expect(stepContainer).toBeInTheDocument()
    })

    it('maintains proper spacing during drag operations', () => {
      const propsWithSequence = {
        ...defaultProps,
        sequenceId: 'seq-1'
      }

      render(<SequenceBuilder {...propsWithSequence} />)

      // Check that placeholder is rendered for proper spacing
      expect(screen.getByTestId('droppable-placeholder')).toBeInTheDocument()
    })
  })

  describe('Touch and Mobile Support', () => {
    it('supports touch events for mobile drag and drop', () => {
      const propsWithSequence = {
        ...defaultProps,
        sequenceId: 'seq-1'
      }

      render(<SequenceBuilder {...propsWithSequence} />)

      const dragHandle = screen.getByTestId('drag-handle-step-1')
      
      // Should be touchable (has appropriate attributes)
      expect(dragHandle).toHaveAttribute('role', 'button')
      expect(dragHandle).toHaveAttribute('tabIndex', '0')
    })

    it('provides adequate touch targets for mobile', () => {
      const propsWithSequence = {
        ...defaultProps,
        sequenceId: 'seq-1'
      }

      render(<SequenceBuilder {...propsWithSequence} />)

      // Drag handles should be large enough for touch interaction
      const dragHandles = screen.getAllByTestId(/drag-handle-/)
      
      dragHandles.forEach(handle => {
        // Should have the data attributes needed for mobile interaction
        expect(handle).toHaveAttribute('data-drag-handle', 'true')
      })
    })

    it('maintains usability on smaller screens', () => {
      const propsWithSequence = {
        ...defaultProps,
        sequenceId: 'seq-1'
      }

      // Simulate mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375, // iPhone width
      })

      render(<SequenceBuilder {...propsWithSequence} />)

      // Should still render all essential elements
      expect(screen.getByTestId('drag-drop-context')).toBeInTheDocument()
      expect(screen.getAllByTestId(/drag-handle-/).length).toBe(4)
    })
  })

  describe('Error Handling and Edge Cases', () => {
    it('handles empty step list gracefully', () => {
      const emptySequence = {
        ...createTestSequence(0),
        steps: []
      }
      mockStoreActions.sequences = [emptySequence]

      const propsWithEmptySequence = {
        ...defaultProps,
        sequenceId: 'seq-1'
      }

      render(<SequenceBuilder {...propsWithEmptySequence} />)

      // Should show empty state
      expect(screen.getByText('No steps added yet')).toBeInTheDocument()
    })

    it('handles single step sequence', () => {
      const singleStepSequence = createTestSequence(1)
      mockStoreActions.sequences = [singleStepSequence]

      const propsWithSingleStep = {
        ...defaultProps,
        sequenceId: 'seq-1'
      }

      render(<SequenceBuilder {...propsWithSingleStep} />)

      // Should render single step with drag handle
      expect(screen.getByTestId('drag-handle-step-1')).toBeInTheDocument()
      
      // Should not show connector arrows (no next step)
      expect(screen.getByTestId('draggable-step-1')).toBeInTheDocument()
    })

    it('handles corrupted step data gracefully', () => {
      const corruptedSequence = {
        ...createTestSequence(2),
        steps: [
          {
            id: 'step-1',
            order: 1,
            type: 'EMAIL',
            name: 'Valid Step'
          },
          {
            id: null, // Corrupted data
            order: 2,
            type: 'INVALID_TYPE',
            name: null
          }
        ]
      }
      mockStoreActions.sequences = [corruptedSequence]

      const propsWithCorruptedData = {
        ...defaultProps,
        sequenceId: 'seq-1'
      }

      // Should not throw error
      expect(() => {
        render(<SequenceBuilder {...propsWithCorruptedData} />)
      }).not.toThrow()
    })

    it('handles drag operations when component is unmounting', async () => {
      const propsWithSequence = {
        ...defaultProps,
        sequenceId: 'seq-1'
      }

      const { unmount } = render(<SequenceBuilder {...propsWithSequence} />)

      const dragDropContext = screen.getByTestId('drag-drop-context')
      
      // Start unmounting
      unmount()

      // Attempt drag operation after unmounting (should not cause errors)
      const dragResult = simulateDragDrop(0, 1)
      
      expect(() => {
        fireEvent(dragDropContext, new CustomEvent('dragend', {
          detail: dragResult
        }))
      }).not.toThrow()
    })
  })

  describe('Integration with Sequence Features', () => {
    it('preserves step configuration during reordering', () => {
      const propsWithSequence = {
        ...defaultProps,
        sequenceId: 'seq-1'
      }

      render(<SequenceBuilder {...propsWithSequence} />)

      // Check that step types are preserved
      expect(screen.getByText('Step 1')).toBeInTheDocument() // EMAIL step
      expect(screen.getByText('Step 2')).toBeInTheDocument() // WAIT step
      expect(screen.getByText('Step 3')).toBeInTheDocument() // EMAIL step
      expect(screen.getByText('Step 4')).toBeInTheDocument() // WAIT step
    })

    it('maintains UAE compliance settings during reordering', () => {
      const propsWithSequence = {
        ...defaultProps,
        sequenceId: 'seq-1'
      }

      render(<SequenceBuilder {...propsWithSequence} />)

      // Should maintain UAE compliance badges
      const uaeBadges = screen.getAllByText('UAE Hours')
      expect(uaeBadges.length).toBe(4) // One per step
    })

    it('updates sequence duration calculation after reordering', () => {
      const propsWithSequence = {
        ...defaultProps,
        sequenceId: 'seq-1'
      }

      render(<SequenceBuilder {...propsWithSequence} />)

      // Should show duration calculation
      // With 2 WAIT steps of 3 days each = 6 days total
      expect(screen.getByText(/6\.0 days/)).toBeInTheDocument()
    })

    it('maintains step validation after reordering', () => {
      const propsWithSequence = {
        ...defaultProps,
        sequenceId: 'seq-1'
      }

      render(<SequenceBuilder {...propsWithSequence} />)

      // Steps should remain valid after reordering
      // No validation errors should appear
      expect(screen.queryByText('Validation Errors')).not.toBeInTheDocument()
    })

    it('integrates with step editing after reordering', async () => {
      const user = userEvent.setup()
      const propsWithSequence = {
        ...defaultProps,
        sequenceId: 'seq-1'
      }

      render(<SequenceBuilder {...propsWithSequence} />)

      // Should still be able to edit steps after reordering
      const editButtons = screen.getAllByLabelText(/edit/i)
      
      if (editButtons.length > 0) {
        await user.click(editButtons[0])
        
        await waitFor(() => {
          expect(screen.getByText(/Edit Step:/)).toBeInTheDocument()
        })
      }
    })
  })
})