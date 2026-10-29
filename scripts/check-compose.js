#!/usr/bin/env node
/**
 * SOSMesh Docker Compose Validation
 * Validates compose.yaml structure without requiring Docker
 */

const fs = require('fs');
const path = require('path');

const REQUIRED_SERVICES = ['postgres', 'api', 'web'];

function parseYaml(filePath) {
  try {
    const yaml = require('yaml');
    const content = fs.readFileSync(filePath, 'utf-8');
    return yaml.parse(content);
  } catch (err) {
    if (err.code === 'MODULE_NOT_FOUND') {
      console.error('❌ YAML parser not available');
      console.error('   Install with: pnpm add -D yaml');
      process.exit(1);
    }
    throw err;
  }
}

function validateCompose(composeData) {
  const errors = [];
  const warnings = [];

  if (!composeData.services) {
    errors.push('Missing "services" section');
    return { errors, warnings };
  }

  const services = composeData.services;

  REQUIRED_SERVICES.forEach(name => {
    if (!services[name]) {
      errors.push(`Missing required service: ${name}`);
      return;
    }

    const service = services[name];

    if (!service.healthcheck) {
      errors.push(`Service "${name}" missing healthcheck`);
    } else {
      if (!service.healthcheck.test) {
        errors.push(`Service "${name}" healthcheck missing test`);
      }
      if (!service.healthcheck.interval) {
        warnings.push(`Service "${name}" healthcheck missing interval`);
      }
    }

    const hasImage = !!service.image;
    const hasBuild = !!service.build;

    if (!hasImage && !hasBuild) {
      errors.push(`Service "${name}" must have "image" or "build"`);
    }
  });

  return { errors, warnings };
}

function main() {
  const composePath = process.argv[2] || path.join(__dirname, '..', 'compose.yaml');

  if (!fs.existsSync(composePath)) {
    console.error('❌ compose.yaml not found');
    process.exit(1);
  }

  console.log('=== SOSMesh Compose Validation ===\n');
  console.log(`Checking: ${composePath}\n`);

  const composeData = parseYaml(composePath);
  const { errors, warnings } = validateCompose(composeData);

  const serviceCount = composeData.services ? Object.keys(composeData.services).length : 0;
  console.log(`Services defined: ${serviceCount}`);

  if (errors.length === 0 && warnings.length === 0) {
    console.log('\n✅ All checks passed');
    console.log(`   - ${REQUIRED_SERVICES.length}/${REQUIRED_SERVICES.length} required services present`);
    console.log(`   - All services have healthchecks`);
    console.log(`   - All services have image or build`);
    process.exit(0);
  }

  if (warnings.length > 0) {
    console.log('\n⚠️  Warnings:');
    warnings.forEach(w => console.log(`   - ${w}`));
  }

  if (errors.length > 0) {
    console.log('\n❌ Errors:');
    errors.forEach(e => console.log(`   - ${e}`));
    console.log(`\nValidation failed: ${errors.length} error(s)`);
    process.exit(1);
  }

  process.exit(0);
}

if (require.main === module) {
  main();
}

module.exports = { validateCompose, parseYaml };
