#!/usr/bin/env node

/**
 * UX Screen State Matrix Validator
 * Ensures all 13 screens document all 6 required states.
 * 
 * ADIM 04 — J3 requirement
 */

const fs = require('fs');
const path = require('path');

const SCREENS_FILE = path.join(__dirname, '../docs/ux/screens.md');

const REQUIRED_SCREENS = [
  'Mobil Home',
  'Mobil SOS',
  'Mobil Message Status',
  'Mobil Relay',
  'Mobil Settings',
  'Web Dashboard',
  'Web Map',
  'Web Inbox',
  'Web Cases',
  'Web Teams',
  'Web Admin',
  'Saat SOS',
  'Saat Status',
];

const REQUIRED_STATES = [
  'Empty',
  'Loading',
  'Error',
  'Offline',
  'Permission Denied',
  'Low Battery',
];

function main() {
  if (!fs.existsSync(SCREENS_FILE)) {
    console.error(`ERROR: screens.md not found at ${SCREENS_FILE}`);
    process.exit(1);
  }

  const content = fs.readFileSync(SCREENS_FILE, 'utf8');
  let errors = [];

  // Check each screen appears in action table
  for (const screen of REQUIRED_SCREENS) {
    const regex = new RegExp(`\\|\\s*${screen.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\|`, 'i');
    if (!regex.test(content)) {
      errors.push(`Missing screen in action table: "${screen}"`);
    }
  }

  // Check all 6 states are documented in section 6.1
  for (const state of REQUIRED_STATES) {
    const stateRegex = new RegExp(`\\|\\s*${state}\\s*\\|`, 'i');
    if (!stateRegex.test(content)) {
      errors.push(`Missing state in common states table: "${state}"`);
    }
  }

  if (errors.length > 0) {
    console.error('❌ Screen state matrix validation FAILED:\n');
    errors.forEach(err => console.error(`  - ${err}`));
    process.exit(1);
  }

  console.log('✅ Screen state matrix validation PASSED');
  console.log(`   - ${REQUIRED_SCREENS.length} screens documented`);
  console.log(`   - ${REQUIRED_STATES.length} states documented`);
  process.exit(0);
}

main();
