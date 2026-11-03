import { OperatorAttachmentsService } from './operator-attachments.service';

describe('OperatorAttachmentsService.getAttachmentMasks', () => {
  const attachmentId = '0fe65338-ebea-40c2-a787-0b0b5fd1e7a6';
  const storageKey = 'f4/8f/f48f3f99381c1783776842b021ce41a1dd940858447f0c7fda49a193f6f4ea00.jpg';

  const samResults = [
    {
      concept: 'person',
      segments: [
        {
          id: 'seg-1',
          confidence: 0.9,
          boundingBox: { x1: 100, y1: 200, x2: 299, y2: 399, width: 2000, height: 1000 },
          mask: null,
        },
      ],
    },
    { concept: 'fire', segments: [] },
  ];

  function build(attachment: unknown, metadata: unknown) {
    const prisma = { attachment: { findUnique: jest.fn().mockResolvedValue(attachment) } };
    const storage = { getMetadata: jest.fn().mockResolvedValue(metadata) };
    const decoder = { decodeMaskToPng: jest.fn() };
    const service = new OperatorAttachmentsService(prisma as never, storage as never, decoder as never);
    return { service, storage };
  }

  it('looks the media file up by storage key and returns normalized segments', async () => {
    const { service, storage } = build(
      { storageKey, visionAnalysis: { samResults } },
      { storageKey, sizeBytes: 10, mimeType: 'image/jpeg', exists: true }
    );

    const result = await service.getAttachmentMasks(attachmentId);

    expect(storage.getMetadata).toHaveBeenCalledWith(storageKey);
    expect(result).toEqual({
      found: true,
      imageWidth: 2000,
      imageHeight: 1000,
      segments: [
        {
          concept: 'person',
          id: 'seg-1',
          confidence: 0.9,
          box: { x: 0.05, y: 0.2, w: 0.1, h: 0.2 },
          maskPng: null,
        },
      ],
    });
  });

  it('returns not found when there is no vision analysis', async () => {
    const { service } = build({ storageKey, visionAnalysis: null }, null);
    expect(await service.getAttachmentMasks(attachmentId)).toEqual({ found: false });
  });

  it('returns not found when the stored media file is missing', async () => {
    const { service } = build({ storageKey, visionAnalysis: { samResults } }, null);
    expect(await service.getAttachmentMasks(attachmentId)).toEqual({ found: false });
  });
});
