# VFS & Smart Storage Orchestrator

Initial TypeScript scaffold for a database-first virtual filesystem with pluggable storage providers, asynchronous workflow boundaries, time-limited sharing, and delta/full synchronization.

## Setup

```bash
npm install
cp .env.example .env
npm run build
```

Apply `db/migrations/001_init.sql` to PostgreSQL, then connect the repositories and queue adapter used by your deployment. The HTTP layer intentionally keeps persistence and queue integration behind interfaces.

## API scaffold

- `POST /api/v1/sources` validates and accepts a source definition, returning `202` with a job ID.
- `POST /api/v1/nodes` creates a virtual node as root (if tree empty) or under an existing parent, and always returns created node.
- `GET /api/v1/nodes/:id/children` returns all non-deleted direct children of a virtual node.
- `POST /api/v1/nodes/:id/share` accepts an asynchronous share request and returns `202` with a job ID.
- `GET /api/v1/shares/download/:token` is the download boundary; production deployments must connect token lookup, authorization, cache hydration, and streaming repositories.

### Example JSON for S3 source (`POST /api/v1/sources`)

```json
{
  "name": "company-archive-2026",
  "providerType": "S3",
  "mappedFolderId": "11111111-2222-3333-4444-555555555555",
  "config": {
    "bucket": "company-archive",
    "prefix": "2026/",
    "region": "us-east-1",
    "endpoint": "https://s3.amazonaws.com",
    "accessKeyId": "${S3_ACCESS_KEY_ID}",
    "secretAccessKey": "${S3_SECRET_ACCESS_KEY}"
  }
}
```

`mappedFolderId` must be the UUID of an existing virtual folder node in `virtual_nodes`.

## Google Drive storage provider (`GDRIVE`)

Install the Google APIs client before using the Google Drive provider:

```bash
npm install googleapis
```

Set the Google Drive folder and credentials paths in your environment. The token path is optional:

```bash
export GDRIVE_FOLDER_ID="your-google-drive-folder-id"
export GDRIVE_CREDENTIALS_PATH="./secrets/google-credentials.json"
export GDRIVE_TOKEN_PATH="./secrets/google-token.json"
```

Create a provider using the environment-based configuration:

```ts
import { StoragePluginFactory } from './src/storage/pluginFactory.js';

const factory = new StoragePluginFactory();
const provider = factory.create('GDRIVE', {});
```

Alternatively, provide the configuration explicitly:

```ts
import { StoragePluginFactory } from './src/storage/pluginFactory.js';

const factory = new StoragePluginFactory();
const provider = factory.create('GDRIVE', {
  folderId: 'your-google-drive-folder-id',
  credentialsPath: './secrets/google-credentials.json',
  tokenPath: './secrets/google-token.json',
});
```

Use the provider to store, retrieve, check, and delete files:

```ts
await provider.put('hello.txt', Buffer.from('Hello Google Drive'));
const contents = await provider.get('hello.txt');
const exists = await provider.exists('hello.txt');
await provider.delete('hello.txt');
```

### cURL example

```bash
curl -X POST http://localhost:3000/api/v1/sources \
  -H "Content-Type: application/json" \
  -d '{
    "name": "company-archive-2026",
    "providerType": "S3",
    "mappedFolderId": "11111111-2222-3333-4444-555555555555",
    "config": {
      "bucket": "company-archive",
      "prefix": "2026/",
      "region": "us-east-1",
      "endpoint": "https://s3.amazonaws.com",
      "accessKeyId": "${S3_ACCESS_KEY_ID}",
      "secretAccessKey": "${S3_SECRET_ACCESS_KEY}"
    }
  }'
```

### Example JSON for creating a **root** virtual node (`POST /api/v1/nodes`)

> Root creation is allowed only when `virtual_nodes` has no active rows.

```json
{
  "name": "Arhiva",
  "kind": "DIRECTORY",
  "parentId": null,
  "metadata": {
    "label": "Top level root"
  }
}
```

### Example JSON for creating a child node on an existing node (`POST /api/v1/nodes`)

```json
{
  "name": "2026",
  "kind": "DIRECTORY",
  "parentId": "11111111-2222-3333-4444-555555555555",
  "metadata": {
    "department": "finance"
  }
}
```

### cURL for node creation

```bash
curl -X POST http://localhost:3000/api/v1/nodes \
  -H "Content-Type: application/json" \
  -d '{
    "name": "2026",
    "kind": "DIRECTORY",
    "parentId": "11111111-2222-3333-4444-555555555555"
  }'
```

### cURL for getting children

```bash
curl http://localhost:3000/api/v1/nodes/11111111-2222-3333-4444-555555555555/children
```

## Workers

`src/workers/shareLinkWorker.ts` and `src/workers/sourceSyncWorker.ts` contain provider-agnostic workflow services. Attach them to BullMQ, Celery-compatible infrastructure, or another durable queue in deployment code.

## Security

Only token hashes and credential references belong in the database. Provider credentials should be supplied through a secret manager. Local provider path resolution rejects traversal outside its configured root.
