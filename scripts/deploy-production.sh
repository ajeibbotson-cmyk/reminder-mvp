#!/bin/bash

# Production Deployment Script for Reminder MVP
# This script automates the deployment process to Vercel

set -e  # Exit on any error

echo "🚀 Starting Production Deployment Process..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    print_error "Vercel CLI is not installed"
    print_status "Installing Vercel CLI..."
    npm install -g vercel
fi

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    print_error "package.json not found. Are you in the project root?"
    exit 1
fi

# Check if .env.production exists
if [ ! -f ".env.production" ]; then
    print_warning ".env.production not found"
    print_status "Please create .env.production using .env.production.template"
    print_status "Copy template: cp .env.production.template .env.production"
    print_status "Then edit .env.production with your production values"
    exit 1
fi

# Pre-deployment checks
print_status "Running pre-deployment checks..."

# Check if build passes
print_status "Testing production build..."
npm run build
if [ $? -eq 0 ]; then
    print_success "Build successful"
else
    print_error "Build failed. Please fix errors before deploying."
    exit 1
fi

# Run linting
print_status "Running linting checks..."
npm run lint
if [ $? -eq 0 ]; then
    print_success "Linting passed"
else
    print_warning "Linting issues found. Consider fixing before deployment."
fi

# Run type checking
print_status "Running TypeScript checks..."
npx tsc --noEmit
if [ $? -eq 0 ]; then
    print_success "TypeScript checks passed"
else
    print_error "TypeScript errors found. Please fix before deploying."
    exit 1
fi

# Generate Prisma client
print_status "Generating Prisma client..."
npx prisma generate
print_success "Prisma client generated"

# Deployment
print_status "Deploying to Vercel..."

# Check if this is the first deployment
if [ ! -f ".vercel/project.json" ]; then
    print_status "First time deployment detected"
    print_status "This will create a new Vercel project"
    vercel --prod
else
    print_status "Deploying to existing project"
    vercel --prod
fi

if [ $? -eq 0 ]; then
    print_success "🎉 Deployment completed successfully!"
    print_status "Your application is now live on Vercel"

    # Get deployment URL
    DEPLOYMENT_URL=$(vercel ls | grep "reminder-mvp" | head -1 | awk '{print $2}')
    if [ ! -z "$DEPLOYMENT_URL" ]; then
        print_success "Deployment URL: https://$DEPLOYMENT_URL"
    fi

    print_status "Next steps:"
    echo "  1. Test your production deployment"
    echo "  2. Configure your custom domain (if needed)"
    echo "  3. Set up monitoring and alerts"
    echo "  4. Update DNS records for custom domain"

else
    print_error "Deployment failed"
    exit 1
fi

echo ""
print_success "Production deployment process completed!"