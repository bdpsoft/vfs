import { GetObjectCommand, HeadObjectCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { createReadStream } from 'node:fs';
import type { IStorageProvider, RemoteResourceDescriptor, RemoteResourceMetadata, FetchResult, UploadResult, ByteRange, ProviderCapabilities } from './types.js';

export interface S3Config { bucket: string; prefix?: string; endpoint?: string; region: string; accessKeyId: string; secretAccessKey: string; }
export class S3StoragePlugin implements IStorageProvider {
  private readonly client: S3Client;
  constructor(private readonly config: S3Config) { this.client = new S3Client({ region: config.region, endpoint: config.endpoint, credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey } }); }
  private key(p: string) { return `${this.config.prefix ?? ''}${p.replace(/^\//, '')}`; }
  async testConnection() { await this.client.send(new ListObjectsV2Command({ Bucket: this.config.bucket, MaxKeys: 1, Prefix: this.config.prefix })); return true; }
  async listContents(remotePath: string): Promise<RemoteResourceDescriptor[]> { const r = await this.client.send(new ListObjectsV2Command({ Bucket: this.config.bucket, Prefix: this.key(remotePath) })); return (r.Contents ?? []).map(o => ({ path: o.Key ?? '', isDirectory: false, sizeBytes: o.Size, modifiedAt: o.LastModified, checksum: o.ETag })); }
  async fetchFile(remotePath: string, target: string): Promise<FetchResult> { const r = await this.client.send(new GetObjectCommand({ Bucket: this.config.bucket, Key: this.key(remotePath) })); const body = r.Body as any; await new Promise<void>((resolve, reject) => { const out = createReadStream(target); body.pipe(out).on('finish', resolve).on('error', reject); }); return { bytes: Number(r.ContentLength ?? 0), etag: r.ETag }; }
  async uploadFile(local: string, remotePath: string): Promise<UploadResult> { const up = new Upload({ client: this.client, params: { Bucket: this.config.bucket, Key: this.key(remotePath), Body: createReadStream(local) } }); const r = await up.done(); return { bytes: 0, etag: r.ETag }; }
  async getMetadata(remotePath: string): Promise<RemoteResourceMetadata> { const r = await this.client.send(new HeadObjectCommand({ Bucket: this.config.bucket, Key: this.key(remotePath) })); return { sizeBytes: r.ContentLength ?? 0, modifiedAt: r.LastModified, checksum: r.ETag, contentType: r.ContentType }; }
  async getReadStream(remotePath: string, range?: ByteRange) { const r = await this.client.send(new GetObjectCommand({ Bucket: this.config.bucket, Key: this.key(remotePath), Range: range?.start !== undefined ? `bytes=${range.start}-${range.end ?? ''}` : undefined })); return r.Body as NodeJS.ReadableStream; }
  getCapabilities(): ProviderCapabilities { return { supportsDeltaSync: false, supportsWrite: true, supportsDelete: false, supportsRangeReads: true }; }
}
