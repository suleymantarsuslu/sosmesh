import { describe, it, expect } from 'vitest';

import { createMockTransportPair } from './mock-transport';
import { Receiver } from './receiver';
import { Sender } from './sender';
import { AckLevel } from './types';

describe('BLE Protocol Integration Tests', () => {
  it('should successfully transfer a message end-to-end', async () => {
    const { senderTransport, receiverTransport, channel } = createMockTransportPair({
      packetLoss: 0,
      duplicateRate: 0,
      reorderRate: 0,
      minLatency: 10,
      maxLatency: 20
    });

    const sender = new Sender(senderTransport);
    const receiver = new Receiver(receiverTransport);

    const testPayload = Buffer.from(JSON.stringify({
      envelope: {
        timestamp: '2026-10-29T17:00:00Z',
        location: { latitude: 0, longitude: 0 },
        priority: 1,
        ackLevel: 'PEER_RECEIVED'
      },
      encryptedPayload: 'BASE64_ENCRYPTED_CONTENT_NO_REAL_PII'
    }));

    let receivedPayload: Buffer | null = null;
    let receivedAckLevel: AckLevel | null = null;

    receiver.on('completed', ({ payload, ackLevel }) => {
      receivedPayload = payload;
      receivedAckLevel = ackLevel;
    });

    const events: any[] = [];
    sender.on('event', (event) => events.push({ source: 'sender', ...event }));
    receiver.on('event', (event) => events.push({ source: 'receiver', ...event }));

    const completedPromise = new Promise<void>((resolve, reject) => {
      sender.on('completed', resolve);
      sender.on('failed', reject);
      setTimeout(() => reject(new Error('Timeout')), 5000);
    });

    await sender.startTransfer(testPayload, 'integration_test');
    await completedPromise;

    // Wait for receiver to complete
    await new Promise(resolve => setTimeout(resolve, 200));

    // Verify payload received correctly
    expect(receivedPayload).not.toBeNull();
    expect(receivedPayload!.equals(testPayload)).toBe(true);

    // Verify ACK level is PEER_RECEIVED
    expect(receivedAckLevel).toBe(AckLevel.PEER_RECEIVED);

    // Verify events are logged (no payload content)
    const senderEvents = events.filter(e => e.source === 'sender');
    const receiverEvents = events.filter(e => e.source === 'receiver');

    expect(senderEvents.length).toBeGreaterThan(0);
    expect(receiverEvents.length).toBeGreaterThan(0);

    // Ensure no events contain payload data
    const allEventStrings = events.map(e => JSON.stringify(e));
    for (const eventStr of allEventStrings) {
      expect(eventStr).not.toContain('BASE64_ENCRYPTED');
      expect(eventStr).not.toContain('encryptedPayload');
    }

    sender.close();
    receiver.close();
    channel.close();
  });

  it('should handle packet loss with retries', async () => {
    const { senderTransport, receiverTransport, channel } = createMockTransportPair({
      packetLoss: 0.10, // 10% packet loss
      duplicateRate: 0,
      reorderRate: 0,
      minLatency: 5,
      maxLatency: 15
    });

    const sender = new Sender(senderTransport, { maxRetries: 12, chunkTimeout: 500 });
    const receiver = new Receiver(receiverTransport);

    const testPayload = Buffer.from('TEST_WITH_PACKET_LOSS_' + 'X'.repeat(250));
    let receivedPayload: Buffer | null = null;

    receiver.on('completed', ({ payload }) => {
      receivedPayload = payload;
    });

    const completedPromise = new Promise<void>((resolve, reject) => {
      sender.on('completed', resolve);
      sender.on('failed', reject);
      setTimeout(() => reject(new Error('Timeout')), 20000);
    });

    await sender.startTransfer(testPayload, 'loss_test');
    await completedPromise;

    await new Promise(resolve => setTimeout(resolve, 200));

    expect(receivedPayload).not.toBeNull();
    expect(receivedPayload!.equals(testPayload)).toBe(true);

    sender.close();
    receiver.close();
    channel.close();
  }, 25000); // Test timeout

  it('should handle reordered packets', async () => {
    const { senderTransport, receiverTransport, channel } = createMockTransportPair({
      packetLoss: 0,
      duplicateRate: 0,
      reorderRate: 0.8, // 80% reorder rate
      minLatency: 10,
      maxLatency: 100
    });

    const sender = new Sender(senderTransport);
    const receiver = new Receiver(receiverTransport);

    const testPayload = Buffer.from('TEST_REORDERING_' + 'Y'.repeat(600));
    let receivedPayload: Buffer | null = null;

    receiver.on('completed', ({ payload }) => {
      receivedPayload = payload;
    });

    const completedPromise = new Promise<void>((resolve, reject) => {
      sender.on('completed', resolve);
      sender.on('failed', reject);
      setTimeout(() => reject(new Error('Timeout')), 10000);
    });

    await sender.startTransfer(testPayload, 'reorder_test');
    await completedPromise;

    await new Promise(resolve => setTimeout(resolve, 300));

    expect(receivedPayload).not.toBeNull();
    expect(receivedPayload!.equals(testPayload)).toBe(true);

    sender.close();
    receiver.close();
    channel.close();
  });

  it('should deduplicate duplicate packets', async () => {
    const { senderTransport, receiverTransport, channel } = createMockTransportPair({
      packetLoss: 0,
      duplicateRate: 0.5, // 50% duplicate rate
      reorderRate: 0,
      minLatency: 10,
      maxLatency: 30
    });

    const sender = new Sender(senderTransport);
    const receiver = new Receiver(receiverTransport);

    const testPayload = Buffer.from('TEST_DUPLICATES');
    let completionCount = 0;

    receiver.on('completed', () => {
      completionCount++;
    });

    const completedPromise = new Promise<void>((resolve, reject) => {
      sender.on('completed', resolve);
      sender.on('failed', reject);
      setTimeout(() => reject(new Error('Timeout')), 5000);
    });

    await sender.startTransfer(testPayload, 'dup_test');
    await completedPromise;

    // Wait for any delayed duplicates
    await new Promise(resolve => setTimeout(resolve, 500));

    // Should complete exactly once
    expect(completionCount).toBe(1);

    sender.close();
    receiver.close();
    channel.close();
  });

  it('should log events in secure format (no PII)', async () => {
    const { senderTransport, receiverTransport, channel } = createMockTransportPair({
      packetLoss: 0,
      duplicateRate: 0,
      reorderRate: 0,
      minLatency: 10,
      maxLatency: 20
    });

    const sender = new Sender(senderTransport);
    const receiver = new Receiver(receiverTransport);

    // Payload with "sensitive" data that should NOT appear in logs
    const sensitivePayload = Buffer.from(JSON.stringify({
      envelope: {
        timestamp: '2026-10-29T17:00:00Z',
        location: { latitude: 41.0082, longitude: 28.9784 }, // Real GPS - should NOT be in logs
        priority: 1,
        ackLevel: 'PEER_RECEIVED'
      },
      encryptedPayload: 'SECRET_MESSAGE_HELP_NEEDED' // Should NOT be in logs
    }));

    const events: any[] = [];
    sender.on('event', (event) => events.push(event));
    receiver.on('event', (event) => events.push(event));

    const completedPromise = new Promise<void>((resolve, reject) => {
      sender.on('completed', resolve);
      sender.on('failed', reject);
      setTimeout(() => reject(new Error('Timeout')), 5000);
    });

    await sender.startTransfer(sensitivePayload, 'security_test');
    await completedPromise;

    await new Promise(resolve => setTimeout(resolve, 100));

    // CRITICAL: Events must not contain sensitive data
    const allEventStrings = events.map(e => JSON.stringify(e));
    for (const eventStr of allEventStrings) {
      expect(eventStr).not.toContain('41.0082');
      expect(eventStr).not.toContain('28.9784');
      expect(eventStr).not.toContain('SECRET_MESSAGE');
      expect(eventStr).not.toContain('HELP_NEEDED');
      expect(eventStr).not.toContain('encryptedPayload');
    }

    // Events should contain metadata only
    expect(events.some(e => e.event === 'transfer_start')).toBe(true);
    expect(events.some(e => e.event === 'chunk_sent')).toBe(true);
    expect(events.some(e => e.msgId)).toBe(true);

    sender.close();
    receiver.close();
    channel.close();
  });
});
