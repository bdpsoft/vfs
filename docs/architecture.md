# VFS Architecture

## Components

PostgreSQL is the source of truth for the virtual tree. `virtual_nodes` stores logical hierarchy and provider coordinates; storage plugins perform physical I/O. HTTP handlers only validate requests and enqueue work. Workers perform hydration, synchronization, sharing, and lifecycle operations.

## Plugin boundary

Core code depends only on `IStorageProvider`. `StoragePluginFactory` resolves `provider_type` to an adapter. Adding SFTP, SMB/NFS, Google Drive, or SharePoint requires an adapter and registration, not changes to worker logic.

## Share workflow

```mermaid
sequenceDiagram
  participant C as Client
  participant API as API
  participant Q as Queue
  participant W as Share worker
  participant P as Provider
  participant M as Mailer
  C->>API: POST /nodes/:id/share
  API->>Q: enqueue share job
  API-->>C: 202 + jobId
  Q->>W: execute job
  W->>P: hydrate if cache miss
  W->>W: generate token and persist SHA-256 hash
  W->>M: email expiring URL
  M-->>W: accepted
```

## Synchronization workflow

```mermaid
sequenceDiagram
  participant Q as Scheduler
  participant W as Sync worker
  participant F as Plugin factory
  participant P as Provider
  participant DB as PostgreSQL
  Q->>W: source sync job
  W->>F: resolve provider
  F-->>W: IStorageProvider
  alt supports delta sync
    W->>P: getChanges(deltaToken)
    P-->>W: changes + next token
  else full scan
    W->>P: listContents()
    P-->>W: descriptors
  end
  W->>DB: upsert nodes / soft-delete / save cursor
```

## API contract

`POST /api/v1/sources` validates a source and mapped virtual folder, persists it, and returns `202 Accepted` with a synchronization job ID.

`POST /api/v1/nodes/:id/share` validates recipient and expiration, creates a pending share request, and returns `202 Accepted` with a job ID. The worker hydrates the cache, hashes a random token, and sends the email.

`GET /api/v1/shares/download/:token` must hash the presented token, compare it in constant time, enforce expiration/status/download limits, update access counters, and stream from cache or the provider. The scaffold intentionally returns `501` until a production repository and authorization layer are wired.

## Operational requirements

Use a durable queue such as BullMQ backed by Redis. Add retries with exponential backoff and a dead-letter queue. Encrypt provider configuration or store only a secret-manager reference. Add audit logs, metrics for hydration/sync latency, structured job logs, and alerting for repeated provider failures. Eviction must be policy-driven using `last_accessed_at`, tier, size, and retention rules.
