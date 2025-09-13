# UAEPay Testing Guide

## Overview
Comprehensive testing setup for UAEPay MVP with focus on UX validation and UAE-specific features.

## Testing Stack
- **Jest + React Testing Library**: Unit and integration tests
- **Playwright**: End-to-end testing across browsers
- **@faker-js/faker**: Test data generation
- **@testing-library/jest-dom**: Enhanced DOM assertions

## Test Commands

### Unit & Integration Tests
```bash
npm run test              # Run all Jest tests once
npm run test:watch        # Run tests in watch mode
npm run test:coverage     # Run with coverage report
npm run test:ci           # CI-optimized test run
```

### End-to-End Tests
```bash
npm run test:e2e          # Run all Playwright tests
npm run test:e2e:ui       # Run with Playwright UI
npm run test:e2e:debug    # Run in debug mode
npm run test:ux           # Run UX-focused user journey tests
```

### Complete Test Suite
```bash
npm run test:all          # Run both Jest and Playwright tests
```

## Test Structure

### Unit Tests (`src/**/__tests__/`)
- Component behavior testing
- Business logic validation
- UAE-specific functionality (TRN validation, AED formatting)
- Internationalization (English/Arabic)

### Integration Tests (`tests/integration/`)
- Component integration with providers
- API endpoint testing
- Database interactions
- Authentication flows

### E2E Tests (`tests/e2e/`)
- Complete user journeys
- Cross-browser compatibility
- Mobile responsiveness
- Performance validation

## UX Testing Focus Areas

### 1. User Registration & Authentication
- ✅ Company registration with UAE TRN
- ✅ Email/password validation
- ✅ Session management
- ✅ Redirect flows

### 2. Dashboard Navigation
- ✅ All sidebar sections accessible
- ✅ Mobile responsive navigation
- ✅ RTL support for Arabic
- ✅ Breadcrumb navigation

### 3. Invoice Management
- ✅ Create/edit invoice forms
- ✅ AED currency formatting
- ✅ Customer selection
- ✅ Item management
- ✅ VAT calculations (5% UAE rate)

### 4. Email Templates
- ✅ Template creation/editing
- ✅ Variable insertion
- ✅ Preview functionality
- ✅ Arabic/English content

### 5. Follow-up Sequences
- ✅ Multi-step sequence creation
- ✅ UAE business hours respect
- ✅ Holiday calendar integration
- ✅ Template assignment

### 6. Performance & Accessibility
- ✅ Page load times (<3 seconds)
- ✅ Keyboard navigation
- ✅ Screen reader compatibility
- ✅ WCAG 2.1 compliance

## UAE-Specific Testing

### Business Compliance
- **TRN Validation**: 15-digit format validation
- **VAT Rates**: 5% standard rate application
- **Currency**: AED formatting with proper Arabic numerals
- **Business Hours**: 9 AM - 6 PM GST compliance
- **Holidays**: UAE national holidays respect

### Cultural Considerations
- **RTL Layout**: Proper Arabic text direction
- **Date Formats**: dd/mm/yyyy preference
- **Number Formats**: Arabic-Indic digits option
- **Language Switching**: Seamless EN/AR transitions

## Running Tests

### Development Workflow
1. **Component Development**: Write unit tests first
2. **Integration**: Test component interactions
3. **E2E Validation**: User journey verification
4. **Performance Check**: Load time and responsiveness

### Before Deployment
```bash
# Full test suite
npm run test:all

# Check code coverage
npm run test:coverage

# Validate user flows
npm run test:ux
```

## Test Data Setup

### Database Seeding
Tests use isolated test database with:
- Sample companies with UAE TRNs
- Test customers with Dubai addresses
- Mock invoices in AED currency
- Email templates in EN/AR

### Authentication
- Test users with various roles (ADMIN, FINANCE, VIEWER)
- Mock NextAuth sessions
- JWT token validation

## Browser Support Testing

### Desktop Browsers
- Chrome (Latest)
- Firefox (Latest)
- Safari (Latest)
- Edge (Latest)

### Mobile Devices
- iOS Safari (iPhone 12+)
- Android Chrome (Pixel 5+)
- Responsive breakpoints: 320px, 768px, 1024px, 1440px

## Performance Benchmarks

### Target Metrics
- **First Contentful Paint**: <1.5s
- **Largest Contentful Paint**: <2.5s
- **Cumulative Layout Shift**: <0.1
- **Time to Interactive**: <3.0s

### Network Conditions
- Fast 3G simulation for mobile testing
- Slow 3G for worst-case scenarios
- WiFi for desktop optimization

## Accessibility Testing

### WCAG 2.1 AA Compliance
- Color contrast ratios ≥ 4.5:1
- Keyboard-only navigation
- Screen reader compatibility
- Alternative text for images
- Proper heading hierarchy

### UAE Language Support
- Arabic text rendering
- Right-to-left layout support
- Arabic number formatting
- Cultural date/time formats

## Continuous Integration

### GitHub Actions (Recommended)
```yaml
- name: Run Tests
  run: |
    npm run test:ci
    npm run test:e2e
```

### Local Pre-commit Hooks
```bash
# Install husky for git hooks
npm install --save-dev husky
npx husky add .husky/pre-commit "npm run test"
```

## Troubleshooting

### Common Issues
1. **Playwright Browser Installation**: Run `npx playwright install`
2. **Port Conflicts**: Use `--port 3001` for test server
3. **Database Connections**: Ensure test DB is accessible
4. **Timezone Issues**: Tests assume Asia/Dubai timezone

### Debug Commands
```bash
# Debug specific test
npx playwright test --debug user-journey.spec.ts

# View test results
npx playwright show-report
```

## Test Coverage Goals

### Minimum Coverage Targets
- **Statements**: 80%
- **Branches**: 75%
- **Functions**: 80%
- **Lines**: 80%

### Critical Path Coverage
- User registration: 100%
- Invoice creation: 100%
- Email sending: 95%
- Payment tracking: 90%

This comprehensive testing setup ensures UAEPay delivers a reliable, accessible, and culturally appropriate experience for UAE SMEs.