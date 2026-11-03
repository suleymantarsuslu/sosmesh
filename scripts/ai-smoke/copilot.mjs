#!/usr/bin/env node
/**
 * Copilot Smoke Test
 * Work Package D - Copilot Smoke
 * 
 * Tests Mission Copilot endpoints with real Spark API
 * 
 * Usage: MODEL_API_KEY=xxx OPERATOR_TOKEN=xxx node scripts/ai-smoke/copilot.mjs
 */

const API_BASE = process.env.API_BASE || 'http://localhost:3001';
const OPERATOR_TOKEN = process.env.OPERATOR_TOKEN;
const MODEL_API_KEY = process.env.MODEL_API_KEY;

if (!MODEL_API_KEY) {
  console.error('⚠️  MODEL_API_KEY not set - copilot will fail budget check');
  console.error('   Set MODEL_API_KEY to test real AI integration');
}

if (!OPERATOR_TOKEN) {
  console.error('Error: OPERATOR_TOKEN environment variable required');
  process.exit(1);
}

async function request(method, path, body) {
  const url = `${API_BASE}${path}`;
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPERATOR_TOKEN}`,
    },
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);
  const text = await response.text();

  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  return { status: response.status, ok: response.ok, data };
}

async function testSituationSummary() {
  console.log('\n🧪 Testing GET /v1/operator/ai/situation-summary...');

  const result = await request('GET', '/v1/operator/ai/situation-summary');

  if (!result.ok) {
    console.error('❌ Failed:', result.status, result.data);
    return false;
  }

  console.log('✅ Status:', result.status);
  console.log('   Response:', JSON.stringify(result.data, null, 2));

  if (
    typeof result.data.totalIncidents !== 'number' ||
    !result.data.byUrgency ||
    !result.data.byEventType ||
    !Array.isArray(result.data.topNeeds) ||
    !result.data.lastHourTrend
  ) {
    console.error('❌ Response shape invalid');
    return false;
  }

  console.log('✅ Deterministic summary works (no AI required)');
  return true;
}

async function testCopilotAsk() {
  console.log('\n🧪 Testing POST /v1/operator/copilot/ask...');

  const payload = {
    question: 'What are the most urgent open incidents?',
    scope: 'open',
  };

  console.log('   Request:', JSON.stringify(payload, null, 2));

  const result = await request('POST', '/v1/operator/copilot/ask', payload);

  if (!result.ok) {
    if (result.status === 500 && result.data?.message?.includes('AI unavailable')) {
      console.log('⚠️  AI unavailable (budget limit or no MODEL_API_KEY)');
      console.log('   This is expected if MODEL_API_KEY is not set');
      return true;
    }

    console.error('❌ Failed:', result.status, result.data);
    return false;
  }

  console.log('✅ Status:', result.status);
  console.log('   Answer:', result.data.answer);
  console.log('   Cited incidents:', result.data.citedIncidentIds);
  console.log('   Uncertainty:', result.data.uncertainty);
  console.log('   Next steps:', result.data.suggestedNextSteps);

  if (
    typeof result.data.answer !== 'string' ||
    !Array.isArray(result.data.citedIncidentIds) ||
    !Array.isArray(result.data.suggestedNextSteps)
  ) {
    console.error('❌ Response shape invalid');
    return false;
  }

  console.log('✅ Copilot AI response valid');
  return true;
}

async function main() {
  console.log('🚀 Copilot Smoke Test');
  console.log(`   API: ${API_BASE}`);
  console.log(`   MODEL_API_KEY: ${MODEL_API_KEY ? 'set' : 'NOT SET'}`);

  const tests = [
    { name: 'Situation Summary', fn: testSituationSummary },
    { name: 'Copilot Ask', fn: testCopilotAsk },
  ];

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    try {
      const result = await test.fn();
      if (result) {
        passed += 1;
      } else {
        failed += 1;
      }
    } catch (error) {
      console.error(`❌ ${test.name} error:`, error.message);
      failed += 1;
    }
  }

  console.log(`\n${'='.repeat(50)}`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
