import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useRouter } from 'next/navigation'
import { signIn } from 'next-auth/react'
import { toast } from 'sonner'
import SignUpPage from '../page'

// Mock dependencies
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}))

jest.mock('next-auth/react', () => ({
  signIn: jest.fn(),
}))

jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}))

// Mock fetch
global.fetch = jest.fn()

const mockRouter = {
  push: jest.fn(),
  replace: jest.fn(),
  refresh: jest.fn(),
}

describe('SignUpPage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(useRouter as jest.Mock).mockReturnValue(mockRouter)
    ;(fetch as jest.Mock).mockClear()
    ;(signIn as jest.Mock).mockClear()
  })

  describe('Rendering', () => {
    it('should render all form fields', () => {
      render(<SignUpPage />)

      expect(screen.getByLabelText(/name/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/company/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument()
    })

    it('should render UAEPay branding', () => {
      render(<SignUpPage />)

      expect(screen.getByText('UAEPay')).toBeInTheDocument()
      expect(screen.getByText('Create your account to get started')).toBeInTheDocument()
    })

    it('should render sign in link', () => {
      render(<SignUpPage />)

      const signInLink = screen.getByRole('link', { name: /sign in here/i })
      expect(signInLink).toBeInTheDocument()
      expect(signInLink).toHaveAttribute('href', '/en/auth/signin')
    })

    it('should have correct input attributes', () => {
      render(<SignUpPage />)

      const emailInput = screen.getByLabelText(/email/i)
      const passwordInput = screen.getByLabelText(/password/i)
      const nameInput = screen.getByLabelText(/name/i)
      const companyInput = screen.getByLabelText(/company/i)

      expect(emailInput).toHaveAttribute('type', 'email')
      expect(emailInput).toHaveAttribute('required')
      expect(passwordInput).toHaveAttribute('type', 'password')
      expect(passwordInput).toHaveAttribute('minLength', '8')
      expect(nameInput).toHaveAttribute('required')
      expect(companyInput).toHaveAttribute('required')
    })
  })

  describe('Form Validation', () => {
    it('should require all fields', async () => {
      const user = userEvent.setup()
      render(<SignUpPage />)

      const submitButton = screen.getByRole('button', { name: /create account/i })
      await user.click(submitButton)

      // Browser validation should prevent submission
      expect(fetch).not.toHaveBeenCalled()
    })

    it('should validate password minimum length', () => {
      render(<SignUpPage />)

      const passwordInput = screen.getByLabelText(/password/i)
      expect(passwordInput).toHaveAttribute('minLength', '8')
    })
  })

  describe('Form Submission - Success Flow', () => {
    it('should successfully create account and auto-login user', async () => {
      const user = userEvent.setup()
      
      // Mock successful API responses
      ;(fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: 'User created successfully' })
      })
      ;(signIn as jest.Mock).mockResolvedValueOnce({ ok: true })

      render(<SignUpPage />)

      // Fill out form
      await user.type(screen.getByLabelText(/name/i), 'John Doe')
      await user.type(screen.getByLabelText(/email/i), 'john@example.com')
      await user.type(screen.getByLabelText(/company/i), 'Acme Corp')
      await user.type(screen.getByLabelText(/password/i), 'password123')

      // Submit form
      await user.click(screen.getByRole('button', { name: /create account/i }))

      // Verify API call
      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith('/api/auth/signup', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: 'john@example.com',
            password: 'password123',
            name: 'John Doe',
            company: 'Acme Corp',
          }),
        })
      })

      // Verify auto sign-in
      expect(signIn).toHaveBeenCalledWith('credentials', {
        email: 'john@example.com',
        password: 'password123',
        redirect: false,
      })

      // Verify success toast
      expect(toast.success).toHaveBeenCalledWith('Account created successfully! Signing you in...')

      // Verify redirect to dashboard
      expect(mockRouter.push).toHaveBeenCalledWith('/en/dashboard')
    })

    it('should handle successful signup but failed auto-login', async () => {
      const user = userEvent.setup()
      
      ;(fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: 'User created successfully' })
      })
      ;(signIn as jest.Mock).mockResolvedValueOnce({ ok: false })

      render(<SignUpPage />)

      await user.type(screen.getByLabelText(/name/i), 'John Doe')
      await user.type(screen.getByLabelText(/email/i), 'john@example.com')
      await user.type(screen.getByLabelText(/company/i), 'Acme Corp')
      await user.type(screen.getByLabelText(/password/i), 'password123')
      await user.click(screen.getByRole('button', { name: /create account/i }))

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith('Account created successfully! Signing you in...')
        expect(toast.error).toHaveBeenCalledWith('Account created but sign in failed. Please sign in manually.')
        expect(mockRouter.push).toHaveBeenCalledWith('/en/auth/signin')
      })
    })
  })

  describe('Form Submission - Error Flow', () => {
    it('should handle API error response', async () => {
      const user = userEvent.setup()
      
      ;(fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ message: 'User already exists' })
      })

      render(<SignUpPage />)

      await user.type(screen.getByLabelText(/name/i), 'John Doe')
      await user.type(screen.getByLabelText(/email/i), 'existing@example.com')
      await user.type(screen.getByLabelText(/company/i), 'Acme Corp')
      await user.type(screen.getByLabelText(/password/i), 'password123')
      await user.click(screen.getByRole('button', { name: /create account/i }))

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('User already exists')
      })

      // Should not attempt sign in
      expect(signIn).not.toHaveBeenCalled()
    })

    it('should handle network error', async () => {
      const user = userEvent.setup()
      
      ;(fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'))

      render(<SignUpPage />)

      await user.type(screen.getByLabelText(/name/i), 'John Doe')
      await user.type(screen.getByLabelText(/email/i), 'john@example.com')
      await user.type(screen.getByLabelText(/company/i), 'Acme Corp')
      await user.type(screen.getByLabelText(/password/i), 'password123')
      await user.click(screen.getByRole('button', { name: /create account/i }))

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Something went wrong. Please try again.')
      })
    })
  })

  describe('Loading State', () => {
    it('should show loading state during form submission', async () => {
      const user = userEvent.setup()
      
      // Mock delayed response
      ;(fetch as jest.Mock).mockImplementationOnce(() => 
        new Promise(resolve => setTimeout(() => resolve({
          ok: true,
          json: async () => ({ message: 'Success' })
        }), 100))
      )

      render(<SignUpPage />)

      await user.type(screen.getByLabelText(/name/i), 'John Doe')
      await user.type(screen.getByLabelText(/email/i), 'john@example.com')
      await user.type(screen.getByLabelText(/company/i), 'Acme Corp')
      await user.type(screen.getByLabelText(/password/i), 'password123')

      const submitButton = screen.getByRole('button', { name: /create account/i })
      await user.click(submitButton)

      // Check loading state
      expect(screen.getByRole('button', { name: /creating account.../i })).toBeInTheDocument()
      expect(submitButton).toBeDisabled()

      // Check that inputs are disabled
      expect(screen.getByLabelText(/name/i)).toBeDisabled()
      expect(screen.getByLabelText(/email/i)).toBeDisabled()
      expect(screen.getByLabelText(/company/i)).toBeDisabled()
      expect(screen.getByLabelText(/password/i)).toBeDisabled()
    })

    it('should re-enable form after submission completes', async () => {
      const user = userEvent.setup()
      
      ;(fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ message: 'Error' })
      })

      render(<SignUpPage />)

      await user.type(screen.getByLabelText(/name/i), 'John Doe')
      await user.type(screen.getByLabelText(/email/i), 'john@example.com')
      await user.type(screen.getByLabelText(/company/i), 'Acme Corp')
      await user.type(screen.getByLabelText(/password/i), 'password123')
      await user.click(screen.getByRole('button', { name: /create account/i }))

      // Wait for submission to complete
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /create account/i })).not.toBeDisabled()
      })

      // Inputs should be re-enabled
      expect(screen.getByLabelText(/name/i)).not.toBeDisabled()
      expect(screen.getByLabelText(/email/i)).not.toBeDisabled()
      expect(screen.getByLabelText(/company/i)).not.toBeDisabled()
      expect(screen.getByLabelText(/password/i)).not.toBeDisabled()
    })
  })

  describe('Accessibility', () => {
    it('should have proper form labels', () => {
      render(<SignUpPage />)

      expect(screen.getByLabelText(/name/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/company/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
    })

    it('should have accessible button', () => {
      render(<SignUpPage />)

      const submitButton = screen.getByRole('button', { name: /create account/i })
      expect(submitButton).toHaveAttribute('type', 'submit')
    })

    it('should have accessible navigation link', () => {
      render(<SignUpPage />)

      const signInLink = screen.getByRole('link', { name: /sign in here/i })
      expect(signInLink).toHaveAttribute('href', '/en/auth/signin')
    })
  })
})