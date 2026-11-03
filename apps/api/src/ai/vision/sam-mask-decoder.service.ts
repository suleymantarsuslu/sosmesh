/**
 * SAM Mask Decoder Service
 * Decodes SAM 3.1 one_bit masks to PNG with transparency
 * 
 * Mask placement: mask is placed at box's (x1, y1), not at mask's (x, y)
 * The x/y in mask metadata is always 0,0
 * Masks are downscaled to fit the box, so resize mask to box dimensions
 */

import { Injectable } from '@nestjs/common';
import sharp from 'sharp';

const BASE85_ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz!#$%&()*+-;<=>?@^_`{|}~';

@Injectable()
export class SamMaskDecoderService {
  /**
   * Decode one_bit mask to PNG data URL
   * Returns PNG with transparency at box dimensions
   */
  async decodeMaskToPng(
    maskData: string,
    maskWidth: number,
    maskHeight: number,
    boxWidth: number,
    boxHeight: number
  ): Promise<string> {
    // Parse encoding marker and base85 data
    if (maskData.length < 2) {
      throw new Error('Invalid mask data');
    }

    const encoding = maskData[0];
    if (encoding !== '!') {
      throw new Error(`Unsupported mask encoding: ${encoding}`);
    }

    const base85Data = maskData.substring(1);

    // Decode base85 to binary
    const decoded = this.decodeBase85(base85Data);

    // Convert to boolean array (one_bit encoding)
    const bits = this.bytesToBits(decoded);

    // Create mask raster
    const maskRaster = new Uint8Array(maskWidth * maskHeight * 4); // RGBA

    for (let y = 0; y < maskHeight; y++) {
      for (let x = 0; x < maskWidth; x++) {
        const bitIndex = y * maskWidth + x;
        const isSet = bitIndex < bits.length && bits[bitIndex];

        const pixelIndex = (y * maskWidth + x) * 4;
        maskRaster[pixelIndex] = 255;     // R - white
        maskRaster[pixelIndex + 1] = 255; // G - white
        maskRaster[pixelIndex + 2] = 255; // B - white
        maskRaster[pixelIndex + 3] = isSet ? 255 : 0; // A - fully opaque or transparent
      }
    }

    // Resize mask to box dimensions if needed
    let finalBuffer = await sharp(maskRaster, {
      raw: {
        width: maskWidth,
        height: maskHeight,
        channels: 4,
      },
    })
      .png()
      .toBuffer();

    // Resize to box dimensions
    if (maskWidth !== boxWidth || maskHeight !== boxHeight) {
      finalBuffer = await sharp(finalBuffer)
        .resize(boxWidth, boxHeight, {
          fit: 'fill',
          kernel: 'nearest',
        })
        .png()
        .toBuffer();
    }

    // Convert to data URL
    return `data:image/png;base64,${finalBuffer.toString('base64')}`;
  }

  private decodeBase85(base85: string): Uint8Array {
    const result: number[] = [];
    let accumulator = 0;
    let count = 0;

    for (let i = 0; i < base85.length; i++) {
      const char = base85[i];
      const value = BASE85_ALPHABET.indexOf(char);

      if (value === -1) {
        throw new Error(`Invalid base85 character: ${char}`);
      }

      accumulator = accumulator * 85 + value;
      count++;

      if (count === 5) {
        // Decode 5 base85 chars -> 4 bytes
        result.push((accumulator >> 24) & 0xff);
        result.push((accumulator >> 16) & 0xff);
        result.push((accumulator >> 8) & 0xff);
        result.push(accumulator & 0xff);

        accumulator = 0;
        count = 0;
      }
    }

    // Handle remaining bytes
    if (count > 0) {
      for (let i = count; i < 5; i++) {
        accumulator = accumulator * 85 + 84; // Pad with 'u' (84)
      }

      for (let i = 0; i < count - 1; i++) {
        result.push((accumulator >> (24 - i * 8)) & 0xff);
      }
    }

    return new Uint8Array(result);
  }

  private bytesToBits(bytes: Uint8Array): boolean[] {
    const bits: boolean[] = [];

    for (const byte of bytes) {
      for (let i = 7; i >= 0; i--) {
        bits.push((byte & (1 << i)) !== 0);
      }
    }

    return bits;
  }
}
