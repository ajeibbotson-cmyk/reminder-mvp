#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔍 UAEPay Testing Diagnostics\n');

// Check what files exist and their dependencies
function scanForImports(directory, results = new Set()) {
  if (!fs.existsSync(directory)) return results;
  
  const files = fs.readdirSync(directory);
  
  for (const file of files) {
    const fullPath = path.join(directory, file);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory() && !file.startsWith('.') && file !== 'node_modules') {
      scanForImports(fullPath, results);
    } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
      try {
        const content = fs.readFileSync(fullPath, 'utf8');
        
        // Extract imports
        const importMatches = content.match(/import\s+.*?\s+from\s+['"]([^'"]+)['"]/g);
        if (importMatches) {
          importMatches.forEach(match => {
            const packageMatch = match.match(/from\s+['"]([^'"]+)['"]/);
            if (packageMatch && !packageMatch[1].startsWith('.') && !packageMatch[1].startsWith('/')) {
              results.add(packageMatch[1]);
            }
          });
        }
      } catch (error) {
        // Skip files that can't be read
      }
    }
  }
  
  return results;
}

// Get all imports from source files
console.log('📦 Scanning for package dependencies...\n');
const allImports = scanForImports('src');

// Read package.json to see what's installed
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const installedPackages = new Set([
  ...Object.keys(packageJson.dependencies || {}),
  ...Object.keys(packageJson.devDependencies || {})
]);

// Find missing packages
const missingPackages = [];
const uiComponents = [];

allImports.forEach(pkg => {
  if (!installedPackages.has(pkg)) {
    missingPackages.push(pkg);
  }
  if (pkg.startsWith('@radix-ui/') || pkg === 'cmdk' || pkg.includes('ui')) {
    uiComponents.push(pkg);
  }
});

console.log('❌ Missing Packages:');
if (missingPackages.length === 0) {
  console.log('  ✅ All packages appear to be installed\n');
} else {
  missingPackages.forEach(pkg => console.log(`  - ${pkg}`));
  console.log(`\n📥 Install command:\n  npm install ${missingPackages.join(' ')}\n`);
}

console.log('🎨 UI Components in use:');
uiComponents.forEach(pkg => {
  console.log(`  - ${pkg} ${installedPackages.has(pkg) ? '✅' : '❌'}`);
});

// Check test files structure
console.log('\n🧪 Test Structure Analysis:');

const testDirs = ['tests/', 'src/**/__tests__/', 'src/**/*.test.*', 'src/**/*.spec.*'];
const testFiles = [];

function findTestFiles(dir) {
  if (!fs.existsSync(dir)) return;
  
  try {
    const files = fs.readdirSync(dir);
    files.forEach(file => {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        findTestFiles(fullPath);
      } else if (file.includes('.test.') || file.includes('.spec.')) {
        testFiles.push(fullPath);
      }
    });
  } catch (error) {
    // Skip directories that can't be read
  }
}

findTestFiles('src');
findTestFiles('tests');

console.log(`  Found ${testFiles.length} test files:`);
testFiles.forEach(file => console.log(`    - ${file}`));

// Analyze components that need testing
console.log('\n🔍 Components Analysis:');

const components = [];
function findComponents(dir) {
  if (!fs.existsSync(dir)) return;
  
  const files = fs.readdirSync(dir);
  files.forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      findComponents(fullPath);
    } else if (file.endsWith('.tsx') && !file.includes('.test.') && !file.includes('.spec.')) {
      try {
        const content = fs.readFileSync(fullPath, 'utf8');
        if (content.includes('export default') || content.includes('export function') || content.includes('export const')) {
          const hasTest = fs.existsSync(fullPath.replace('.tsx', '.test.tsx')) || 
                         fs.existsSync(fullPath.replace('.tsx', '.spec.tsx'));
          components.push({
            file: fullPath,
            hasTest,
            isPage: fullPath.includes('/app/') || fullPath.includes('/pages/'),
            isComponent: fullPath.includes('/components/')
          });
        }
      } catch (error) {
        // Skip files that can't be read
      }
    }
  });
}

findComponents('src');

const componentStats = {
  total: components.length,
  withTests: components.filter(c => c.hasTest).length,
  pages: components.filter(c => c.isPage).length,
  components: components.filter(c => c.isComponent).length
};

console.log(`  Total Components: ${componentStats.total}`);
console.log(`  With Tests: ${componentStats.withTests} (${Math.round(componentStats.withTests/componentStats.total*100)}%)`);
console.log(`  Pages: ${componentStats.pages}`);
console.log(`  Components: ${componentStats.components}`);

console.log('\n📋 Components without tests:');
components
  .filter(c => !c.hasTest)
  .slice(0, 10) // Show first 10
  .forEach(c => console.log(`    - ${c.file}`));

if (components.filter(c => !c.hasTest).length > 10) {
  console.log(`    ... and ${components.filter(c => !c.hasTest).length - 10} more`);
}

// Check for specific UAE/business logic
console.log('\n🇦🇪 UAE-Specific Features Detected:');

const businessLogicFiles = [];
components.forEach(c => {
  try {
    const content = fs.readFileSync(c.file, 'utf8');
    if (content.includes('TRN') || content.includes('AED') || content.includes('UAE') || 
        content.includes('Dubai') || content.includes('Gulf') || content.includes('Arabic')) {
      businessLogicFiles.push(c.file);
    }
  } catch (error) {
    // Skip
  }
});

businessLogicFiles.forEach(file => console.log(`  - ${file}`));

// Generate action plan
console.log('\n🎯 Testing Action Plan:\n');

console.log('1. 🔧 Fix Dependencies:');
if (missingPackages.length > 0) {
  console.log(`   npm install ${missingPackages.join(' ')}`);
} else {
  console.log('   ✅ All dependencies installed');
}

console.log('\n2. 🧪 Priority Testing Areas:');
console.log('   - Authentication flow (login/signup)');
console.log('   - Dashboard navigation');
console.log('   - Invoice management (UAE TRN, AED currency)');
console.log('   - Email templates (Arabic/English)');
console.log('   - Follow-up sequences (UAE business hours)');

console.log('\n3. 📝 Test Commands to Run:');
console.log('   npm run test              # Unit tests');
console.log('   npm run test:e2e          # End-to-end tests');
console.log('   npm run test:coverage     # Coverage report');

console.log('\n4. 🚀 Quick Test Validation:');
console.log('   npm run build             # Check for build errors');
console.log('   npm run dev               # Check dev server starts');
console.log('   curl http://localhost:3000 # Basic connectivity');

console.log('\n✅ Diagnostics Complete!\n');