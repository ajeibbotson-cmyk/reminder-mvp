# UAEPay Email Template Testing Framework - Sprint 1.3

## Overview

I have implemented a comprehensive testing framework for the UAEPay platform's email template management system, specifically designed to validate UAE business culture compliance and bilingual support.

## Testing Framework Components

### 1. Core Testing Infrastructure

#### Jest Configuration (`jest.config.js`)
- **Multi-project setup**: Separate configurations for client-side and server-side tests
- **TypeScript support**: Full TypeScript integration with ts-jest
- **Path mapping**: Support for `@/` imports
- **Coverage configuration**: Comprehensive coverage collection from all source files

#### Setup Files
- **Client setup** (`jest.setup.js`): React Testing Library, Next.js router mocks, NextAuth mocks, next-intl mocks
- **Server setup** (`jest.server.setup.js`): Node.js environment setup, API mocking utilities

### 2. Testing Utilities

#### General Test Utils (`/src/lib/test-utils.ts`)
- **Custom render function**: `renderWithProviders()` with Session and NextIntl providers
- **Mock data generators**: Realistic test data for templates, companies, customers, invoices
- **Cultural validation helpers**: Functions to validate Arabic text, UAE business format compliance
- **Variable validation**: Template variable parsing and validation utilities

#### API Test Utils (`/src/lib/api-test-utils.ts`)
- **Next.js 15 API route testing**: Support for both Pages and App Router APIs
- **Authentication mocking**: Comprehensive auth context mocking
- **Database mocking**: Full Prisma client mocking with realistic data
- **Response validation**: Structured API response validation helpers
- **UAE-specific validators**: Bilingual template validation, business compliance checks

#### Database Test Setup (`/src/lib/test-db-setup.ts`)
- **Mock Prisma client**: Complete database operation mocking
- **Test data factories**: Realistic data generation for all models
- **Scenario builders**: Pre-configured test scenarios for different use cases
- **Transaction support**: Mocked database transaction handling

#### UAE-Specific Test Utils (`/src/lib/uae-test-utils.ts`)
- **Cultural compliance validation**: Business etiquette scoring and recommendations
- **Arabic language support**: RTL text validation, Arabic business phrase recognition
- **UAE business constants**: Business hours, VAT rates, TRN format, phone formats
- **Template scenario validation**: Gentle, professional, firm, and final notice validation
- **Multi-emirates support**: Different emirate variations and regional considerations

### 3. Component Tests

#### TemplateBuilder Component Tests (`/src/components/email-templates/__tests__/template-builder.test.tsx`)
**Test Coverage:**
- ✅ Basic rendering and form validation
- ✅ Tab navigation (Basic Info, Content, Settings, Advanced)
- ✅ Bilingual content editing (English/Arabic switching)
- ✅ Variable insertion from sidebar
- ✅ Quick template application
- ✅ UAE-specific settings (business hours, timezone)
- ✅ Cultural compliance validation
- ✅ Form submission and error handling
- ✅ Preview functionality
- ✅ Tag management
- ✅ Arabic RTL text support

#### TemplateLibrary Component Tests (`/src/components/email-templates/__tests__/template-library.test.tsx`)
**Test Coverage:**
- ✅ Template category display and navigation
- ✅ Search and filtering functionality
- ✅ Template preview dialog with bilingual tabs
- ✅ Template import/export functionality
- ✅ Usage statistics and effectiveness ratings
- ✅ UAE business template validation
- ✅ Arabic content recognition and display
- ✅ Cultural appropriateness indicators
- ✅ Performance with large template datasets
- ✅ Accessibility and keyboard navigation

### 4. API Endpoint Tests

#### Templates Collection API (`/src/app/api/email/templates/__tests__/route.test.ts`)
**Test Coverage:**
- ✅ GET: Paginated template listing with filtering
- ✅ GET: Usage statistics and template truncation
- ✅ GET: Company isolation and authentication
- ✅ POST: Template creation with validation
- ✅ POST: Bilingual template support
- ✅ POST: UAE business compliance validation
- ✅ POST: Default template handling
- ✅ POST: Activity logging
- ✅ Error handling and edge cases

#### Individual Template API (`/src/app/api/email/templates/[id]/__tests__/route.test.ts`)
**Test Coverage:**
- ✅ GET: Template retrieval with full content
- ✅ GET: Usage statistics inclusion
- ✅ PUT: Template updates and partial updates
- ✅ PUT: Default template switching logic
- ✅ DELETE: Template deletion with constraints
- ✅ DELETE: Preventing deletion of used templates
- ✅ Company isolation enforcement
- ✅ Cultural compliance validation during updates
- ✅ Concurrent update handling

### 5. UAE Cultural Compliance Tests

#### Comprehensive Cultural System Tests (`/src/lib/__tests__/uae-cultural-compliance.test.ts`)
**Test Coverage:**
- ✅ UAE business constants validation (hours, VAT, TRN, phone formats)
- ✅ Arabic language detection and RTL text handling
- ✅ Business etiquette validation (English and Arabic)
- ✅ Template scenario appropriateness (gentle, professional, firm, final)
- ✅ Cultural sensitivity (Ramadan templates, Islamic greetings)
- ✅ Multi-emirates support and regional variations
- ✅ Business hours compliance validation
- ✅ Error handling for edge cases

## UAE-Specific Test Features

### Cultural Compliance Validation
- **Business etiquette scoring**: 0-100 scale with recommendations
- **Tone appropriateness**: Validation for different escalation stages
- **Required elements**: TRN references, business hours mentions
- **Inappropriate language detection**: Aggressive or informal language flagging

### Bilingual Support Testing
- **Arabic text detection**: Unicode range validation for Arabic characters
- **RTL layout testing**: Direction attribute and CSS validation
- **Translation completeness**: Ensuring both English and Arabic content
- **Variable consistency**: Matching variables across languages

### UAE Business Scenarios
- **Escalation timeline**: Day 3 gentle → Day 7 professional → Day 15 firm → Day 30 final
- **Cultural sensitivity**: Ramadan hours, Islamic greetings, respect for local customs
- **Legal compliance**: UAE Commercial Law references, proper business format

### Regional Considerations
- **Seven emirates support**: Abu Dhabi, Dubai, Sharjah, Ajman, UAQ, RAK, Fujairah
- **Business hours variations**: Standard and Ramadan hour adjustments
- **TRN format validation**: 15-digit UAE Tax Registration Number format
- **Phone format validation**: UAE mobile (+971 5X) and landline formats

## Key Testing Metrics

### Coverage Areas
- **Components**: Form rendering, user interactions, validation
- **API Routes**: CRUD operations, authentication, authorization
- **Business Logic**: UAE compliance, cultural appropriateness
- **Data Layer**: Database operations, relationships, constraints
- **Edge Cases**: Error scenarios, concurrent operations, data integrity

### UAE-Specific Validations
- **Cultural appropriateness scoring**: Templates scored 0-100 for cultural fit
- **Bilingual completeness**: Both languages required and validated
- **Business hour compliance**: UAE working days and times enforced
- **Template escalation**: Appropriate tone for each collection stage
- **Legal compliance**: UAE commercial law and business practice adherence

## Running the Tests

```bash
# Run all tests
npm test

# Run specific test suites
npm test -- --testPathPatterns="template-builder"
npm test -- --testPathPatterns="template-library" 
npm test -- --testPathPatterns="email/templates"
npm test -- --testPathPatterns="uae-cultural-compliance"

# Run with coverage
npm run test:coverage

# Watch mode for development
npm run test:watch
```

## Test Data and Scenarios

### Pre-built Test Templates
- **Gentle Reminder**: Day 3, polite tone with relationship focus
- **Professional Follow-up**: Day 7, direct but respectful with payment options
- **Firm Notice**: Day 15, clear consequences while maintaining respect
- **Final Notice**: Day 30, formal legal implications, UAE law compliant
- **Welcome Series**: Onboarding with UAE hospitality
- **Payment Confirmations**: Professional acknowledgments
- **Ramadan Templates**: Culturally sensitive for holy month

### Cultural Test Cases
- **Appropriate greetings**: "Dear", "Respected", "Assalamu Alaikum"
- **Professional closings**: "Best regards", "Sincerely", "Fi Aman Allah"
- **Business elements**: TRN references, UAE business hours, payment portals
- **Arabic business terms**: فاتورة (invoice), الرقم الضريبي (TRN), شركة (company)

## Quality Assurance Features

### Automated Validation
- **Template content analysis**: Automatic cultural appropriateness scoring
- **Variable consistency**: Cross-language variable validation
- **Business compliance**: UAE regulation adherence checking
- **Accessibility**: ARIA labels, keyboard navigation, screen reader support

### Error Prevention
- **Template preview**: Real-time preview with variable substitution
- **Validation feedback**: Immediate feedback on cultural issues
- **Required field enforcement**: Bilingual content requirements
- **Business hour constraints**: Send-time validation against UAE hours

This comprehensive testing framework ensures that the UAEPay email template system meets both technical requirements and cultural expectations for the UAE market, providing a robust foundation for professional business communications.