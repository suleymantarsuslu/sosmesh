#!/usr/bin/env node
/**
 * Voice Rescue smoke test - Direct Meta API check
 * Work Package B - Voice Rescue
 * 
 * Direct test: convertToWav + Meta transcribe (no API/DB needed)
 * Requires: MODEL_API_KEY env var
 * 
 * Usage: MODEL_API_KEY=xxx node scripts/ai-smoke/voice.mjs
 */

import { spawn } from 'node:child_process';
import { writeFile, unlink, readFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

const MODEL_API_KEY = process.env.MODEL_API_KEY;
const META_BASE_URL = process.env.META_BASE_URL ?? 'https://api.meta.ai/v1';

if (!MODEL_API_KEY) {
  console.error('ERROR: MODEL_API_KEY environment variable not set');
  process.exit(1);
}

async function generateTurkishEmergencyAudio() {
  const text = 'Yardım edin. Enkaz altında üç kişi mahsur kaldık. Yaralılar var. Acil yardım lazım.';
  const outputPath = join(tmpdir(), `sosmesh-smoke-${randomUUID()}.wav`);

  console.log('Generating Turkish emergency audio with espeak-ng...');

  return new Promise((resolve, reject) => {
    const espeak = spawn('espeak-ng', [
      '-v', 'tr',
      '-s', '140',
      '-w', outputPath,
      text,
    ], {
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 10000,
    });

    espeak.on('error', (error) => {
      reject(new Error(`espeak-ng not available: ${error.message}`));
    });

    espeak.on('exit', (code) => {
      if (code === 0) {
        resolve(outputPath);
      } else {
        reject(new Error(`espeak-ng failed with code ${code}`));
      }
    });
  });
}

async function convertToWav16kHz(inputPath) {
  const outputPath = join(tmpdir(), `sosmesh-converted-${randomUUID()}.wav`);

  console.log('Converting to WAV 16kHz mono 16-bit...');

  return new Promise((resolve, reject) => {
    const ffmpeg = spawn('ffmpeg', [
      '-i', inputPath,
      '-ac', '1',
      '-ar', '16000',
      '-c:a', 'pcm_s16le',
      '-map_metadata', '-1',
      '-f', 'wav',
      '-y',
      outputPath,
    ], {
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 30000,
    });

    ffmpeg.on('error', (error) => {
      reject(new Error(`ffmpeg not available: ${error.message}`));
    });

    ffmpeg.on('exit', (code) => {
      if (code === 0) {
        resolve(outputPath);
      } else {
        reject(new Error(`ffmpeg failed with code ${code}`));
      }
    });
  });
}

async function transcribeWithMeta(wavPath) {
  console.log('Calling Meta Voice Transcribe API...');

  const wavBuffer = await readFile(wavPath);

  const requestJson = {
    model: 'muse-voice-transcribe-1.0',
    audioEncoding: 'WAV',
    mode: 'PUSH_TO_TALK',
    languageBias: ['Turkish', 'English'],
    keywords: ['enkaz', 'yaralı', 'yangın', 'sel', 'yardım', 'mahsur', 'acil'],
  };

  const formData = new FormData();
  const requestBlob = new Blob([JSON.stringify(requestJson)], { type: 'application/json' });
  const audioBlob = new Blob([wavBuffer], { type: 'audio/wav' });
  
  formData.append('request', requestBlob, 'request.json');
  formData.append('audio', audioBlob, 'audio.wav');

  const response = await fetch(`${META_BASE_URL}/asr/transcribe`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${MODEL_API_KEY}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Meta API failed: ${response.status} ${text}`);
  }

  return response.json();
}

async function main() {
  console.log('=== SOSMesh Voice Rescue Direct Model Check ===\n');
  console.log(`Meta API: ${META_BASE_URL}`);
  console.log('Model: muse-voice-transcribe-1.0');
  console.log('Key: [REDACTED]\n');

  let originalPath = null;
  let convertedPath = null;

  try {
    // Generate Turkish emergency audio with espeak-ng
    originalPath = await generateTurkishEmergencyAudio();
    console.log(`✓ Generated Turkish audio: ${originalPath}\n`);

    // Convert to WAV 16kHz mono 16-bit
    convertedPath = await convertToWav16kHz(originalPath);
    console.log(`✓ Converted to WAV 16kHz mono 16-bit: ${convertedPath}\n`);

    // Call Meta transcribe
    const result = await transcribeWithMeta(convertedPath);

    console.log('✅ TRANSCRIPTION SUCCESSFUL');
    console.log(`\nModel: ${result.model ?? 'muse-voice-transcribe-1.0'}`);
    console.log(`Session ID: ${result.sessionId ?? 'unknown'}`);
    console.log(`Audio Duration: ${result.audioDurationMs ?? 0}ms`);
    console.log(`Transcript: "${result.transcript ?? ''}"`);
    
    if (result.turns && result.turns.length > 0) {
      console.log(`Turns: ${result.turns.length}`);
    }

    // Verify expected Turkish keywords
    const transcript = (result.transcript ?? '').toLowerCase();
    const expectedWords = ['enkaz', 'mahsur', 'yardım', 'yaralı'];
    const foundWords = expectedWords.filter(word => transcript.includes(word));

    console.log(`\nExpected keywords found: ${foundWords.length}/${expectedWords.length}`);
    if (foundWords.length > 0) {
      console.log(`  Found: ${foundWords.join(', ')}`);
    }

    if (foundWords.length === 0) {
      console.log('\n⚠️  WARNING: No Turkish keywords detected');
      console.log('This may indicate language detection or keyword issues');
      process.exit(1);
    }

    console.log('\n✅ SMOKE TEST PASSED');
  } catch (error) {
    console.error('\n❌ SMOKE TEST FAILED');
    console.error(error.message);
    if (error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }
    process.exit(1);
  } finally {
    // Cleanup
    const cleanup = [];
    if (originalPath) cleanup.push(unlink(originalPath).catch(() => {}));
    if (convertedPath) cleanup.push(unlink(convertedPath).catch(() => {}));
    await Promise.all(cleanup);
  }
}

main();
