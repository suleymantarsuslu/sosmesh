/**
 * Isolated mandatory digest reject test (ADIM 11 chaos lab).
 */
import {
  calculateCRC32,
  createMockTransportPair,
  Receiver,
  Sender,
  serializeChunk,
  SimulatedClock,
  splitIntoChunks,
  TransferState,
} from '@sosmesh/ble-protocol';
import { SeededRNG } from '@sosmesh/mesh-simulator';
import { describe, expect, it } from 'vitest';

describe('chaos_mesh_simulator_mandatory_digest_reject', () => {
  it('chaos_mandatory_digest_invalid_never_completed', async () => {
    const clock = new SimulatedClock();
    const rng = new SeededRNG(9999);
    const { senderTransport, receiverTransport, channel } = createMockTransportPair(
      {
        packetLoss: 0,
        duplicateRate: 0,
        reorderRate: 0,
        minLatency: 5,
        maxLatency: 10,
      },
      rng,
      clock
    );

    channel.setBlockDataToReceiver(true);

    const receiver = new Receiver(receiverTransport, {}, clock);
    const sender = new Sender(senderTransport, {}, clock, rng);

    let completedCount = 0;
    let failedCount = 0;
    receiver.on('completed', () => {
      completedCount += 1;
    });
    receiver.on('failed', () => {
      failedCount += 1;
    });

    const originalPayload = Buffer.from('ORIGINAL_DATA_CHAOS_LAB');
    await sender.startTransfer(originalPayload, 'digest_attack_chaos');

    await clock.advanceAsync(50);
    channel.deliverPackets();
    await clock.advanceAsync(50);
    channel.deliverPackets();
    channel.clearQueue();

    const chunks = splitIntoChunks(originalPayload, 50);
    for (let i = 0; i < chunks.length - 1; i++) {
      receiverTransport.emit('data', serializeChunk(chunks[i]));
      await clock.advanceAsync(20);
      channel.deliverPackets();
    }

    const lastChunk = chunks[chunks.length - 1];
    const corruptedPayload = Buffer.concat([
      lastChunk.payload.slice(0, -32),
      Buffer.alloc(32, 0xff),
    ]);
    const corruptedChunk = {
      header: {
        ...lastChunk.header,
        crc32: calculateCRC32(corruptedPayload),
      },
      payload: corruptedPayload,
    };
    receiverTransport.emit('data', serializeChunk(corruptedChunk));

    await clock.advanceAsync(100);
    channel.deliverPackets();
    await clock.advanceAsync(100);

    expect(completedCount).toBe(0);
    expect(failedCount).toBeGreaterThan(0);
    expect(receiver.getState()).not.toBe(TransferState.COMPLETED);
  });
});
