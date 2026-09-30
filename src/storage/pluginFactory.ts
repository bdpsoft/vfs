import type { ProviderType, IStorageProvider } from './types.js';
import { LocalStoragePlugin } from './localStoragePlugin.js';
import { S3StoragePlugin } from './s3StoragePlugin.js';

export class StoragePluginFactory {
  create(type: ProviderType, config: Record<string, unknown>): IStorageProvider {
    switch (type) {
      case 'LOCAL': return new LocalStoragePlugin(String(config.root ?? process.env.LOCAL_STORAGE_ROOT ?? './var/storage'));
      case 'S3': return new S3StoragePlugin({ bucket: String(config.bucket), prefix: config.prefix as string | undefined, endpoint: config.endpoint as string | undefined, region: String(config.region ?? 'us-east-1'), accessKeyId: String(config.accessKeyId), secretAccessKey: String(config.secretAccessKey) });
      default: throw new Error(`Provider ${type} is not implemented in this scaffold`);
    }
  }
}
