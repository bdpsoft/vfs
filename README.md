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

## Workers

`src/workers/shareLinkWorker.ts` and `src/workers/sourceSyncWorker.ts` contain provider-agnostic workflow services. Attach them to BullMQ, Celery-compatible infrastructure, or another durable queue in deployment code.

## Security

Only token hashes and credential references belong in the database. Provider credentials should be supplied through a secret manager. Local provider path resolution rejects traversal outside its configured root.
