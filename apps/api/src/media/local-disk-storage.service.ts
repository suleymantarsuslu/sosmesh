/**
 * Local Disk Storage Implementation
 * Work Package A - AI Foundation
 * 
 * Stores media files in MEDIA_STORAGE_DIR with content-addressed keys
 */

import { Injectable, Logger, OnModuleInit, ServiceUnavailableException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, unlink, access, stat, readdir, constants } from 'node:fs/promises';
import { join } from 'node:path';
import type {
  MediaStorage,
  StoreMediaRequest,
  StoreMediaResult,
  MediaMetadata,
} from './media-storage.interface';

export class MediaStorageUnavailableError extends ServiceUnavailableException {
  constructor(message: string, cause?: Error) {
    super({
      code: 'MEDIA_STORAGE_UNAVAILABLE',
      message,
    });
    if (cause) {
      this.cause = cause;
    }
  }
}

@Injectable()
export class LocalDiskStorageService implements MediaStorage, OnModuleInit {
  private readonly logger = new Logger(LocalDiskStorageService.name);
  private readonly storageDir: string;
  private storageHealthy = false;
  private storageHealthError: { code: string; path: string; message: string } | null = null;

  constructor() {
    this.storageDir = process.env.MEDIA_STORAGE_DIR ?? '/tmp/sosmesh-media';
  }

  async onModuleInit(): Promise<void> {
    await this.verifyStorageHealth();
  }

  getStorageHealth(): { healthy: boolean; error: { code: string; path: string; message: string } | null } {
    return {
      healthy: this.storageHealthy,
      error: this.storageHealthError,
    };
  }

  private async verifyStorageHealth(): Promise<void> {
    try {
      await mkdir(this.storageDir, { recursive: true });
      await access(this.storageDir, constants.W_OK);
      this.storageHealthy = true;
      this.storageHealthError = null;
      this.logger.log({ msg: 'Media storage verified', path: this.storageDir });
    } catch (error) {
      const err = error as NodeJS.ErrnoException;
      this.storageHealthy = false;
      this.storageHealthError = {
        code: err.code ?? 'UNKNOWN',
        path: this.storageDir,
        message: `Media storage unavailable: ${err.code ?? 'UNKNOWN'} at ${this.storageDir}`,
      };
      this.logger.error({
        msg: 'Media storage verification failed',
        code: err.code,
        path: this.storageDir,
        error: err.message,
      });
    }
  }

  async store(request: StoreMediaRequest): Promise<StoreMediaResult> {
    await this.ensureStorageDir();

    const sha256 = request.sha256 ?? this.computeSha256(request.buffer);
    const storageKey = this.buildStorageKey(sha256, request.mimeType);
    const filePath = this.resolveFilePath(storageKey);

    try {
      await writeFile(filePath, request.buffer);
    } catch (error) {
      const err = error as NodeJS.ErrnoException;
      this.logger.error({
        msg: 'Failed to write media file',
        code: err.code,
        path: filePath,
        error: err.message,
      });
      throw new MediaStorageUnavailableError(
        `Failed to write media file: ${err.code ?? 'UNKNOWN'}`,
        err
      );
    }

    this.logger.log({
      msg: 'Media stored',
      storageKey,
      sizeBytes: request.buffer.length,
      sha256,
    });

    return {
      storageKey,
      sizeBytes: request.buffer.length,
      sha256,
    };
  }

  async retrieve(storageKey: string): Promise<Buffer | null> {
    const filePath = this.resolveFilePath(storageKey);

    try {
      return await readFile(filePath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }

  async exists(storageKey: string): Promise<boolean> {
    const filePath = this.resolveFilePath(storageKey);

    try {
      await access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async getMetadata(storageKey: string): Promise<MediaMetadata | null> {
    const filePath = this.resolveFilePath(storageKey);

    try {
      const stats = await stat(filePath);
      const mimeType = this.extractMimeFromKey(storageKey);

      return {
        storageKey,
        sizeBytes: stats.size,
        mimeType,
        exists: true,
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }

  async delete(storageKey: string): Promise<void> {
    const filePath = this.resolveFilePath(storageKey);

    try {
      await unlink(filePath);
      this.logger.log({ msg: 'Media deleted', storageKey });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return;
      }
      throw error;
    }
  }

  async listExpired(beforeDate: Date): Promise<string[]> {
    await this.ensureStorageDir();

    try {
      const files = await readdir(this.storageDir);
      const expired: string[] = [];

      for (const file of files) {
        const filePath = join(this.storageDir, file);
        const stats = await stat(filePath);

        if (stats.mtime < beforeDate) {
          expired.push(file);
        }
      }

      return expired;
    } catch (error) {
      this.logger.error({ err: error, msg: 'Failed to list expired media' });
      return [];
    }
  }

  private async ensureStorageDir(): Promise<void> {
    try {
      await mkdir(this.storageDir, { recursive: true });
    } catch (error) {
      this.logger.error({ err: error, msg: 'Failed to create storage directory' });
      throw error;
    }
  }

  private computeSha256(buffer: Buffer): string {
    return createHash('sha256').update(buffer).digest('hex');
  }

  private buildStorageKey(sha256: string, mimeType: string): string {
    const ext = this.mimeToExtension(mimeType);
    return `${sha256.substring(0, 2)}/${sha256.substring(2, 4)}/${sha256}${ext}`;
  }

  private resolveFilePath(storageKey: string): string {
    return join(this.storageDir, storageKey);
  }

  private mimeToExtension(mimeType: string): string {
    const map: Record<string, string> = {
      'audio/wav': '.wav',
      'audio/wave': '.wav',
      'audio/x-wav': '.wav',
      'audio/mpeg': '.mp3',
      'audio/mp4': '.m4a',
      'audio/aac': '.aac',
      'audio/ogg': '.ogg',
      'audio/webm': '.webm',
      'image/jpeg': '.jpg',
      'image/jpg': '.jpg',
      'image/png': '.png',
      'image/gif': '.gif',
      'image/webp': '.webp',
    };

    return map[mimeType.toLowerCase()] ?? '.bin';
  }

  private extractMimeFromKey(storageKey: string): string {
    const ext = storageKey.substring(storageKey.lastIndexOf('.'));
    const map: Record<string, string> = {
      '.wav': 'audio/wav',
      '.mp3': 'audio/mpeg',
      '.m4a': 'audio/mp4',
      '.aac': 'audio/aac',
      '.ogg': 'audio/ogg',
      '.webm': 'audio/webm',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
    };

    return map[ext] ?? 'application/octet-stream';
  }
}
