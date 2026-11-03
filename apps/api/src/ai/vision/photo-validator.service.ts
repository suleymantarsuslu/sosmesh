/**
 * Photo Validator Service
 * Work Package C - Vision
 * 
 * Validates photo uploads: jpeg/png/webp, 10 MB max, sha256, EXIF/GPS stripping
 */

import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'node:crypto';
import sharp, { type Sharp, type Metadata } from 'sharp';
import ExifReader from 'exifreader';

const MAX_PHOTO_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_FORMATS = ['jpeg', 'png', 'webp'];

export type PhotoValidationResult =
  | { valid: true; buffer: Buffer; sha256: string; mime: string; width: number; height: number }
  | { valid: false; reason: string };

@Injectable()
export class PhotoValidatorService {
  private readonly logger = new Logger(PhotoValidatorService.name);

  /**
   * Validate and sanitize a photo upload
   * - Check format (jpeg/png/webp)
   * - Check size (≤10 MB)
   * - Strip ALL EXIF/GPS metadata (privacy)
   * - Return sanitized buffer with sha256
   */
  async validateAndSanitize(buffer: Buffer): Promise<PhotoValidationResult> {
    // Size check
    if (buffer.length > MAX_PHOTO_BYTES) {
      return {
        valid: false,
        reason: `Photo too large: ${buffer.length} bytes (max ${MAX_PHOTO_BYTES})`,
      };
    }

    // Parse with sharp to detect format
    let image: Sharp;
    let metadata: Metadata;

    try {
      image = sharp(buffer);
      metadata = await image.metadata();
    } catch (error) {
      this.logger.warn({ err: error, msg: 'Invalid image format' });
      return { valid: false, reason: 'Invalid image format' };
    }

    // Check format
    if (!metadata.format || !ALLOWED_FORMATS.includes(metadata.format)) {
      return {
        valid: false,
        reason: `Unsupported format: ${metadata.format ?? 'unknown'}. Allowed: ${ALLOWED_FORMATS.join(', ')}`,
      };
    }

    const width = metadata.width ?? 0;
    const height = metadata.height ?? 0;

    if (width === 0 || height === 0) {
      return { valid: false, reason: 'Invalid image dimensions' };
    }

    // Check for GPS data in original EXIF (log warning but do NOT write to logs)
    const hasGps = await this.detectGpsMetadata(buffer);
    if (hasGps) {
      this.logger.warn({
        msg: 'GPS metadata detected and will be stripped',
        sizeBytes: buffer.length,
      });
    }

    // Strip ALL metadata (EXIF, GPS, orientation, color profile, etc.)
    let sanitized: Buffer;
    try {
      sanitized = await image
        .rotate() // Apply EXIF orientation, then strip
        .toBuffer({ resolveWithObject: false }); // toBuffer without metadata strips all EXIF/GPS
    } catch (error) {
      this.logger.error({ err: error, msg: 'Failed to strip metadata' });
      return { valid: false, reason: 'Failed to sanitize image' };
    }

    // Compute sha256 of sanitized image
    const sha256 = createHash('sha256').update(sanitized).digest('hex');

    const mime = this.formatToMime(metadata.format);

    this.logger.log({
      msg: 'Photo validated and sanitized',
      format: metadata.format,
      width,
      height,
      originalBytes: buffer.length,
      sanitizedBytes: sanitized.length,
      sha256,
      gpsStripped: hasGps,
    });

    return {
      valid: true,
      buffer: sanitized,
      sha256,
      mime,
      width,
      height,
    };
  }

  /**
   * Detect GPS metadata without logging coordinates (privacy)
   */
  private async detectGpsMetadata(buffer: Buffer): Promise<boolean> {
    try {
      const tags = ExifReader.load(buffer, { expanded: true });
      return Boolean(tags.gps);
    } catch {
      return false;
    }
  }

  private formatToMime(format: string): string {
    const map: Record<string, string> = {
      jpeg: 'image/jpeg',
      jpg: 'image/jpeg',
      png: 'image/png',
      webp: 'image/webp',
    };
    return map[format] ?? 'image/jpeg';
  }
}
