/**
 * Audio Chunking Service - Split long audio into ASR-compatible chunks
 * Work Package B - Voice Rescue
 * 
 * Handles audio longer than 120s by splitting into chunks with ffmpeg
 */

import { Injectable, Logger } from '@nestjs/common';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { ASR_CHUNK_MAX_SECONDS } from './media.constants';

export type AudioChunk = {
  buffer: Buffer;
  startMs: number;
  endMs: number;
  chunkIndex: number;
};

@Injectable()
export class AudioChunkingService {
  private readonly logger = new Logger(AudioChunkingService.name);
  private readonly timeoutMs = 60000;

  /**
   * Split WAV file into chunks of max 120s each
   * Returns array of chunks with their time offsets
   */
  async chunkWavFile(wavBuffer: Buffer, totalDurationMs: number): Promise<AudioChunk[]> {
    const chunkDurationMs = ASR_CHUNK_MAX_SECONDS * 1000;

    if (totalDurationMs <= chunkDurationMs) {
      return [
        {
          buffer: wavBuffer,
          startMs: 0,
          endMs: totalDurationMs,
          chunkIndex: 0,
        },
      ];
    }

    const tempId = randomUUID();
    const inputPath = join(tmpdir(), `sosmesh-chunk-input-${tempId}.wav`);
    const chunks: AudioChunk[] = [];
    const tempFiles: string[] = [inputPath];

    try {
      await writeFile(inputPath, wavBuffer);

      const numChunks = Math.ceil(totalDurationMs / chunkDurationMs);

      for (let i = 0; i < numChunks; i++) {
        const startMs = i * chunkDurationMs;
        const endMs = Math.min((i + 1) * chunkDurationMs, totalDurationMs);
        const outputPath = join(tmpdir(), `sosmesh-chunk-${tempId}-${i}.wav`);
        tempFiles.push(outputPath);

        const startSeconds = startMs / 1000;
        const durationSeconds = (endMs - startMs) / 1000;

        await this.extractChunk(inputPath, outputPath, startSeconds, durationSeconds);

        const fs = await import('node:fs/promises');
        const chunkBuffer = await fs.readFile(outputPath);

        chunks.push({
          buffer: chunkBuffer,
          startMs,
          endMs,
          chunkIndex: i,
        });
      }

      this.logger.log({
        msg: 'Audio chunked',
        totalDurationMs,
        numChunks,
        chunkDurationMs,
      });

      return chunks;
    } finally {
      await this.cleanup(tempFiles);
    }
  }

  private async extractChunk(
    inputPath: string,
    outputPath: string,
    startSeconds: number,
    durationSeconds: number
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const args = [
        '-i', inputPath,
        '-ss', startSeconds.toString(),
        '-t', durationSeconds.toString(),
        '-c', 'copy',
        '-f', 'wav',
        '-y',
        outputPath,
      ];

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

      const timer = setTimeout(() => {
        if (!proc.killed) {
          proc.kill('SIGTERM');
          reject(new Error('ffmpeg chunk extraction timeout'));
        }
      }, this.timeoutMs);

      proc.on('exit', (code) => {
        clearTimeout(timer);
        if (code === 0) {
          resolve();
        } else {
          const lines = stderr.split('\n').filter((line) => !line.includes('configuration:'));
          const relevantLines = lines.slice(-10).join('\n').substring(0, 500);
          reject(new Error(`ffmpeg chunk extraction failed (code ${code}): ${relevantLines}`));
        }
      });
    });
  }

  private async cleanup(paths: string[]): Promise<void> {
    await Promise.allSettled(
      paths.map((path) =>
        unlink(path).catch((err) => {
          this.logger.debug({ msg: 'Chunk cleanup failed', path, err: err.message });
        })
      )
    );
  }
}
