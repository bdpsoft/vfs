CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$ BEGIN CREATE TYPE node_kind AS ENUM ('FILE','DIRECTORY'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE storage_tier AS ENUM ('PRIMARY','HOT_CACHE','ARCHIVED','EVICTED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE provider_type AS ENUM ('LOCAL','S3','SFTP','SMB_NFS','GOOGLE_DRIVE','SHAREPOINT'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE share_status AS ENUM ('PENDING','READY','EXPIRED','REVOKED','EXHAUSTED','FAILED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE job_status AS ENUM ('QUEUED','RUNNING','SUCCEEDED','FAILED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE job_type AS ENUM ('SOURCE_SYNC','SHARE_LINK','CACHE_WARMUP','CACHE_EVICTION'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS virtual_nodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id uuid REFERENCES virtual_nodes(id),
  source_id uuid,
  kind node_kind NOT NULL,
  name text NOT NULL,
  remote_path text,
  real_location text,
  cache_path text,
  archive_path text,
  metadata jsonb NOT NULL DEFAULT '{}',
  tier storage_tier NOT NULL DEFAULT 'PRIMARY',
  size_bytes bigint,
  checksum text,
  modified_at timestamptz,
  last_accessed_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (parent_id, name)
);

CREATE TABLE IF NOT EXISTS storage_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_type provider_type NOT NULL,
  name text NOT NULL,
  mapped_folder_id uuid NOT NULL REFERENCES virtual_nodes(id),
  config jsonb NOT NULL DEFAULT '{}',
  credential_ref text,
  enabled boolean NOT NULL DEFAULT true,
  writable boolean NOT NULL DEFAULT false,
  schedule text,
  last_sync_at timestamptz,
  delta_token text,
  sync_state jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE virtual_nodes ADD CONSTRAINT virtual_nodes_source_fk FOREIGN KEY (source_id) REFERENCES storage_sources(id);

CREATE TABLE IF NOT EXISTS background_jobs_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id text NOT NULL,
  type job_type NOT NULL,
  status job_status NOT NULL DEFAULT 'QUEUED',
  attempts integer NOT NULL DEFAULT 0,
  error_message text,
  result jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  finished_at timestamptz
);

CREATE TABLE IF NOT EXISTS share_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  node_id uuid NOT NULL REFERENCES virtual_nodes(id),
  job_id uuid REFERENCES background_jobs_log(id),
  recipient_email text NOT NULL,
  token_hash text NOT NULL UNIQUE,
  password_hash text,
  expires_at timestamptz NOT NULL,
  max_downloads integer,
  download_count integer NOT NULL DEFAULT 0,
  status share_status NOT NULL DEFAULT 'PENDING',
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz
);

CREATE INDEX IF NOT EXISTS virtual_nodes_parent_idx ON virtual_nodes(parent_id);
CREATE INDEX IF NOT EXISTS virtual_nodes_access_idx ON virtual_nodes(last_accessed_at);
CREATE INDEX IF NOT EXISTS virtual_nodes_source_remote_idx ON virtual_nodes(source_id, remote_path);
CREATE INDEX IF NOT EXISTS virtual_nodes_metadata_gin_idx ON virtual_nodes USING gin(metadata);
CREATE INDEX IF NOT EXISTS share_links_expiration_idx ON share_links(expires_at, status);
CREATE INDEX IF NOT EXISTS jobs_status_idx ON background_jobs_log(status, type);
