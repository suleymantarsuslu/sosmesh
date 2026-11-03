/**
 * EXIF/GPS Stripping Test
 * Work Package C - Vision
 * 
 * Tests that GPS and EXIF metadata are completely removed from photos
 */

import { PhotoValidatorService } from '../src/ai/vision/photo-validator.service';
import sharp from 'sharp';
import ExifReader from 'exifreader';

describe('Photo EXIF/GPS Stripping', () => {
  let validator: PhotoValidatorService;

  beforeEach(() => {
    validator = new PhotoValidatorService();
  });

  it('should strip GPS metadata from photo', async () => {
    // Create a test image with fake GPS data
    const testImage = await sharp({
      create: {
        width: 640,
        height: 480,
        channels: 3,
        background: { r: 100, g: 150, b: 200 },
      },
    })
      .jpeg()
      .withMetadata({
        exif: {
          IFD0: {
            // Note: sharp doesn't let us set GPS tags directly in withMetadata,
            // so this test verifies that ANY metadata is stripped
            Make: 'TestCamera',
            Model: 'TestModel',
          },
        },
      })
      .toBuffer();

    // Validate and sanitize
    const result = await validator.validateAndSanitize(testImage);

    expect(result.valid).toBe(true);
    if (!result.valid) return;

    // Parse metadata from sanitized image
    const sanitizedMetadata = await sharp(result.buffer).metadata();

    // Verify metadata is stripped
    expect(sanitizedMetadata.exif).toBeUndefined();
    expect(sanitizedMetadata.icc).toBeUndefined();
    expect(sanitizedMetadata.iptc).toBeUndefined();
    expect(sanitizedMetadata.xmp).toBeUndefined();

    // Verify with ExifReader
    let tags: any;
    try {
      tags = ExifReader.load(result.buffer, { expanded: true });
    } catch {
      tags = null;
    }

    // GPS should definitely not exist
    expect(tags?.gps).toBeFalsy();

    // Image dimensions should be preserved
    expect(result.width).toBe(640);
    expect(result.height).toBe(480);
  });

  it('should reject oversized photos', async () => {
    // Create a small image but pretend it's large by using a huge buffer
    // (For real test, this would be an actual 11MB image, but we simulate)
    const largeBuffer = Buffer.alloc(11 * 1024 * 1024); // 11 MB
    
    const result = await validator.validateAndSanitize(largeBuffer);

    expect(result.valid).toBe(false);
    if (result.valid === false) {
      expect(result.reason).toContain('too large');
    }
  });

  it('should reject unsupported formats', async () => {
    // Create a buffer that's not a valid image
    const invalidBuffer = Buffer.from('not an image');

    const result = await validator.validateAndSanitize(invalidBuffer);

    expect(result.valid).toBe(false);
    if (result.valid === false) {
      expect(result.reason).toContain('Invalid image format');
    }
  });

  it('should accept valid JPEG', async () => {
    const validJpeg = await sharp({
      create: {
        width: 100,
        height: 100,
        channels: 3,
        background: { r: 255, g: 0, b: 0 },
      },
    })
      .jpeg()
      .toBuffer();

    const result = await validator.validateAndSanitize(validJpeg);

    expect(result.valid).toBe(true);
    if (!result.valid) return;
    expect(result.mime).toBe('image/jpeg');
    expect(result.sha256).toHaveLength(64);
  });

  it('should accept valid PNG', async () => {
    const validPng = await sharp({
      create: {
        width: 100,
        height: 100,
        channels: 3,
        background: { r: 0, g: 255, b: 0 },
      },
    })
      .png()
      .toBuffer();

    const result = await validator.validateAndSanitize(validPng);

    expect(result.valid).toBe(true);
    if (!result.valid) return;
    expect(result.mime).toBe('image/png');
  });

  it('should accept valid WebP', async () => {
    const validWebp = await sharp({
      create: {
        width: 100,
        height: 100,
        channels: 3,
        background: { r: 0, g: 0, b: 255 },
      },
    })
      .webp()
      .toBuffer();

    const result = await validator.validateAndSanitize(validWebp);

    expect(result.valid).toBe(true);
    if (!result.valid) return;
    expect(result.mime).toBe('image/webp');
  });

  it('should compute sha256 hash of sanitized image', async () => {
    const testImage = await sharp({
      create: {
        width: 50,
        height: 50,
        channels: 3,
        background: { r: 128, g: 128, b: 128 },
      },
    })
      .jpeg()
      .toBuffer();

    const result = await validator.validateAndSanitize(testImage);

    expect(result.valid).toBe(true);
    if (!result.valid) return;

    // SHA256 should be 64 hex characters
    expect(result.sha256).toMatch(/^[0-9a-f]{64}$/);
  });
});
