#!/usr/bin/env node
/**
 * Vision AI Smoke Test
 * Work Package C - Vision
 * 
 * Tests Spark 1.3 + SAM 3.1 on a synthetic disaster scene.
 * Requires: MODEL_API_KEY environment variable
 * 
 * This script uses a public domain disaster photo or creates a synthetic test image.
 * License: Public Domain / CC0
 */

import { createWriteStream } from 'node:fs';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const MODEL_API_KEY = process.env.MODEL_API_KEY;
const META_BASE_URL = process.env.META_BASE_URL ?? 'https://api.meta.ai/v1';

if (!MODEL_API_KEY) {
  console.error('ERROR: MODEL_API_KEY environment variable not set');
  console.error('Usage: MODEL_API_KEY=xxx node scripts/ai-smoke/vision.mjs');
  process.exit(1);
}

const FIXTURES_DIR = join(__dirname, 'fixtures');
const TEST_IMAGE_PATH = join(FIXTURES_DIR, 'disaster-scene-synthetic.jpg');

/**
 * Create a synthetic disaster scene test image
 * License: Generated synthetic content, Public Domain (CC0)
 */
async function createSyntheticDisasterImage() {
  console.log('Creating synthetic disaster scene image...');

  await mkdir(FIXTURES_DIR, { recursive: true });

  // Create a 1280x960 synthetic disaster scene with visible elements
  const width = 1280;
  const height = 960;

  // Background: gray debris field
  const background = Buffer.alloc(width * height * 3);
  for (let i = 0; i < background.length; i += 3) {
    const gray = 80 + Math.random() * 50;
    background[i] = gray;     // R
    background[i + 1] = gray; // G
    background[i + 2] = gray; // B
  }

  // Add red/orange areas (simulating fire/debris)
  for (let y = 400; y < 600; y++) {
    for (let x = 200; x < 500; x++) {
      const idx = (y * width + x) * 3;
      background[idx] = 200 + Math.random() * 55;     // R
      background[idx + 1] = 100 + Math.random() * 50; // G
      background[idx + 2] = 30;                        // B
    }
  }

  // Add dark area (simulating smoke/shadow)
  for (let y = 100; y < 300; y++) {
    for (let x = 800; x < 1100; x++) {
      const idx = (y * width + x) * 3;
      const dark = 20 + Math.random() * 30;
      background[idx] = dark;
      background[idx + 1] = dark;
      background[idx + 2] = dark;
    }
  }

  // Add blue area (simulating water)
  for (let y = 700; y < 900; y++) {
    for (let x = 600; x < 900; x++) {
      const idx = (y * width + x) * 3;
      background[idx] = 50;                          // R
      background[idx + 1] = 100 + Math.random() * 50; // G
      background[idx + 2] = 150 + Math.random() * 50; // B
    }
  }

  const image = await sharp(background, {
    raw: {
      width,
      height,
      channels: 3,
    },
  })
    .jpeg({ quality: 85 })
    .toBuffer();

  await writeFile(TEST_IMAGE_PATH, image);
  console.log(`✓ Synthetic disaster image created: ${TEST_IMAGE_PATH}`);
  console.log('  License: Public Domain (CC0), synthetic test content');
  return image;
}

/**
 * Test Spark 1.3 image analysis
 */
async function testSparkVision(imageBuffer) {
  console.log('\n=== Testing Muse Spark 1.3 Vision Analysis ===\n');

  const dataUrl = `data:image/jpeg;base64,${imageBuffer.toString('base64')}`;

  const schema = {
    name: 'DisasterVisionAnalysis',
    strict: true,
    schema: {
      type: 'object',
      properties: {
        sceneSummary: {
          type: 'string',
          description: 'Brief description of what is visible in the scene',
        },
        visibleHazards: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of visible hazards',
        },
        possiblePeopleIndicators: {
          type: 'string',
          description: 'Uncertain indicators that people may be present',
        },
        accessIssues: {
          type: 'array',
          items: { type: 'string' },
          description: 'Visible obstacles or access difficulties',
        },
        confidence: {
          type: 'string',
          enum: ['low', 'medium', 'high'],
          description: 'Overall confidence in this analysis',
        },
        limitations: {
          type: 'array',
          items: { type: 'string' },
          description: 'Factors limiting this analysis',
        },
      },
      required: [
        'sceneSummary',
        'visibleHazards',
        'possiblePeopleIndicators',
        'accessIssues',
        'confidence',
        'limitations',
      ],
      additionalProperties: false,
    },
  };

  const body = {
    model: 'muse-spark-1.3',
    messages: [
      {
        role: 'system',
        content: 'You are analyzing a disaster scene photo for emergency responders. Never fabricate details.',
      },
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Analyze this disaster scene photo. Describe what is visible, hazards, possible indicators of people, access issues, and your confidence level.' },
          { type: 'image_url', image_url: { url: dataUrl } },
        ],
      },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: schema,
    },
    max_tokens: 2048,
    reasoning_effort: 'minimal',
  };

  const response = await fetch(`${META_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${MODEL_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    console.error(`✗ Spark API call failed: HTTP ${response.status}`);
    const errorText = await response.text();
    console.error(errorText);
    return false;
  }

  const data = await response.json();
  const choice = data.choices?.[0];

  if (choice?.finish_reason === 'length') {
    console.error('✗ Response truncated (increase max_tokens)');
    return false;
  }

  if (!choice?.message?.content) {
    console.error('✗ No content in response');
    return false;
  }

  const result = JSON.parse(choice.message.content);
  const usage = data.usage ?? {};

  console.log('✓ Spark analysis complete\n');
  console.log('Scene Summary:', result.sceneSummary);
  console.log('Visible Hazards:', result.visibleHazards.join(', ') || 'none');
  console.log('People Indicators:', result.possiblePeopleIndicators);
  console.log('Access Issues:', result.accessIssues.join(', ') || 'none');
  console.log('Confidence:', result.confidence);
  console.log('Limitations:', result.limitations.join('; '));
  console.log(`\nUsage: ${usage.prompt_tokens} input + ${usage.completion_tokens} output (${usage.completion_tokens_details?.reasoning_tokens ?? 0} reasoning) = ${usage.total_tokens} total`);

  return true;
}

/**
 * Test SAM 3.1 segmentation
 */
async function testSamSegmentation(imageBuffer) {
  console.log('\n=== Testing SAM 3.1 Segmentation ===\n');

  const dataUrl = `data:image/jpeg;base64,${imageBuffer.toString('base64')}`;
  const concepts = ['person', 'concrete debris', 'fire', 'smoke'];

  let totalSegments = 0;
  let failed = false;

  for (const concept of concepts) {
    const body = {
      model: 'sam-3.1',
      input: [
        {
          type: 'message',
          role: 'user',
          content: [
            { type: 'input_text', text: concept },
            { type: 'input_image', image_url: dataUrl },
          ],
        },
      ],
      stream: false,
      metadata: {
        mask_encoding: 'one_bit',
        include_confidence: 'true',
      },
    };

    const response = await fetch(`${META_BASE_URL}/responses`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${MODEL_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      console.error(`✗ SAM API call failed for "${concept}": HTTP ${response.status}`);
      continue;
    }

    const data = await response.json();
    const outputText = data.output?.[0]?.content?.find(c => c.type === 'output_text')?.text ?? '';

    // Parse SAM output (bare IDs, no ID prefix)
    const segmentRegex = /(?:ID)?(\d+)<\|box;x1=([\d.]+);y1=([\d.]+);x2=([\d.]+);y2=([\d.]+);w=([\d.]+);h=([\d.]+)(?:;c=([\d.]+))?\|>/g;
    let match;
    let conceptSegments = 0;

    while ((match = segmentRegex.exec(outputText)) !== null) {
      conceptSegments++;
      const [, id, x1, y1, x2, y2, w, h, confidence] = match;
      console.log(`  Segment ${id}: box=(${x1},${y1},${x2},${y2}) confidence=${confidence ?? 'N/A'}`);
    }

    if (conceptSegments === 0) {
      if (concept === 'person') {
        console.error(`✗ Expected "person" segments but found 0`);
        failed = true;
      } else {
        console.log(`  No "${concept}" segments detected (ok if not present in image)`);
      }
    } else {
      console.log(`✓ Found ${conceptSegments} "${concept}" segment(s)`);
    }

    totalSegments += conceptSegments;
  }

  if (failed) {
    console.error(`\n✗ SAM segmentation failed: person segments required`);
    return false;
  }

  console.log(`\n✓ SAM segmentation complete: ${totalSegments} total segments across ${concepts.length} concepts`);
  return true;
}

/**
 * Main smoke test
 */
async function main() {
  console.log('Vision AI Smoke Test');
  console.log('====================\n');

  try {
    // Create or load test image
    let imageBuffer;
    try {
      imageBuffer = await readFile(TEST_IMAGE_PATH);
      console.log(`Using existing test image: ${TEST_IMAGE_PATH}`);
    } catch {
      imageBuffer = await createSyntheticDisasterImage();
    }

    // Test Spark
    const sparkOk = await testSparkVision(imageBuffer);
    if (!sparkOk) {
      console.error('\n✗ Spark test failed');
      process.exit(1);
    }

    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Test SAM
    const samOk = await testSamSegmentation(imageBuffer);
    if (!samOk) {
      console.error('\n✗ SAM test failed');
      process.exit(1);
    }

    console.log('\n✓ Vision AI smoke test passed');
  } catch (error) {
    console.error('\n✗ Smoke test error:', error.message);
    process.exit(1);
  }
}

main();
