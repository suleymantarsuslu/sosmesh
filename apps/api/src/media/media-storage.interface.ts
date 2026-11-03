/**
 * MediaStorage interface - abstraction for attachment storage
 * Work Package A - AI Foundation
 * 
 * Local disk implementation for P0; S3/object storage can be swapped later.
 */

export type StoreMediaRequest = {
  buffer: Buffer;
  mimeType: string;
  sha256?: string;
};

export type StoreMediaResult = {
  storageKey: string;
  sizeBytes: number;
  sha256: string;
};

export type MediaMetadata = {
  storageKey: string;
  sizeBytes: number;
  mimeType: string;
  exists: boolean;
};

export interface MediaStorage {
  /**
   * Store a media file and return its storage key
   */
  store(request: StoreMediaRequest): Promise<StoreMediaResult>;

  /**
   * Retrieve a media file by storage key
   */
  retrieve(storageKey: string): Promise<Buffer | null>;

  /**
   * Check if a media file exists
   */
  exists(storageKey: string): Promise<boolean>;

  /**
   * Get metadata for a media file
   */
  getMetadata(storageKey: string): Promise<MediaMetadata | null>;

  /**
   * Delete a media file (for retention/cleanup)
   */
  delete(storageKey: string): Promise<void>;

  /**
   * List expired attachments for cleanup
   */
  listExpired(beforeDate: Date): Promise<string[]>;
}

export const MEDIA_STORAGE = 'MEDIA_STORAGE';
