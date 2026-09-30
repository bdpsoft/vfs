import path from 'node:path';
import { promises as fs, createReadStream } from 'node:fs';
import type { IStorageProvider, RemoteResourceDescriptor, RemoteResourceMetadata, FetchResult, UploadResult, ByteRange, ProviderCapabilities } from './types.js';

export class LocalStoragePlugin implements IStorageProvider {
  constructor(private readonly root: string) {}
  private resolve(remote: string): string {
    const resolved = path.resolve(this.root, remote.replace(/^[/\\]+/, ''));
    if (resolved !== path.resolve(this.root) && !resolved.startsWith(path.resolve(this.root) + path.sep)) throw new Error('Path escapes storage root');
    return resolved;
  }
  async testConnection() { await fs.access(this.root); return true; }
  async listContents(remotePath: string): Promise<RemoteResourceDescriptor[]> {
    const entries = await fs.readdir(this.resolve(remotePath), { withFileTypes: true });
    return Promise.all(entries.map(async e => { const p = path.join(remotePath, e.name); const s = await fs.stat(this.resolve(p)); return { path: p, isDirectory: e.isDirectory(), sizeBytes: s.size, modifiedAt: s.mtime }; }));
  }
  async fetchFile(remotePath: string, target: string): Promise<FetchResult> { await fs.copyFile(this.resolve(remotePath), target); const s = await fs.stat(target); return { bytes: s.size }; }
  async uploadFile(local: string, remotePath: string): Promise<UploadResult> { await fs.copyFile(local, this.resolve(remotePath)); const s = await fs.stat(local); return { bytes: s.size }; }
  async getMetadata(remotePath: string): Promise<RemoteResourceMetadata> { const s = await fs.stat(this.resolve(remotePath)); return { sizeBytes: s.size, modifiedAt: s.mtime }; }
  async getReadStream(remotePath: string, _range?: ByteRange) { return createReadStream(this.resolve(remotePath)); }
  getCapabilities(): ProviderCapabilities { return { supportsDeltaSync: false, supportsWrite: true, supportsDelete: true, supportsRangeReads: false }; }
}
