import 'dotenv/config';
import express from 'express';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import pg from 'pg';

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const app = express();
app.use(express.json());

const sourceSchema = z.object({
  name: z.string().min(1),
  providerType: z.string(),
  mappedFolderId: z.string().uuid(),
  config: z.record(z.unknown()).default({})
});

const createNodeSchema = z.object({
  name: z.string().min(1),
  kind: z.enum(['FILE', 'DIRECTORY']),
  parentId: z.string().uuid().nullable().optional(),
  remotePath: z.string().optional(),
  realLocation: z.string().optional(),
  cachePath: z.string().optional(),
  archivePath: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
  tier: z.enum(['PRIMARY', 'HOT_CACHE', 'ARCHIVED', 'EVICTED']).optional(),
  sizeBytes: z.number().int().nonnegative().optional(),
  checksum: z.string().optional(),
  modifiedAt: z.string().datetime().optional()
});

app.post('/api/v1/sources', (req, res) => {
  const parsed = sourceSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  return res.status(202).json({
    jobId: randomUUID(),
    status: 'QUEUED',
    message: 'Source accepted for asynchronous validation and synchronization'
  });
});

app.post('/api/v1/nodes', async (req, res) => {
  const parsed = createNodeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const parentId = parsed.data.parentId ?? null;

    if (parentId === null) {
      const countResult = await client.query<{ count: string }>('SELECT COUNT(*)::text AS count FROM virtual_nodes WHERE deleted_at IS NULL');
      const count = Number(countResult.rows[0]?.count ?? '0');
      if (count > 0) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: 'Root node can only be created when virtual_nodes is empty.' });
      }
    } else {
      const parentResult = await client.query(
        `SELECT id, kind, deleted_at
         FROM virtual_nodes
         WHERE id = $1`,
        [parentId]
      );
      if (parentResult.rowCount === 0 || parentResult.rows[0].deleted_at) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Parent node not found.' });
      }
      if (parentResult.rows[0].kind !== 'DIRECTORY') {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Parent node must be a DIRECTORY.' });
      }
    }

    const insertResult = await client.query(
      `INSERT INTO virtual_nodes
        (parent_id, kind, name, remote_path, real_location, cache_path, archive_path, metadata, tier, size_bytes, checksum, modified_at)
       VALUES
        ($1, $2::node_kind, $3, $4, $5, $6, $7, COALESCE($8::jsonb, '{}'::jsonb), COALESCE($9::storage_tier, 'PRIMARY'::storage_tier), $10, $11, $12)
       RETURNING id, parent_id, source_id, kind, name, remote_path, real_location, cache_path, archive_path, metadata, tier, size_bytes, checksum, modified_at, last_accessed_at, deleted_at, created_at, updated_at`,
      [
        parentId,
        parsed.data.kind,
        parsed.data.name,
        parsed.data.remotePath ?? null,
        parsed.data.realLocation ?? null,
        parsed.data.cachePath ?? null,
        parsed.data.archivePath ?? null,
        parsed.data.metadata ? JSON.stringify(parsed.data.metadata) : null,
        parsed.data.tier ?? null,
        parsed.data.sizeBytes ?? null,
        parsed.data.checksum ?? null,
        parsed.data.modifiedAt ?? null
      ]
    );

    await client.query('COMMIT');
    return res.status(201).json(insertResult.rows[0]);
  } catch (error: unknown) {
    await client.query('ROLLBACK');
    const message = error instanceof Error ? error.message : 'Unexpected error';
    if (message.includes('duplicate key value violates unique constraint')) {
      return res.status(409).json({ error: 'A node with the same name already exists under this parent.' });
    }
    return res.status(500).json({ error: message });
  } finally {
    client.release();
  }
});

app.get('/api/v1/nodes/:id/children', async (req, res) => {
  const idValidation = z.string().uuid().safeParse(req.params.id);
  if (!idValidation.success) return res.status(400).json({ error: 'Invalid node id.' });

  try {
    const parentResult = await pool.query(
      `SELECT id, deleted_at
       FROM virtual_nodes
       WHERE id = $1`,
      [req.params.id]
    );

    if (parentResult.rowCount === 0 || parentResult.rows[0].deleted_at) {
      return res.status(404).json({ error: 'Node not found.' });
    }

    const childrenResult = await pool.query(
      `SELECT id, parent_id, source_id, kind, name, remote_path, real_location, cache_path, archive_path, metadata, tier, size_bytes, checksum, modified_at, last_accessed_at, deleted_at, created_at, updated_at
       FROM virtual_nodes
       WHERE parent_id = $1 AND deleted_at IS NULL
       ORDER BY kind DESC, name ASC`,
      [req.params.id]
    );

    return res.status(200).json(childrenResult.rows);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return res.status(500).json({ error: message });
  }
});

app.post('/api/v1/nodes/:id/share', (req, res) => {
  if (!z.string().email().safeParse(req.body?.recipientEmail).success) {
    return res.status(400).json({ error: 'recipientEmail is required' });
  }
  return res.status(202).json({ jobId: randomUUID(), status: 'QUEUED' });
});

app.get('/api/v1/shares/download/:token', (_req, res) =>
  res.status(501).json({ error: 'Connect ShareRepository and streaming provider before enabling downloads' })
);

const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => console.log(`VFS API listening on ${port}`));
