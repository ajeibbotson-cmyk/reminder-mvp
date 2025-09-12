import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { FollowUpSequence } from '@prisma/client'
import { FollowUpSequenceState, ApiResponse } from '../types/store'

export const useFollowUpSequenceStore = create<FollowUpSequenceState>()(
  devtools(
    (set, get) => ({
      sequences: [],
      loading: false,
      error: null,

      fetchSequences: async (companyId: string) => {
        set({ loading: true, error: null })
        
        try {
          const response = await fetch(`/api/follow-up-sequences?companyId=${companyId}`)
          
          if (!response.ok) {
            throw new Error(`Failed to fetch follow-up sequences: ${response.statusText}`)
          }

          const result: ApiResponse<FollowUpSequence[]> = await response.json()
          
          if (!result.success) {
            throw new Error(result.error || 'Failed to fetch follow-up sequences')
          }

          set({ 
            sequences: result.data || [], 
            loading: false 
          })
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
          set({ error: errorMessage, loading: false })
          throw error
        }
      },

      addSequence: async (sequenceData) => {
        set({ loading: true, error: null })
        
        try {
          const response = await fetch('/api/follow-up-sequences', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(sequenceData),
          })

          if (!response.ok) {
            throw new Error(`Failed to create follow-up sequence: ${response.statusText}`)
          }

          const result: ApiResponse<FollowUpSequence> = await response.json()
          
          if (!result.success) {
            throw new Error(result.error || 'Failed to create follow-up sequence')
          }

          const newSequence = result.data!
          
          // Add the new sequence to local state
          set(state => ({
            sequences: [...state.sequences, newSequence],
            loading: false
          }))

          return newSequence
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
          set({ error: errorMessage, loading: false })
          throw error
        }
      },

      updateSequence: async (id: string, updates) => {
        set({ loading: true, error: null })
        
        try {
          const response = await fetch(`/api/follow-up-sequences/${id}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(updates),
          })

          if (!response.ok) {
            throw new Error(`Failed to update follow-up sequence: ${response.statusText}`)
          }

          const result: ApiResponse<FollowUpSequence> = await response.json()
          
          if (!result.success) {
            throw new Error(result.error || 'Failed to update follow-up sequence')
          }

          // Update the sequence in local state
          set(state => ({
            sequences: state.sequences.map(sequence =>
              sequence.id === id ? { ...sequence, ...updates } : sequence
            ),
            loading: false
          }))
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
          set({ error: errorMessage, loading: false })
          throw error
        }
      },

      deleteSequence: async (id: string) => {
        set({ loading: true, error: null })
        
        try {
          const response = await fetch(`/api/follow-up-sequences/${id}`, {
            method: 'DELETE',
          })

          if (!response.ok) {
            throw new Error(`Failed to delete follow-up sequence: ${response.statusText}`)
          }

          const result: ApiResponse<void> = await response.json()
          
          if (!result.success) {
            throw new Error(result.error || 'Failed to delete follow-up sequence')
          }

          // Remove the sequence from local state
          set(state => ({
            sequences: state.sequences.filter(sequence => sequence.id !== id),
            loading: false
          }))
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
          set({ error: errorMessage, loading: false })
          throw error
        }
      },

      toggleSequenceActive: async (id: string) => {
        set({ loading: true, error: null })
        
        try {
          const sequence = get().sequences.find(s => s.id === id)
          if (!sequence) {
            throw new Error('Sequence not found')
          }

          const response = await fetch(`/api/follow-up-sequences/${id}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ active: !sequence.active }),
          })

          if (!response.ok) {
            throw new Error(`Failed to toggle sequence status: ${response.statusText}`)
          }

          const result: ApiResponse<FollowUpSequence> = await response.json()
          
          if (!result.success) {
            throw new Error(result.error || 'Failed to toggle sequence status')
          }

          // Update the sequence status in local state
          set(state => ({
            sequences: state.sequences.map(seq =>
              seq.id === id ? { ...seq, active: !seq.active } : seq
            ),
            loading: false
          }))
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
          set({ error: errorMessage, loading: false })
          throw error
        }
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: 'follow-up-sequence-store',
    }
  )
)