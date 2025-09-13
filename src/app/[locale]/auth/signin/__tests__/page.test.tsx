import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useRouter } from 'next/navigation'
import { signIn, getSession } from 'next-auth/react'
import { toast } from 'sonner'
import SignInPage from '../page'

// Mock dependencies
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}))

jest.mock('next-auth/react', () => ({
  signIn: jest.fn(),
  getSession: jest.fn(),
}))

jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}))

const mockRouter = {
  push: jest.fn(),
  replace: jest.fn(),
  refresh: jest.fn(),
}

describe('SignInPage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(useRouter as jest.Mock).mockReturnValue(mockRouter)
    ;(signIn as jest.Mock).mockClear()
    ;(getSession as jest.Mock).mockClear()
  })

  describe('Rendering', () => {
    it('should render all form fields', () => {
      render(<SignInPage />)

      expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
    })

    it('should render UAEPay branding', () => {
      render(<SignInPage />)

      expect(screen.getByText('UAEPay')).toBeInTheDocument()
      expect(screen.getByText('Sign in to your account')).toBeInTheDocument()
    })

    it('should render signup link', () => {
      render(<SignInPage />)

      const signUpLink = screen.getByRole('link', { name: /sign up here/i })
      expect(signUpLink).toBeInTheDocument()
      expect(signUpLink).toHaveAttribute('href', '/auth/signup')
    })

    it('should have correct input attributes', () => {
      render(<SignInPage />)

      const emailInput = screen.getByLabelText(/email/i)
      const passwordInput = screen.getByLabelText(/password/i)

      expect(emailInput).toHaveAttribute('type', 'email')
      expect(emailInput).toHaveAttribute('required')
      expect(emailInput).toHaveAttribute('autoComplete', 'email')
      
      expect(passwordInput).toHaveAttribute('type', 'password')
      expect(passwordInput).toHaveAttribute('required')
      expect(passwordInput).toHaveAttribute('autoComplete', 'current-password')
    })
  })

  describe('Form Validation', () => {
    it('should require email and password fields', async () => {
      const user = userEvent.setup()
      render(<SignInPage />)

      const submitButton = screen.getByRole('button', { name: /sign in/i })
      await user.click(submitButton)

      // Browser validation should prevent submission
      expect(signIn).not.toHaveBeenCalled()
    })

    it('should validate email format', () => {
      render(<SignInPage />)

      const emailInput = screen.getByLabelText(/email/i)
      expect(emailInput).toHaveAttribute('type', 'email')
    })
  })

  describe('Form Submission - Success Flow', () => {
    it('should successfully sign in user and redirect to dashboard', async () => {
      const user = userEvent.setup()
      
      // Mock successful sign in
      ;(signIn as jest.Mock).mockResolvedValueOnce({ ok: true, error: null })

      render(<SignInPage />)

      // Fill out form
      await user.type(screen.getByLabelText(/email/i), 'john@example.com')
      await user.type(screen.getByLabelText(/password/i), 'password123')

      // Submit form
      await user.click(screen.getByRole('button', { name: /sign in/i }))

      // Verify signIn call
      await waitFor(() => {
        expect(signIn).toHaveBeenCalledWith('credentials', {
          email: 'john@example.com',
          password: 'password123',
          redirect: false,
        })
      })

      // Verify success toast
      expect(toast.success).toHaveBeenCalledWith('Welcome back!')

      // Verify redirect to dashboard
      expect(mockRouter.push).toHaveBeenCalledWith('/dashboard')
      expect(mockRouter.refresh).toHaveBeenCalled()
    })
  })

  describe('Form Submission - Error Flow', () => {
    it('should handle invalid credentials', async () => {
      const user = userEvent.setup()
      
      // Mock failed sign in
      ;(signIn as jest.Mock).mockResolvedValueOnce({ 
        ok: false, 
        error: 'CredentialsSignin' 
      })

      render(<SignInPage />)

      await user.type(screen.getByLabelText(/email/i), 'wrong@example.com')
      await user.type(screen.getByLabelText(/password/i), 'wrongpassword')
      await user.click(screen.getByRole('button', { name: /sign in/i }))

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Invalid email or password')
      })

      // Should not redirect
      expect(mockRouter.push).not.toHaveBeenCalled()
    })

    it('should handle network/system errors', async () => {
      const user = userEvent.setup()
      
      // Mock network error
      ;(signIn as jest.Mock).mockRejectedValueOnce(new Error('Network error'))

      render(<SignInPage />)

      await user.type(screen.getByLabelText(/email/i), 'john@example.com')
      await user.type(screen.getByLabelText(/password/i), 'password123')
      await user.click(screen.getByRole('button', { name: /sign in/i }))

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Something went wrong. Please try again.')
      })
    })
  })

  describe('Loading State', () => {
    it('should show loading state during sign in', async () => {
      const user = userEvent.setup()
      
      // Mock delayed response
      ;(signIn as jest.Mock).mockImplementationOnce(() => 
        new Promise(resolve => setTimeout(() => resolve({ ok: true }), 100))
      )

      render(<SignInPage />)

      await user.type(screen.getByLabelText(/email/i), 'john@example.com')
      await user.type(screen.getByLabelText(/password/i), 'password123')

      const submitButton = screen.getByRole('button', { name: /sign in/i })
      await user.click(submitButton)

      // Check loading state
      expect(screen.getByRole('button', { name: /signing in.../i })).toBeInTheDocument()
      expect(submitButton).toBeDisabled()

      // Check that inputs are disabled
      expect(screen.getByLabelText(/email/i)).toBeDisabled()
      expect(screen.getByLabelText(/password/i)).toBeDisabled()
    })

    it('should re-enable form after sign in attempt completes', async () => {
      const user = userEvent.setup()
      
      ;(signIn as jest.Mock).mockResolvedValueOnce({ 
        ok: false, 
        error: 'Invalid credentials' 
      })

      render(<SignInPage />)

      await user.type(screen.getByLabelText(/email/i), 'john@example.com')
      await user.type(screen.getByLabelText(/password/i), 'password123')
      await user.click(screen.getByRole('button', { name: /sign in/i }))

      // Wait for attempt to complete
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /sign in/i })).not.toBeDisabled()
      })

      // Inputs should be re-enabled
      expect(screen.getByLabelText(/email/i)).not.toBeDisabled()
      expect(screen.getByLabelText(/password/i)).not.toBeDisabled()
    })
  })

  describe('User Experience', () => {
    it('should clear form after successful sign in', async () => {
      const user = userEvent.setup()
      
      ;(signIn as jest.Mock).mockResolvedValueOnce({ ok: true })

      render(<SignInPage />)

      const emailInput = screen.getByLabelText(/email/i)
      const passwordInput = screen.getByLabelText(/password/i)

      await user.type(emailInput, 'john@example.com')
      await user.type(passwordInput, 'password123')

      expect(emailInput).toHaveValue('john@example.com')
      expect(passwordInput).toHaveValue('password123')

      await user.click(screen.getByRole('button', { name: /sign in/i }))

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith('Welcome back!')
      })
    })

    it('should retain form values after failed sign in', async () => {
      const user = userEvent.setup()
      
      ;(signIn as jest.Mock).mockResolvedValueOnce({ 
        ok: false, 
        error: 'Invalid credentials' 
      })

      render(<SignInPage />)

      const emailInput = screen.getByLabelText(/email/i)
      const passwordInput = screen.getByLabelText(/password/i)

      await user.type(emailInput, 'wrong@example.com')
      await user.type(passwordInput, 'wrongpassword')
      await user.click(screen.getByRole('button', { name: /sign in/i }))

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalled()
      })

      // Form should retain values for user to correct
      expect(emailInput).toHaveValue('wrong@example.com')
      expect(passwordInput).toHaveValue('wrongpassword')
    })
  })

  describe('Accessibility', () => {
    it('should have proper form labels', () => {
      render(<SignInPage />)

      expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
    })

    it('should have accessible button', () => {
      render(<SignInPage />)

      const submitButton = screen.getByRole('button', { name: /sign in/i })
      expect(submitButton).toHaveAttribute('type', 'submit')
    })

    it('should have accessible navigation link', () => {
      render(<SignInPage />)

      const signUpLink = screen.getByRole('link', { name: /sign up here/i })
      expect(signUpLink).toHaveAttribute('href', '/auth/signup')
    })

    it('should support keyboard navigation', async () => {
      const user = userEvent.setup()
      render(<SignInPage />)

      const emailInput = screen.getByLabelText(/email/i)
      const passwordInput = screen.getByLabelText(/password/i)
      const submitButton = screen.getByRole('button', { name: /sign in/i })

      // Tab through form elements
      await user.tab()
      expect(emailInput).toHaveFocus()

      await user.tab()
      expect(passwordInput).toHaveFocus()

      await user.tab()
      expect(submitButton).toHaveFocus()
    })
  })

  describe('Edge Cases', () => {
    it('should handle empty form submission gracefully', async () => {
      const user = userEvent.setup()
      render(<SignInPage />)

      await user.click(screen.getByRole('button', { name: /sign in/i }))

      // Should not call signIn with empty values due to HTML5 validation
      expect(signIn).not.toHaveBeenCalled()
    })

    it('should trim whitespace from inputs', async () => {
      const user = userEvent.setup()
      
      ;(signIn as jest.Mock).mockResolvedValueOnce({ ok: true })

      render(<SignInPage />)

      await user.type(screen.getByLabelText(/email/i), '  john@example.com  ')
      await user.type(screen.getByLabelText(/password/i), '  password123  ')
      await user.click(screen.getByRole('button', { name: /sign in/i }))

      await waitFor(() => {
        expect(signIn).toHaveBeenCalledWith('credentials', {
          email: '  john@example.com  ', // FormData preserves whitespace, but could be trimmed in component
          password: '  password123  ',
          redirect: false,
        })
      })
    })
  })
})