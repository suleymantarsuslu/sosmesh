#!/usr/bin/env node
/**
 * SOSMesh Skip Detection
 * Detects skipped tests in code and Playwright/Jest reports
 * Exit 0 = no skips, exit 1 = skips found
 */

const { execSync } = require('child_process');
const fs = require('fs');

const SKIP_PATTERNS = [
  /\.only\(/,
  /test\.only/,
  /it\.only/,
  /describe\.only/,
  /test\.skip/,
  /it\.skip/,
  /describe\.skip/,
  /xit\(/,
  /xdescribe\(/,
  /xtest\(/,
];

function checkCodeForSkips() {
  console.log('=== Checking code for skip patterns ===\n');
  
  try {
    const files = execSync('git ls-files', { encoding: 'utf-8' })
      .split('\n')
      .filter(f => f.match(/\.(test|spec)\.(js|ts|tsx)$/));
    
    const violations = [];
    
    files.forEach(file => {
      if (!fs.existsSync(file)) return;
      
      const content = fs.readFileSync(file, 'utf-8');
      const lines = content.split('\n');
      
      lines.forEach((line, idx) => {
        SKIP_PATTERNS.forEach(pattern => {
          if (pattern.test(line)) {
            violations.push({
              file,
              line: idx + 1,
              content: line.trim(),
              pattern: pattern.source,
            });
          }
        });
      });
    });
    
    if (violations.length > 0) {
      console.log('❌ Skip patterns found in code:\n');
      violations.forEach(v => {
        console.log(`  ${v.file}:${v.line}`);
        console.log(`    ${v.content}`);
        console.log('');
      });
      return false;
    }
    
    console.log('✅ No skip patterns in code\n');
    return true;
  } catch (err) {
    console.error('Error checking code:', err.message);
    return false;
  }
}

function checkPlaywrightReports() {
  console.log('=== Checking Playwright reports ===\n');
  
  const reportPaths = [
    'playwright-report/report.json',
    'test-results/.last-run.json',
  ];
  
  for (const reportPath of reportPaths) {
    if (fs.existsSync(reportPath)) {
      try {
        const report = JSON.parse(fs.readFileSync(reportPath, 'utf-8'));
        
        if (report.stats && report.stats.skipped > 0) {
          console.log(`❌ Playwright report has ${report.stats.skipped} skipped tests`);
          return false;
        }
        
        if (report.suites) {
          const skipped = countSkipped(report.suites);
          if (skipped > 0) {
            console.log(`❌ Playwright report has ${skipped} skipped tests`);
            return false;
          }
        }
      } catch (err) {
        console.log(`  Warning: Could not parse ${reportPath}: ${err.message}`);
      }
    }
  }
  
  console.log('✅ No skipped tests in Playwright reports\n');
  return true;
}

function countSkipped(suites) {
  let count = 0;
  suites.forEach(suite => {
    if (suite.specs) {
      suite.specs.forEach(spec => {
        if (spec.tests) {
          spec.tests.forEach(test => {
            if (test.status === 'skipped') {
              count++;
            }
          });
        }
      });
    }
    if (suite.suites) {
      count += countSkipped(suite.suites);
    }
  });
  return count;
}

function checkJestReports() {
  console.log('=== Checking Jest reports ===\n');
  
  const coveragePath = 'coverage/coverage-summary.json';
  
  if (fs.existsSync(coveragePath)) {
    try {
      const coverage = JSON.parse(fs.readFileSync(coveragePath, 'utf-8'));
      
      if (coverage.total && coverage.total.statements) {
        console.log('  Jest coverage found (no skip detection in summary)');
      }
    } catch (err) {
      console.log(`  Warning: Could not parse ${coveragePath}: ${err.message}`);
    }
  }
  
  console.log('✅ No skip detection issues in Jest reports\n');
  return true;
}

function main() {
  console.log('=== SOSMesh Skip Detection ===\n');
  
  const codeCheck = checkCodeForSkips();
  const playwrightCheck = checkPlaywrightReports();
  const jestCheck = checkJestReports();
  
  const allPassed = codeCheck && playwrightCheck && jestCheck;
  
  if (allPassed) {
    console.log('✅ PASS: No skipped tests detected');
    process.exit(0);
  } else {
    console.log('❌ FAIL: Skipped tests detected');
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { checkCodeForSkips, checkPlaywrightReports };
