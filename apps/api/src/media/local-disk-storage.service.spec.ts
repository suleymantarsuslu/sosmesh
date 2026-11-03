import { Test, TestingModule } from '@nestjs/testing';
import { LocalDiskStorageService, MediaStorageUnavailableError } from './local-disk-storage.service';
import * as fsPromises from 'node:fs/promises';

jest.mock('node:fs/promises', () => ({
  constants: {
    W_OK: 2,
  },
  mkdir: jest.fn(),
  access: jest.fn(),
  writeFile: jest.fn(),
  readFile: jest.fn(),
  unlink: jest.fn(),
  stat: jest.fn(),
  readdir: jest.fn(),
}));

describe('LocalDiskStorageService', () => {
  let service: LocalDiskStorageService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [LocalDiskStorageService],
    }).compile();

    service = module.get<LocalDiskStorageService>(LocalDiskStorageService);
  });

  describe('onModuleInit', () => {
    it('should verify storage health successfully', async () => {
      (fsPromises.mkdir as jest.Mock).mockResolvedValue(undefined);
      (fsPromises.access as jest.Mock).mockResolvedValue(undefined);

      await service.onModuleInit();

      const health = service.getStorageHealth();
      expect(health.healthy).toBe(true);
      expect(health.error).toBeNull();
      expect(fsPromises.mkdir).toHaveBeenCalledWith(
        expect.any(String),
        { recursive: true }
      );
      expect(fsPromises.access).toHaveBeenCalledWith(
        expect.any(String),
        fsPromises.constants.W_OK
      );
    });

    it('should handle EACCES error during verification', async () => {
      const accessError = Object.assign(new Error('Permission denied'), {
        code: 'EACCES',
      });
      (fsPromises.mkdir as jest.Mock).mockResolvedValue(undefined);
      (fsPromises.access as jest.Mock).mockRejectedValue(accessError);

      await service.onModuleInit();

      const health = service.getStorageHealth();
      expect(health.healthy).toBe(false);
      expect(health.error).toBeDefined();
      expect(health.error?.code).toBe('EACCES');
      expect(health.error?.message).toContain('Media storage unavailable');
    });

    it('should handle ENOENT error during verification', async () => {
      const mkdirError = Object.assign(new Error('No such file or directory'), {
        code: 'ENOENT',
      });
      (fsPromises.mkdir as jest.Mock).mockRejectedValue(mkdirError);

      await service.onModuleInit();

      const health = service.getStorageHealth();
      expect(health.healthy).toBe(false);
      expect(health.error).toBeDefined();
      expect(health.error?.code).toBe('ENOENT');
    });
  });

  describe('store', () => {
    beforeEach(() => {
      (fsPromises.mkdir as jest.Mock).mockResolvedValue(undefined);
      (fsPromises.access as jest.Mock).mockResolvedValue(undefined);
    });

    it('should throw MediaStorageUnavailableError on write failure', async () => {
      const writeError = Object.assign(new Error('Permission denied'), {
        code: 'EACCES',
      });
      (fsPromises.writeFile as jest.Mock).mockRejectedValue(writeError);

      const request = {
        buffer: Buffer.from('test'),
        mimeType: 'audio/wav',
      };

      await expect(service.store(request)).rejects.toThrow(MediaStorageUnavailableError);
      await expect(service.store(request)).rejects.toMatchObject({
        response: expect.objectContaining({
          code: 'MEDIA_STORAGE_UNAVAILABLE',
        }),
      });
    });

    it('should store media successfully when writable', async () => {
      (fsPromises.writeFile as jest.Mock).mockResolvedValue(undefined);

      const testBuffer = Buffer.from('test audio data');
      const request = {
        buffer: testBuffer,
        mimeType: 'audio/wav',
      };

      const result = await service.store(request);

      expect(result).toBeDefined();
      expect(result.storageKey).toBeDefined();
      expect(result.sizeBytes).toBe(testBuffer.length);
      expect(result.sha256).toBeDefined();
      expect(fsPromises.writeFile).toHaveBeenCalled();
    });
  });

  describe('getStorageHealth', () => {
    it('should return initial unhealthy state before init', () => {
      const health = service.getStorageHealth();
      expect(health.healthy).toBe(false);
      expect(health.error).toBeNull();
    });

    it('should return healthy state after successful init', async () => {
      (fsPromises.mkdir as jest.Mock).mockResolvedValue(undefined);
      (fsPromises.access as jest.Mock).mockResolvedValue(undefined);

      await service.onModuleInit();

      const health = service.getStorageHealth();
      expect(health.healthy).toBe(true);
      expect(health.error).toBeNull();
    });
  });
});
