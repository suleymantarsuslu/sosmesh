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

// ONLINE (direct internet upload): 15 MB
const MEDIA_ONLINE_MAX_IMAGE_BYTES = Number(process.env.MEDIA_ONLINE_MAX_IMAGE_BYTES ?? 15_728_640);
// MESH (BLE relay): 16 KB (from mesh-payload-limits.ts)
const MAX_MESH_OPAQUE_CIPHERTEXT_BYTES = 16_384;

const ALLOWED_FORMATS = ['jpeg', 'png', 'webp'];
const MAX_AI_DIMENSION = 2048; // Downscale to this for AI processing

export type PhotoValidationResult =
  | { 
      valid: true; 
      buffer: Buffer; 
      sha256: string; 
      mime: string; 
      width: number; 
      height: number;
      downscaled: boolean;
      originalWidth?: number;
      originalHeight?: number;
    }
  | { valid: false; reason: string };

export type PhotoValidationRequest = {
  buffer: Buffer;
  source?: 'online' | 'mesh';
};

@Injectable()
export class PhotoValidatorService {
  private readonly logger = new Logger(PhotoValidatorService.name);

  /**
   * Validate and sanitize a photo upload
   * - Check format (jpeg/png/webp)
   * - Check size based on source (online: 15MB, mesh: 16KB)
   * - Strip ALL EXIF/GPS metadata (privacy)
   * - Downscale if >2048px on long edge (for AI processing)
   * - Return sanitized buffer with sha256
   */
  async validateAndSanitize(request: PhotoValidationRequest): Promise<PhotoValidationResult> {
    const { buffer, source = 'online' } = request;
    
    // Size check based on source
    const maxBytes = source === 'mesh' ? MAX_MESH_OPAQUE_CIPHERTEXT_BYTES : MEDIA_ONLINE_MAX_IMAGE_BYTES;
    if (buffer.length > maxBytes) {
      return {
        valid: false,
        reason: `Photo too large: ${buffer.length} bytes (max ${maxBytes} for ${source})`,
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

    const originalWidth = metadata.width ?? 0;
    const originalHeight = metadata.height ?? 0;

    if (originalWidth === 0 || originalHeight === 0) {
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

    // Determine if downscaling needed
    const maxDim = Math.max(originalWidth, originalHeight);
    const needsDownscale = maxDim > MAX_AI_DIMENSION;
    
    let processedImage = image.rotate(); // Apply EXIF orientation first

    if (needsDownscale) {
      const scale = MAX_AI_DIMENSION / maxDim;
      const newWidth = Math.round(originalWidth * scale);
      const newHeight = Math.round(originalHeight * scale);
      
      processedImage = processedImage.resize(newWidth, newHeight, {
        fit: 'inside',
        withoutEnlargement: true,
      });
    }

    // Strip ALL metadata (EXIF, GPS, orientation, color profile, etc.)
    let sanitized: Buffer;
    try {
      sanitized = await processedImage.toBuffer({ resolveWithObject: false });
    } catch (error) {
      this.logger.error({ err: error, msg: 'Failed to strip metadata' });
      return { valid: false, reason: 'Failed to sanitize image' };
    }

    // Get final dimensions
    const finalMetadata = await sharp(sanitized).metadata();
    const finalWidth = finalMetadata.width ?? originalWidth;
    const finalHeight = finalMetadata.height ?? originalHeight;

    // Compute sha256 of sanitized image
    const sha256 = createHash('sha256').update(sanitized).digest('hex');

    const mime = this.formatToMime(metadata.format);

    this.logger.log({
      msg: 'Photo validated and sanitized',
      format: metadata.format,
      originalWidth,
      originalHeight,
      finalWidth,
      finalHeight,
      downscaled: needsDownscale,
      originalBytes: buffer.length,
      sanitizedBytes: sanitized.length,
      sha256,
      gpsStripped: hasGps,
      source,
    });

    return {
      valid: true,
      buffer: sanitized,
      sha256,
      mime,
      width: finalWidth,
      height: finalHeight,
      downscaled: needsDownscale,
      ...(needsDownscale ? { originalWidth, originalHeight } : {}),
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
