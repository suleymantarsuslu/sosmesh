#!/usr/bin/env node
/**
 * SOSMesh Design Tokens Builder
 * tokens.json → CSS custom properties (tokens.css)
 */

const fs = require('fs');
const path = require('path');

const TOKENS_PATH = path.join(__dirname, '../packages/design-tokens/tokens.json');
const OUTPUT_PATH = path.join(__dirname, '../packages/design-tokens/tokens.css');
const SCHEMA_PATH = path.join(__dirname, '../packages/design-tokens/tokens.schema.json');

console.log('=== SOSMesh Design Tokens Builder ===\n');

// JSON Schema validation (optional ajv dependency)
try {
  const Ajv = require('ajv');
  const ajv = new Ajv();
  const schema = JSON.parse(fs.readFileSync(SCHEMA_PATH, 'utf-8'));
  const tokens = JSON.parse(fs.readFileSync(TOKENS_PATH, 'utf-8'));
  
  const validate = ajv.compile(schema);
  const valid = validate(tokens);
  
  if (!valid) {
    console.error('❌ tokens.json schema validation failed:');
    console.error(JSON.stringify(validate.errors, null, 2));
    process.exit(1);
  }
  
  console.log('✅ tokens.json schema valid');
} catch (err) {
  if (err.code === 'MODULE_NOT_FOUND') {
    console.log('⚠️  ajv not installed, skipping schema validation');
  } else {
    throw err;
  }
}

// Load tokens
const tokens = JSON.parse(fs.readFileSync(TOKENS_PATH, 'utf-8'));

// Helper: convert nested object to CSS custom properties
function objectToCSS(obj, prefix = '') {
  let css = '';
  
  for (const [key, value] of Object.entries(obj)) {
    const cssKey = prefix ? `${prefix}-${key}` : key;
    
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      css += objectToCSS(value, cssKey);
    } else {
      css += `  --${cssKey}: ${value};\n`;
    }
  }
  
  return css;
}

// Build CSS
let css = `/**
 * SOSMesh Design Tokens
 * Generated from tokens.json
 * DO NOT EDIT MANUALLY
 */

:root {
  /* Light mode colors */
${objectToCSS(tokens.colors.light, 'color-light')}
  /* Typography */
${objectToCSS(tokens.typography, 'type')}
  /* Spacing */
${objectToCSS(tokens.spacing, 'space')}
  /* Radius */
${objectToCSS(tokens.radius, 'radius')}
  /* Elevation */
${objectToCSS(tokens.elevation, 'elevation')}
  /* Focus ring */
${objectToCSS(tokens.focusRing, 'focus-ring')}
  /* Min touch target */
${objectToCSS(tokens.minTouchTarget, 'touch')}
  /* Breakpoints */
${objectToCSS(tokens.breakpoints, 'breakpoint')}
  /* Animation */
${objectToCSS(tokens.animation, 'animation')}
}

/* Dark mode */
@media (prefers-color-scheme: dark) {
  :root {
${objectToCSS(tokens.colors.dark, 'color-dark')}
  }
}

[data-theme="light"] {
${objectToCSS(tokens.colors.light, 'color')}
}

[data-theme="dark"] {
${objectToCSS(tokens.colors.dark, 'color')}
}

/* Utility: large text mode (200% scale) */
@media (prefers-reduced-motion: no-preference) {
  html {
    font-size: 16px;
  }
}

@media (min-width: 1440px) {
  html {
    font-size: 18px;
  }
}

/* Large text override (user setting) */
html[data-text-size="large"] {
  font-size: 20px;
}

html[data-text-size="xlarge"] {
  font-size: 24px;
}

/* Focus visible */
:focus-visible {
  outline: var(--focus-ring-width) var(--focus-ring-style) var(--color-focus);
  outline-offset: var(--focus-ring-offset);
}

/* Min touch target enforcement */
button,
a,
input[type="checkbox"],
input[type="radio"] {
  min-height: var(--touch-default);
  min-width: var(--touch-default);
}

.sos-button {
  min-width: var(--touch-sosButton-minWidth);
  min-height: var(--touch-sosButton-minHeight);
}
`;

// Write output
fs.writeFileSync(OUTPUT_PATH, css, 'utf-8');

console.log(`✅ Generated: ${OUTPUT_PATH}`);
console.log(`   Size: ${(css.length / 1024).toFixed(2)} KB`);
console.log('');
process.exit(0);
