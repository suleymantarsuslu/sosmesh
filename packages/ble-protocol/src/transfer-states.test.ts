import { describe, it, expect } from 'vitest';

import { 
  getTransferStateText, 
  isReadStatus, 
  isPeerAck, 
  isServerAck,
  TRANSFER_STATE_TRANSLATIONS 
} from './transfer-states';

describe('Transfer State Translations (UX/a11y)', () => {
  it('should have TR and EN translations for all states', () => {
    TRANSFER_STATE_TRANSLATIONS.forEach(translation => {
      expect(translation.state).toBeTruthy();
      expect(translation.tr).toBeTruthy();
      expect(translation.en).toBeTruthy();
      expect(translation.description).toBeTruthy();
    });
  });

  it('should return correct TR text', () => {
    const text = getTransferStateText('PEER_RECEIVED', 'tr');
    expect(text).toBe('Yakındaki cihaza ulaştı');
  });

  it('should return correct EN text', () => {
    const text = getTransferStateText('PEER_RECEIVED', 'en');
    expect(text).toBe('Reached nearby device');
  });

  it('should handle unknown state gracefully', () => {
    const textTr = getTransferStateText('UNKNOWN_STATE', 'tr');
    const textEn = getTransferStateText('UNKNOWN_STATE', 'en');
    
    expect(textTr).toBe('Bilinmeyen durum');
    expect(textEn).toBe('Unknown state');
  });

  it('should default to Turkish locale', () => {
    const text = getTransferStateText('SENDING');
    expect(text).toBe('Gönderiliyor');
  });

  it('CRITICAL: PEER_RECEIVED should NOT use "okundu" (read) term', () => {
    const peerText = getTransferStateText('PEER_RECEIVED', 'tr');
    expect(peerText).not.toContain('okundu');
    expect(peerText).not.toContain('görüldü');
    expect(peerText).toContain('ulaştı');
  });

  it('CRITICAL: Only OPERATOR_VIEWED is read status', () => {
    expect(isReadStatus('PEER_RECEIVED')).toBe(false);
    expect(isReadStatus('SERVER_RECEIVED')).toBe(false);
    expect(isReadStatus('OPERATOR_VIEWED')).toBe(true);
  });

  it('should distinguish peer ACK, server ACK, and operator read', () => {
    expect(isPeerAck('PEER_RECEIVED')).toBe(true);
    expect(isPeerAck('SERVER_RECEIVED')).toBe(false);
    
    expect(isServerAck('SERVER_RECEIVED')).toBe(true);
    expect(isServerAck('PEER_RECEIVED')).toBe(false);
    
    expect(isReadStatus('OPERATOR_VIEWED')).toBe(true);
    expect(isReadStatus('PEER_RECEIVED')).toBe(false);
  });

  it('should have distinct translations for peer, server, and operator', () => {
    const peerTr = getTransferStateText('PEER_RECEIVED', 'tr');
    const serverTr = getTransferStateText('SERVER_RECEIVED', 'tr');
    const operatorTr = getTransferStateText('OPERATOR_VIEWED', 'tr');
    
    expect(peerTr).not.toBe(serverTr);
    expect(peerTr).not.toBe(operatorTr);
    expect(serverTr).not.toBe(operatorTr);
    
    // Verify terminology (case-insensitive)
    expect(peerTr.toLowerCase()).toContain('cihaz'); // device
    expect(serverTr.toLowerCase()).toContain('sunucu'); // server
    expect(operatorTr.toLowerCase()).toContain('operatör'); // operator
  });
});
