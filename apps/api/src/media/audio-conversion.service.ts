/**
 * Audio Conversion Service - Convert audio to Meta ASR-compatible WAV format
 * Work Package B - Voice Rescue
 * 
 * Converts various audio formats to WAV mono 16-bit 16kHz using ffmpeg
 * Safety: spawn with argument arrays (no shell), timeout enforcement, temp file cleanup
 */

import { Injectable, Logger } from '@nestjs/common';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

export type AudioConversionRequest = {
  inputBuffer: Buffer;
  inputMime: string;
};

export type AudioConversionResult = {
  wavBuffer: Buffer;
  durationMs: number;
};

@Injectable()
export class AudioConversionService {
  private readonly logger = new Logger(AudioConversionService.name);
  private readonly timeoutMs = 30000;

  /**
   * Convert audio to WAV mono 16-bit 16kHz for Meta Voice API
   * Enforces 120s max duration
   */
  async convertToWav(request: AudioConversionRequest): Promise<AudioConversionResult> {
    const tempId = randomUUID();
    const inputExt = this.getExtension(request.inputMime);
    const inputPath = join(tmpdir(), `sosmesh-in-${tempId}${inputExt}`);
    const outputPath = join(tmpdir(), `sosmesh-out-${tempId}.wav`);

    try {
      await writeFile(inputPath, request.inputBuffer);

      const args = [
        '-i', inputPath,
        '-ac', '1',
        '-ar', '16000',
        '-c:a', 'pcm_s16le',
        '-map_metadata', '-1',
        '-t', '120',
        '-f', 'wav',
        '-y',
        outputPath,
      ];

      await this.runFfmpeg(args);

      const durationMs = await this.probeDuration(outputPath);
      const wavBuffer = await this.readFile(outputPath);

      return { wavBuffer, durationMs };
    } finally {
      await this.cleanup([inputPath, outputPath]);
    }
  }

  /**
   * Validate audio duration without conversion
   */
  async validateDuration(buffer: Buffer, mime: string): Promise<number> {
    const tempId = randomUUID();
    const ext = this.getExtension(mime);
    const path = join(tmpdir(), `sosmesh-probe-${tempId}${ext}`);

    try {
      await writeFile(path, buffer);
      return await this.probeDuration(path);
    } finally {
      await this.cleanup([path]);
    }
  }

  private async runFfmpeg(args: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const proc = spawn('ffmpeg', args, {
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: this.timeoutMs,
      });

      let stderr = '';

      proc.stderr.on('data', (chunk) => {
        stderr += chunk.toString();
      });

      proc.on('error', (error) => {
        reject(new Error(`ffmpeg spawn failed: ${error.message}`));
      });

      proc.on('exit', (code) => {
        if (code === 0) {
          resolve();
        } else {
          const lines = stderr.split('\n').filter((line) => !line.includes('configuration:') && !line.includes('lib'));
          const relevantLines = lines.slice(-10).join('\n').substring(0, 500);
          reject(new Error(`ffmpeg exited with code ${code}: ${relevantLines}`));
        }
      });

      const timer = setTimeout(() => {
        if (!proc.killed) {
          proc.kill('SIGTERM');
          reject(new Error('ffmpeg timeout'));
        }
      }, this.timeoutMs);

      proc.on('exit', () => clearTimeout(timer));
    });
  }

  private async probeDuration(path: string): Promise<number> {
    return new Promise((resolve, reject) => {
      const args = [
        '-v', 'error',
        '-show_entries', 'format=duration',
        '-of', 'default=noprint_wrappers=1:nokey=1',
        path,
      ];

      const proc = spawn('ffprobe', args, {
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: 10000,
      });

      let stdout = '';

      proc.stdout.on('data', (chunk) => {
        stdout += chunk.toString();
      });

      proc.on('error', (error) => {
        reject(new Error(`ffprobe spawn failed: ${error.message}`));
      });

      const timer = setTimeout(() => {
        if (!proc.killed) {
          proc.kill('SIGTERM');
          reject(new Error('ffprobe timeout'));
        }
      }, 10000);

      proc.on('exit', (code) => {
        clearTimeout(timer);
        if (code === 0) {
          const durationSeconds = parseFloat(stdout.trim());
          if (Number.isNaN(durationSeconds)) {
            reject(new Error('Invalid duration from ffprobe'));
          } else {
            resolve(Math.round(durationSeconds * 1000));
          }
        } else {
          reject(new Error(`ffprobe exited with code ${code}`));
        }
      });
    });
  }

  private async readFile(path: string): Promise<Buffer> {
    const fs = await import('node:fs/promises');
    return fs.readFile(path);
  }

  private async cleanup(paths: string[]): Promise<void> {
    await Promise.allSettled(
      paths.map((path) =>
        unlink(path).catch((err) => {
          this.logger.debug({ msg: 'Cleanup failed', path, err: err.message });
        })
      )
    );
  }

  private getExtension(mime: string): string {
    const map: Record<string, string> = {
      'audio/wav': '.wav',
      'audio/x-wav': '.wav',
      'audio/wave': '.wav',
      'audio/mpeg': '.mp3',
      'audio/mp3': '.mp3',
      'audio/mp4': '.m4a',
      'audio/aac': '.aac',
      'audio/x-m4a': '.m4a',
      'audio/ogg': '.ogg',
      'audio/opus': '.opus',
      'audio/webm': '.webm',
    };

    return map[mime] ?? '.bin';
  }
}
