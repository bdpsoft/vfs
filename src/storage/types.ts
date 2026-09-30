export type ProviderType = 'LOCAL' | 'S3' | 'SFTP' | 'SMB_NFS' | 'GOOGLE_DRIVE' | 'SHAREPOINT';
export type ChangeType = 'CREATED' | 'UPDATED' | 'DELETED' | 'MOVED';

export interface ByteRange { start?: number; end?: number; }
export interface RemoteResourceDescriptor { path: string; isDirectory: boolean; sizeBytes?: number; modifiedAt?: Date; checksum?: string; }
export interface RemoteResourceMetadata { sizeBytes: number; modifiedAt?: Date; checksum?: string; contentType?: string; }
export interface FetchResult { bytes: number; checksum?: string; etag?: string; }
export interface UploadResult { bytes: number; checksum?: string; etag?: string; }
export interface ProviderCapabilities { supportsDeltaSync: boolean; supportsWrite: boolean; supportsDelete: boolean; supportsRangeReads: boolean; }
export interface StorageChange { type: ChangeType; path: string; previousPath?: string; metadata?: RemoteResourceMetadata; }
export interface DeltaSyncResult { changes: StorageChange[]; nextDeltaToken: string; }

export interface IStorageProvider {
  testConnection(): Promise<boolean>;
  listContents(remotePath: string): Promise<RemoteResourceDescriptor[]>;
  fetchFile(remotePath: string, targetLocalCachePath: string): Promise<FetchResult>;
  uploadFile(localCachePath: string, remotePath: string): Promise<UploadResult>;
  getMetadata(remotePath: string): Promise<RemoteResourceMetadata>;
  deleteFile?(remotePath: string): Promise<boolean>;
  getReadStream(remotePath: string, range?: ByteRange): Promise<NodeJS.ReadableStream>;
  getCapabilities(): ProviderCapabilities;
  getChanges?(deltaToken?: string): Promise<DeltaSyncResult>;
}
