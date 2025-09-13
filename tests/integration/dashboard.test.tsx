import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SessionProvider } from 'next-auth/react';
import { NextIntlClientProvider } from 'next-intl';
import '@testing-library/jest-dom';

import { DashboardLayout } from '@/components/layout/dashboard-layout';

// Mock next-intl
const mockMessages = {
  navigation: {
    dashboard: 'Dashboard',
    invoices: 'Invoices',
    customers: 'Customers',
    followUps: 'Follow-ups',
    reports: 'Reports',
    settings: 'Settings'
  }
};

// Mock session
const mockSession = {
  user: {
    id: '1',
    name: 'Test User',
    email: 'test@example.com',
    companyId: 'comp-1'
  },
  expires: '2024-12-31'
};

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <SessionProvider session={mockSession}>
    <NextIntlClientProvider 
      locale="en" 
      messages={mockMessages}
      timeZone="Asia/Dubai"
    >
      {children}
    </NextIntlClientProvider>
  </SessionProvider>
);

// Mock next/navigation
jest.mock('next/navigation', () => ({
  usePathname: () => '/en/dashboard',
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
  }),
}));

describe('Dashboard Integration', () => {
  it('renders all navigation items correctly', () => {
    render(
      <TestWrapper>
        <DashboardLayout>
          <div>Dashboard Content</div>
        </DashboardLayout>
      </TestWrapper>
    );

    // Check sidebar navigation
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Invoices')).toBeInTheDocument();
    expect(screen.getByText('Import Invoices')).toBeInTheDocument();
    expect(screen.getByText('Email Templates')).toBeInTheDocument();
    expect(screen.getByText('Customers')).toBeInTheDocument();
    expect(screen.getByText('Follow-ups')).toBeInTheDocument();
    expect(screen.getByText('Reports')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  it('handles mobile navigation correctly', async () => {
    render(
      <TestWrapper>
        <DashboardLayout>
          <div>Dashboard Content</div>
        </DashboardLayout>
      </TestWrapper>
    );

    // Mobile menu button should be present
    const menuButton = screen.getByRole('button', { name: /menu/i });
    expect(menuButton).toBeInTheDocument();

    // Click mobile menu
    fireEvent.click(menuButton);

    // Mobile sidebar should be visible
    await waitFor(() => {
      const mobileSidebar = document.querySelector('[class*="fixed inset-0"]');
      expect(mobileSidebar).toBeInTheDocument();
    });
  });

  it('displays UAE branding correctly', () => {
    render(
      <TestWrapper>
        <DashboardLayout>
          <div>Dashboard Content</div>
        </DashboardLayout>
      </TestWrapper>
    );

    // UAE branding should be visible
    expect(screen.getByText('UAEPay')).toBeInTheDocument();
    
    // Building icon should be present
    const buildingIcon = document.querySelector('[class*="lucide-building2"]');
    expect(buildingIcon).toBeInTheDocument();
  });

  it('supports RTL layout for Arabic', () => {
    render(
      <NextIntlClientProvider 
        locale="ar" 
        messages={mockMessages}
        timeZone="Asia/Dubai"
      >
        <SessionProvider session={mockSession}>
          <DashboardLayout>
            <div>Dashboard Content</div>
          </DashboardLayout>
        </SessionProvider>
      </NextIntlClientProvider>
    );

    // Should have RTL styling
    const container = document.querySelector('[class*="rtl"]');
    expect(container).toBeInTheDocument();
  });

  it('handles user session display', () => {
    render(
      <TestWrapper>
        <DashboardLayout>
          <div>Dashboard Content</div>
        </DashboardLayout>
      </TestWrapper>
    );

    // User info should be displayed in header
    expect(screen.getByText('Test User')).toBeInTheDocument();
    expect(screen.getByText('test@example.com')).toBeInTheDocument();
  });
});