export interface TransferStateTranslation {
  state: string;
  tr: string;
  en: string;
  description: string;
}

export const TRANSFER_STATE_TRANSLATIONS: TransferStateTranslation[] = [
  {
    state: 'IDLE',
    tr: 'Hazır',
    en: 'Ready',
    description: 'Transfer başlamadı'
  },
  {
    state: 'HELLO_SENT',
    tr: 'Bağlantı kuruluyor',
    en: 'Connecting',
    description: 'Handshake başlatıldı'
  },
  {
    state: 'SENDING',
    tr: 'Gönderiliyor',
    en: 'Sending',
    description: 'Mesaj gönderiliyor'
  },
  {
    state: 'WAIT_ACK',
    tr: 'Onay bekleniyor',
    en: 'Waiting for confirmation',
    description: 'Chunk ACK bekleniyor'
  },
  {
    state: 'PEER_RECEIVED',
    tr: 'Yakındaki cihaza ulaştı',
    en: 'Reached nearby device',
    description: 'Mesh peer tam mesajı aldı'
  },
  {
    state: 'SERVER_RECEIVED',
    tr: 'Sunucuya ulaştı',
    en: 'Reached server',
    description: 'İnternet bağlantısı üzerinden sunucuya ulaştı'
  },
  {
    state: 'OPERATOR_VIEWED',
    tr: 'Operatör gördü',
    en: 'Viewed by operator',
    description: 'Acil durum operatörü mesajı gördü'
  },
  {
    state: 'VERIFYING',
    tr: 'Doğrulanıyor',
    en: 'Verifying',
    description: 'Mesaj bütünlüğü doğrulanıyor'
  },
  {
    state: 'COMPLETED',
    tr: 'Tamamlandı',
    en: 'Completed',
    description: 'Transfer başarıyla tamamlandı'
  },
  {
    state: 'FAILED',
    tr: 'Başarısız',
    en: 'Failed',
    description: 'Transfer başarısız oldu'
  }
];

export function getTransferStateText(state: string, locale: 'tr' | 'en' = 'tr'): string {
  const translation = TRANSFER_STATE_TRANSLATIONS.find(t => t.state === state);
  if (!translation) {
    return locale === 'tr' ? 'Bilinmeyen durum' : 'Unknown state';
  }
  return translation[locale];
}

// CRITICAL: "okundu" (read) term is FORBIDDEN for PEER_RECEIVED
// PEER_RECEIVED means "reached nearby device", NOT "read by operator"
// Operator read is OPERATOR_VIEWED only
export function isReadStatus(state: string): boolean {
  return state === 'OPERATOR_VIEWED';
}

export function isPeerAck(state: string): boolean {
  return state === 'PEER_RECEIVED';
}

export function isServerAck(state: string): boolean {
  return state === 'SERVER_RECEIVED';
}
