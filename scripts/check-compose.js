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

  REQUIRED_SERVICES.forEach((name) => {
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
  const composePath = process.argv[2];
  const composePaths = composePath
    ? [composePath]
    : [
        path.join(__dirname, '..', 'compose.yaml'),
        path.join(__dirname, '..', 'infra', 'deploy', 'compose', 'docker-compose.staging.yml'),
        path.join(__dirname, '..', 'infra', 'deploy', 'compose', 'docker-compose.vulut.yml'),
      ];

  console.log('=== SOSMesh Compose Validation ===\n');

  let allErrors = [];
  let allWarnings = [];
  const requiredFiles = composePath
    ? []
    : [
        path.join(__dirname, '..', 'compose.yaml'),
        path.join(__dirname, '..', 'infra', 'deploy', 'compose', 'docker-compose.staging.yml'),
        path.join(__dirname, '..', 'infra', 'deploy', 'compose', 'docker-compose.vulut.yml'),
      ];

  let validatedCount = 0;

  for (const checkPath of composePaths) {
    if (!fs.existsSync(checkPath)) {
      if (composePath || requiredFiles.includes(checkPath)) {
        console.error(`❌ ${checkPath} not found`);
        process.exit(1);
      }
      continue;
    }
    validatedCount++;

    console.log(`Checking: ${checkPath}`);

    const composeData = parseYaml(checkPath);
    const { errors, warnings } = validateCompose(composeData);

    const serviceCount = composeData.services ? Object.keys(composeData.services).length : 0;
    console.log(`  Services defined: ${serviceCount}`);

    if (errors.length === 0 && warnings.length === 0) {
      console.log('  ✅ All checks passed\n');
    } else {
      if (warnings.length > 0) {
        console.log('  ⚠️  Warnings:');
        warnings.forEach((w) => console.log(`     - ${w}`));
      }
      if (errors.length > 0) {
        console.log('  ❌ Errors:');
        errors.forEach((e) => console.log(`     - ${e}`));
      }
      console.log('');
    }

    allErrors = allErrors.concat(errors.map((e) => `${checkPath}: ${e}`));
    allWarnings = allWarnings.concat(warnings.map((w) => `${checkPath}: ${w}`));
  }

  if (allErrors.length === 0 && allWarnings.length === 0) {
    console.log(`\n✅ All ${validatedCount} compose files validated successfully`);
    process.exit(0);
  }

  if (allErrors.length > 0) {
    console.log(`\n❌ Validation failed: ${allErrors.length} error(s) across all files`);
    process.exit(1);
  }

  process.exit(0);
}

if (require.main === module) {
  main();
}

module.exports = { validateCompose, parseYaml };
