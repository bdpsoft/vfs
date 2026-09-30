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

## Workers

`src/workers/shareLinkWorker.ts` and `src/workers/sourceSyncWorker.ts` contain provider-agnostic workflow services. Attach them to BullMQ, Celery-compatible infrastructure, or another durable queue in deployment code.

## Security

Only token hashes and credential references belong in the database. Provider credentials should be supplied through a secret manager. Local provider path resolution rejects traversal outside its configured root.
