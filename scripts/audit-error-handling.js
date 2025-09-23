#!/usr/bin/env node

/**
 * Audit all API routes for proper error handling implementation
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function findApiRoutes(dir = 'src/app/api', routes = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      findApiRoutes(fullPath, routes);
    } else if (entry.name === 'route.ts') {
      routes.push(fullPath);
    }
  }

  return routes;
}

function analyzeRoute(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');

  const analysis = {
    path: filePath,
    hasHandleApiError: content.includes('handleApiError'),
    hasLogError: content.includes('logError'),
    hasSuccessResponse: content.includes('successResponse'),
    hasErrorImports: content.includes("from '@/lib/errors'"),
    hasValidationError: content.includes('ValidationError'),
    hasTryCatch: content.includes('try {') && content.includes('} catch'),
    hasConsoleError: content.includes('console.error'),
    hasNextResponseError: content.includes('NextResponse.json') && content.includes('error'),
    lineCount: content.split('\n').length
  };

  // Scoring system (0-10)
  let score = 0;
  if (analysis.hasHandleApiError) score += 3;
  if (analysis.hasLogError) score += 2;
  if (analysis.hasSuccessResponse) score += 1;
  if (analysis.hasErrorImports) score += 1;
  if (analysis.hasValidationError) score += 1;
  if (analysis.hasTryCatch) score += 2;

  analysis.score = score;
  analysis.grade = score >= 8 ? '✅ Excellent' :
                   score >= 6 ? '🟡 Good' :
                   score >= 4 ? '⚠️ Needs Improvement' :
                               '❌ Poor';

  return analysis;
}

function main() {
  console.log('🔍 Auditing API Route Error Handling\n');

  const routes = findApiRoutes();
  console.log(`Found ${routes.length} API routes\n`);

  const results = routes.map(analyzeRoute);

  // Sort by score (lowest first - needs most attention)
  results.sort((a, b) => a.score - b.score);

  console.log('📊 ERROR HANDLING AUDIT RESULTS\n');
  console.log('Legend: ✅ Excellent (8-10) | 🟡 Good (6-7) | ⚠️ Needs Improvement (4-5) | ❌ Poor (0-3)\n');

  // Poor/Needs Improvement routes (priority fixes)
  const needsAttention = results.filter(r => r.score < 6);
  if (needsAttention.length > 0) {
    console.log('🚨 PRIORITY FIXES NEEDED:\n');
    needsAttention.forEach(result => {
      console.log(`${result.grade} (${result.score}/10) ${result.path}`);
      if (!result.hasHandleApiError) console.log('  - Missing handleApiError');
      if (!result.hasLogError) console.log('  - Missing logError');
      if (!result.hasErrorImports) console.log('  - Missing error utilities import');
      if (!result.hasTryCatch) console.log('  - Missing try/catch blocks');
      console.log('');
    });
  }

  // Good routes
  const goodRoutes = results.filter(r => r.score >= 6 && r.score < 8);
  if (goodRoutes.length > 0) {
    console.log(`🟡 GOOD ROUTES (${goodRoutes.length}):\n`);
    goodRoutes.forEach(result => {
      console.log(`${result.grade} (${result.score}/10) ${result.path}`);
    });
    console.log('');
  }

  // Excellent routes
  const excellentRoutes = results.filter(r => r.score >= 8);
  if (excellentRoutes.length > 0) {
    console.log(`✅ EXCELLENT ROUTES (${excellentRoutes.length}):\n`);
    excellentRoutes.forEach(result => {
      console.log(`${result.grade} (${result.score}/10) ${result.path}`);
    });
    console.log('');
  }

  // Summary statistics
  const avgScore = (results.reduce((sum, r) => sum + r.score, 0) / results.length).toFixed(1);
  const excellentCount = excellentRoutes.length;
  const goodCount = goodRoutes.length;
  const needsImprovementCount = results.filter(r => r.score >= 4 && r.score < 6).length;
  const poorCount = results.filter(r => r.score < 4).length;

  console.log('📈 SUMMARY STATISTICS:\n');
  console.log(`Average Score: ${avgScore}/10`);
  console.log(`✅ Excellent: ${excellentCount} (${(excellentCount/results.length*100).toFixed(1)}%)`);
  console.log(`🟡 Good: ${goodCount} (${(goodCount/results.length*100).toFixed(1)}%)`);
  console.log(`⚠️ Needs Improvement: ${needsImprovementCount} (${(needsImprovementCount/results.length*100).toFixed(1)}%)`);
  console.log(`❌ Poor: ${poorCount} (${(poorCount/results.length*100).toFixed(1)}%)`);
  console.log('');

  if (needsAttention.length > 0) {
    console.log('🎯 RECOMMENDED ACTIONS:\n');
    console.log('1. Add error handling imports to routes missing them');
    console.log('2. Replace console.error with logError for better logging');
    console.log('3. Replace NextResponse.json error responses with handleApiError');
    console.log('4. Add ValidationError for input validation failures');
    console.log('5. Use successResponse for consistent success responses');
    console.log('');

    console.log('🛠️ QUICK FIX COMMANDS:\n');
    console.log('1. Add imports to routes:');
    console.log("   import { handleApiError, successResponse, logError, ValidationError } from '@/lib/errors'");
    console.log('');
    console.log('2. Replace error handling pattern:');
    console.log('   } catch (error) {');
    console.log('     logError("ROUTE_NAME", error, { contextData });');
    console.log('     return handleApiError(error);');
    console.log('   }');
  }

  console.log(`✨ Audit complete! Checked ${routes.length} API routes.`);
}

if (require.main === module) {
  main();
}

module.exports = { findApiRoutes, analyzeRoute };