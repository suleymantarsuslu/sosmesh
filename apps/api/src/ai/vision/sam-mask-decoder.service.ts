/**
 * SAM Mask Decoder Service
 * Decodes SAM 3.1 `one_bit` masks (Meta SAM wire format) to PNG with transparency.
 *
 * Decoding is delegated to Meta's official parser (@meta-sam/parser), which implements the
 * base85 + arithmetic-coded `one_bit` format. The mask is placed at the box's (x1, y1) by the
 * caller; masks are downscaled relative to the box, so the PNG is resized to box dimensions.
 *
 * Wire format is `data=H,W,<payload>` (rows first). Rows stored before the parser regex was
 * fixed have width/height swapped, so the orientation is resolved from the box aspect ratio
 * and verified by the decoder (a wrong H/W pair fails strict payload validation).
 */

import { Injectable } from '@nestjs/common';
import sharp from 'sharp';

type MetaSamParser = typeof import('@meta-sam/parser');

// Prevents TypeScript (module=commonjs) from rewriting import() into require().
const nativeImport = new Function('specifier', 'return import(specifier)') as (
  specifier: string
) => Promise<MetaSamParser>;

@Injectable()
export class SamMaskDecoderService {
  private parser: MetaSamParser | null = null;

  /**
   * Decode one_bit mask to PNG data URL
   * Returns PNG with transparency at box dimensions
   *
   * @param maskData   stored mask data (marker + payload)
   * @param maskWidth  stored mask width (may be swapped with height for legacy rows)
   * @param maskHeight stored mask height
   */
  async decodeMaskToPng(
    maskData: string,
    maskWidth: number,
    maskHeight: number,
    boxWidth: number,
    boxHeight: number
  ): Promise<string> {
    if (typeof maskData !== 'string' || maskData.length < 2) {
      throw new Error('Invalid mask data');
    }
    if (maskData[0] !== '!') {
      throw new Error(`Unsupported mask encoding: ${maskData[0]}`);
    }

    const { raster, width, height } = await this.decodeRaster(
      maskData,
      maskWidth,
      maskHeight,
      boxWidth,
      boxHeight
    );

    const rgba = Buffer.alloc(width * height * 4, 255);
    for (let i = 0; i < raster.length; i++) {
      rgba[i * 4 + 3] = raster[i] ? 255 : 0;
    }

    let image = sharp(rgba, { raw: { width, height, channels: 4 } });
    if (width !== boxWidth || height !== boxHeight) {
      image = image.resize(boxWidth, boxHeight, { fit: 'fill', kernel: 'nearest' });
    }
    const png = await image.png().toBuffer();
    return `data:image/png;base64,${png.toString('base64')}`;
  }

  private async decodeRaster(
    maskData: string,
    storedWidth: number,
    storedHeight: number,
    boxWidth: number,
    boxHeight: number
  ): Promise<{ raster: Uint8Array; width: number; height: number }> {
    const parser = await this.loadParser();

    // Candidate orientations: as stored, and swapped (legacy rows stored H,W as W,H).
    const candidates = [
      { width: storedWidth, height: storedHeight },
      { width: storedHeight, height: storedWidth },
    ];
    // Prefer the orientation whose aspect ratio matches the box aspect ratio.
    const boxAspect = boxWidth / boxHeight;
    candidates.sort(
      (a, b) =>
        Math.abs(Math.log(a.width / a.height / boxAspect)) -
        Math.abs(Math.log(b.width / b.height / boxAspect))
    );

    let lastError: unknown;
    for (const candidate of candidates) {
      try {
        const raster = parser.decodeMaskToRaster({
          encoding: 'one_bit',
          width: candidate.width,
          height: candidate.height,
          payload: maskData,
        });
        return { raster, width: candidate.width, height: candidate.height };
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError instanceof Error ? lastError : new Error('Failed to decode mask');
  }

  /**
   * @meta-sam/parser is ESM-only. Node >= 20.19 / 22.12 can require() it; older runtimes
   * throw ERR_REQUIRE_ESM, in which case fall back to a native dynamic import.
   */
  private async loadParser(): Promise<MetaSamParser> {
    if (this.parser) {
      return this.parser;
    }
    try {
      this.parser = await import('@meta-sam/parser');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ERR_REQUIRE_ESM') {
        throw error;
      }
      this.parser = await nativeImport('@meta-sam/parser');
    }
    return this.parser;
  }
}
