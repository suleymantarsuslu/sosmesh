import sharp from 'sharp';

import { SamMaskDecoderService } from './sam-mask-decoder.service';

// Synthetic 5x5 `one_bit` payload from the @meta-sam/parser documentation (no real image data).
const FIXTURE_5X5 = '!!!!!(QO(0lu8?';

function pngFromDataUrl(dataUrl: string): Buffer {
  expect(dataUrl.startsWith('data:image/png;base64,')).toBe(true);
  return Buffer.from(dataUrl.slice('data:image/png;base64,'.length), 'base64');
}

describe('SamMaskDecoderService', () => {
  it('decodes a one_bit mask with the official parser and resizes it to the box', async () => {
    const service = new SamMaskDecoderService();

    const dataUrl = await service.decodeMaskToPng(FIXTURE_5X5, 5, 5, 10, 10);
    const meta = await sharp(pngFromDataUrl(dataUrl)).metadata();

    expect(meta.format).toBe('png');
    expect(meta.width).toBe(10);
    expect(meta.height).toBe(10);
    expect(meta.hasAlpha).toBe(true);
  });

  it('keeps the native mask size when it equals the box size', async () => {
    const service = new SamMaskDecoderService();

    const dataUrl = await service.decodeMaskToPng(FIXTURE_5X5, 5, 5, 5, 5);
    const meta = await sharp(pngFromDataUrl(dataUrl)).metadata();

    expect(meta.width).toBe(5);
    expect(meta.height).toBe(5);
  });

  it('rejects unsupported encodings and malformed payloads', async () => {
    const service = new SamMaskDecoderService();

    await expect(service.decodeMaskToPng('~abcdef', 5, 5, 5, 5)).rejects.toThrow(/Unsupported mask encoding/);
    await expect(service.decodeMaskToPng('!', 5, 5, 5, 5)).rejects.toThrow(/Invalid mask data/);
    await expect(service.decodeMaskToPng('!not-a-valid-payload', 5, 5, 5, 5)).rejects.toThrow();
  });

  describe('orientation of legacy rows (width/height stored swapped)', () => {
    function withFakeParser(service: SamMaskDecoderService, validRows: number, validCols: number) {
      const attempts: Array<{ width: number; height: number }> = [];
      const fake = {
        decodeMaskToRaster: jest.fn((mask: { width: number; height: number }) => {
          attempts.push({ width: mask.width, height: mask.height });
          if (mask.height !== validRows || mask.width !== validCols) {
            throw new Error('Mask payload length does not match its prefix.');
          }
          return new Uint8Array(mask.width * mask.height).fill(1);
        }),
      };
      (service as unknown as { parser: unknown }).parser = fake;
      return attempts;
    }

    it('tries the orientation that matches the box aspect ratio first', async () => {
      const service = new SamMaskDecoderService();
      // true raster: 40 rows x 20 cols (portrait). Legacy row stored width=40, height=20.
      const attempts = withFakeParser(service, 40, 20);

      await service.decodeMaskToPng('!!!!!(QO(0lu8?', 40, 20, 20, 40);

      expect(attempts[0]).toEqual({ width: 20, height: 40 });
      expect(attempts).toHaveLength(1);
    });

    it('falls back to the other orientation when the first guess fails', async () => {
      const service = new SamMaskDecoderService();
      // box aspect says landscape (tried first, fails), but the real raster is portrait (rows=40, cols=20)
      const attempts = withFakeParser(service, 40, 20);

      const dataUrl = await service.decodeMaskToPng('!!!!!(QO(0lu8?', 20, 40, 40, 20);

      expect(attempts).toEqual([
        { width: 40, height: 20 },
        { width: 20, height: 40 },
      ]);
      const meta = await sharp(pngFromDataUrl(dataUrl)).metadata();
      expect(meta.width).toBe(40);
      expect(meta.height).toBe(20);
    });
  });
});
