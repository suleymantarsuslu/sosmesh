import { generateKeyPairSync, createHash } from 'crypto';
import { encryptPayload } from '@sosmesh/contracts';
import { BadRequestException } from '@nestjs/common';
import { DeviceAttachmentsController } from './device-attachments.controller';
import { DeviceUploadTokenService } from './device-upload-token.service';

const KEY_ID = 'test-relayed-001';

function keyPair() {
  const { publicKey, privateKey } = generateKeyPairSync('x25519');
  return {
    pub: publicKey.export({ format: 'der', type: 'spki' }).subarray(-32).toString('base64'),
    priv: privateKey.export({ format: 'der', type: 'pkcs8' }).subarray(-32).toString('base64'),
  };
}

describe('DeviceAttachmentsController relayed upload', () => {
  const keys = keyPair();
  const media = Buffer.from('fake-jpeg-bytes');
  const originalSha = createHash('sha256').update('the-original-bigger-photo').digest('hex');
  const sosMessage = { id: 'uuid-1', messageId: 'sos-1', incidentId: 'inc-1', packetHash: 'a'.repeat(64) };
  let prisma: any;
  let imageUpload: any;
  let audioUpload: any;
  let controller: DeviceAttachmentsController;
  let token: string;

  function encrypted(overrides: { sosId?: string; kind?: string; attachmentId?: string; mime?: string } = {}) {
    const env = {
      purpose: 'attachment',
      sosId: overrides.sosId ?? 'sos-1',
      attachmentId: overrides.attachmentId ?? 'att-1',
      kind: overrides.kind ?? 'image',
    };
    const payload = { mime: overrides.mime ?? 'image/jpeg', sha256: originalSha, data: media.toString('base64') };
    const e = encryptPayload(payload, env, { keyId: KEY_ID, serverPublicKey: keys.pub });
    return {
      file: { buffer: Buffer.from(e.ciphertext, 'base64'), size: 1 },
      body: { kind: 'image', attachmentId: 'att-1', nonce: e.nonce, ephemeralPublicKey: e.ephemeralPublicKey, keyId: e.keyId },
    };
  }

  beforeEach(() => {
    process.env.SOSMESH_SERVER_SOS_KEY_ID = KEY_ID;
    process.env.SOSMESH_SERVER_SOS_PRIVATE_KEY = keys.priv;
    delete process.env.AI_ENABLED;
    prisma = {
      sosMessage: { findUnique: jest.fn().mockResolvedValue(sosMessage) },
      attachment: { findFirst: jest.fn().mockResolvedValue(null), update: jest.fn().mockResolvedValue({}) },
    };
    const shrunkSha = createHash('sha256').update(media).digest('hex');
    imageUpload = { upload: jest.fn().mockResolvedValue({ attachmentId: 'a1', sha256: shrunkSha, sizeBytes: media.length }) };
    audioUpload = { upload: jest.fn() };
    const tokens = new DeviceUploadTokenService({ get: () => Buffer.from('secret').toString('base64') } as any);
    tokens.onModuleInit();
    token = tokens.generateToken('sos-1', sosMessage.packetHash);
    controller = new DeviceAttachmentsController(audioUpload, imageUpload, prisma, { enqueue: jest.fn() } as any, tokens);
  });

  it('decrypts, stores the shrunk copy and keys it by the original sha256', async () => {
    const { file, body } = encrypted();
    const res = await controller.uploadRelayedAttachment(token, body, file);
    expect(imageUpload.upload).toHaveBeenCalledWith(expect.objectContaining({ mimeType: 'image/jpeg', incidentId: 'inc-1' }));
    expect(imageUpload.upload.mock.calls[0][0].buffer.equals(media)).toBe(true);
    expect(prisma.attachment.update).toHaveBeenCalledWith({ where: { id: 'a1' }, data: { sha256: originalSha } });
    expect(res.sha256).toBe(originalSha);
  });

  it('dedups against an attachment already stored with the original sha256 (first arrival wins)', async () => {
    prisma.attachment.findFirst.mockResolvedValue({ id: 'existing', sha256: originalSha, sizeBytes: 9 });
    const { file, body } = encrypted();
    const res = await controller.uploadRelayedAttachment(token, body, file);
    expect(imageUpload.upload).not.toHaveBeenCalled();
    expect(res).toMatchObject({ attachmentId: 'existing', duplicate: true });
  });

  it('rejects a blob whose AAD does not match (tampered attachmentId)', async () => {
    const { file, body } = encrypted();
    await expect(controller.uploadRelayedAttachment(token, { ...body, attachmentId: 'att-other' }, file)).rejects.toBeInstanceOf(
      BadRequestException
    );
    expect(imageUpload.upload).not.toHaveBeenCalled();
  });

  it('rejects a blob encrypted for another SOS', async () => {
    const { file, body } = encrypted({ sosId: 'sos-2' });
    await expect(controller.uploadRelayedAttachment(token, body, file)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a mime that does not match the kind', async () => {
    const { file, body } = encrypted({ mime: 'audio/aac' });
    await expect(controller.uploadRelayedAttachment(token, body, file)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('requires the upload token', async () => {
    const { file, body } = encrypted();
    await expect(controller.uploadRelayedAttachment(undefined, body, file)).rejects.toBeInstanceOf(BadRequestException);
  });
});
