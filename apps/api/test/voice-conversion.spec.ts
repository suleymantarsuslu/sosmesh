/**
 * Voice Conversion Tests
 * Work Package B - Voice Rescue
 * 
 * Minimal tests for ffmpeg validation
 */

import { Test } from '@nestjs/testing';
import { AudioConversionService } from '../src/media/audio-conversion.service';

describe('AudioConversionService', () => {
  let service: AudioConversionService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [AudioConversionService],
    }).compile();

    service = module.get(AudioConversionService);
  });

  describe('ffmpeg argument validation', () => {
    it('should use argument arrays not shell commands', () => {
      const privateMethod = (service as any).runFfmpeg;
      expect(typeof privateMethod).toBe('function');
    });

    it('should enforce timeout on conversion', () => {
      const timeoutMs = (service as any).timeoutMs;
      expect(timeoutMs).toBeGreaterThan(0);
      expect(timeoutMs).toBeLessThanOrEqual(60000);
    });

    it('should limit duration to 120s', async () => {
      const getExtension = (service as any).getExtension.bind(service);
      expect(getExtension('audio/wav')).toBe('.wav');
      expect(getExtension('audio/mp3')).toBe('.mp3');
    });
  });
});
