#!/usr/bin/env node
/**
 * Voice Rescue smoke test
 * Work Package B - Voice Rescue
 * 
 * Creates a synthetic TR emergency audio and sends to the API
 * Requires: MODEL_API_KEY env var (not included)
 * 
 * Usage: MODEL_API_KEY=xxx node scripts/ai-smoke/voice.mjs
 */

import { spawn } from 'node:child_process';
import { writeFile, unlink, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const API_BASE = process.env.API_BASE_URL ?? 'http://localhost:3001';
const MODEL_API_KEY = process.env.MODEL_API_KEY;

if (!MODEL_API_KEY) {
  console.error('ERROR: MODEL_API_KEY environment variable not set');
  process.exit(1);
}

async function generateSyntheticAudio() {
  const text = 'Yardım edin. Enkaz altında üç kişi mahsur kaldık. Yaralılar var. Acil yardım lazım.';
  const outputPath = join(tmpdir(), 'sosmesh-smoke-voice.wav');

  console.log('Generating synthetic Turkish emergency audio...');

  return new Promise((resolve, reject) => {
    const espeak = spawn('espeak-ng', [
      '-v', 'tr',
      '-s', '140',
      '-w', outputPath,
      text,
    ], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stderr = '';

    espeak.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    espeak.on('error', (error) => {
      if (error.message.includes('ENOENT')) {
        console.warn('WARNING: espeak-ng not found, creating fallback sine wave');
        createFallbackWav(outputPath).then(resolve).catch(reject);
      } else {
        reject(error);
      }
    });

    espeak.on('exit', (code) => {
      if (code === 0) {
        resolve(outputPath);
      } else {
        console.warn('WARNING: espeak-ng failed, creating fallback sine wave');
        createFallbackWav(outputPath).then(resolve).catch(reject);
      }
    });
  });
}

async function createFallbackWav(outputPath) {
  console.log('Creating fallback synthetic audio (sine wave)...');
  
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn('ffmpeg', [
      '-f', 'lavfi',
      '-i', 'sine=frequency=440:duration=3',
      '-ac', '1',
      '-ar', '16000',
      '-c:a', 'pcm_s16le',
      '-y',
      outputPath,
    ], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    ffmpeg.on('error', (error) => {
      reject(new Error(`ffmpeg not available: ${error.message}`));
    });

    ffmpeg.on('exit', (code) => {
      if (code === 0) {
        resolve(outputPath);
      } else {
        reject(new Error(`ffmpeg exited with code ${code}`));
      }
    });
  });
}

async function createTestIncident() {
  console.log('Creating test incident...');

  const response = await fetch(`${API_BASE}/v1/operator/demo/sos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      displayText: 'SYNTHETIC VOICE TEST: Enkaz altında 3 kişi mahsur',
      sosType: 'TRAPPED',
      priority: 4,
      personCount: 3,
      synthetic: true,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Demo SOS failed: ${response.status} ${text}`);
  }

  const data = await response.json();
  return data.incidentId;
}

async function uploadAudio(incidentId, audioPath) {
  console.log(`Uploading audio to case ${incidentId}...`);

  const audioBuffer = await readFile(audioPath);
  const base64Audio = audioBuffer.toString('base64');

  const response = await fetch(`${API_BASE}/v1/operator/cases/${incidentId}/attachments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer test-operator-token',
    },
    body: JSON.stringify({
      audioBase64: base64Audio,
      mimeType: 'audio/wav',
      synthetic: true,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Audio upload failed: ${response.status} ${text}`);
  }

  const data = await response.json();
  return data;
}

async function waitForTranscription(incidentId, maxWaitMs = 60000) {
  console.log('Waiting for transcription job...');

  const start = Date.now();
  let lastStatus = 'unknown';

  while (Date.now() - start < maxWaitMs) {
    const response = await fetch(`${API_BASE}/v1/operator/cases/${incidentId}/detail`, {
      headers: {
        'Authorization': 'Bearer test-operator-token',
      },
    });

    if (response.ok) {
      const data = await response.json();
      
      if (data.transcripts && data.transcripts.length > 0) {
        return data.transcripts[0];
      }

      if (data.ai?.status) {
        if (lastStatus !== data.ai.status) {
          console.log(`  AI status: ${data.ai.status}`);
          lastStatus = data.ai.status;
        }
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  return null;
}

async function main() {
  console.log('=== SOSMesh Voice Rescue Smoke Test ===\n');
  console.log(`API: ${API_BASE}`);
  console.log('Model API Key: [REDACTED]\n');

  let audioPath = null;

  try {
    audioPath = await generateSyntheticAudio();
    console.log(`✓ Generated synthetic audio: ${audioPath}\n`);

    const incidentId = await createTestIncident();
    console.log(`✓ Created test incident: ${incidentId}\n`);

    const uploadResult = await uploadAudio(incidentId, audioPath);
    console.log(`✓ Audio uploaded`);
    console.log(`  Attachment ID: ${uploadResult.attachmentId}`);
    console.log(`  Job ID: ${uploadResult.jobId}`);
    console.log(`  Duration: ${uploadResult.durationMs}ms`);
    console.log(`  Size: ${uploadResult.sizeBytes} bytes\n`);

    const transcript = await waitForTranscription(incidentId);

    if (transcript) {
      console.log('✓ Transcription completed');
      console.log(`  Model: ${transcript.model}`);
      console.log(`  Language: ${transcript.language}`);
      console.log(`  Transcript: "${transcript.transcript}"`);
      console.log(`  Audio duration: ${transcript.audioDurationMs}ms\n`);
      console.log('✅ SMOKE TEST PASSED');
    } else {
      console.log('⚠️  Transcription not completed within timeout');
      console.log('This may indicate a budget limit or API issue');
      console.log('Check worker logs and AI job status');
      process.exit(1);
    }
  } catch (error) {
    console.error('\n❌ SMOKE TEST FAILED');
    console.error(error);
    process.exit(1);
  } finally {
    if (audioPath) {
      await unlink(audioPath).catch(() => {});
    }
  }
}

main();
