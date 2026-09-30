import 'dotenv/config';
import express from 'express';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';

const app = express(); app.use(express.json());
const sourceSchema = z.object({ name: z.string().min(1), providerType: z.string(), mappedFolderId: z.string().uuid(), config: z.record(z.unknown()).default({}) });
app.post('/api/v1/sources', (req, res) => { const parsed = sourceSchema.safeParse(req.body); if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() }); return res.status(202).json({ jobId: randomUUID(), status: 'QUEUED', message: 'Source accepted for asynchronous validation and synchronization' }); });
app.post('/api/v1/nodes/:id/share', (req, res) => { if (!z.string().email().safeParse(req.body?.recipientEmail).success) return res.status(400).json({ error: 'recipientEmail is required' }); return res.status(202).json({ jobId: randomUUID(), status: 'QUEUED' }); });
app.get('/api/v1/shares/download/:token', (_req, res) => res.status(501).json({ error: 'Connect ShareRepository and streaming provider before enabling downloads' }));
const port = Number(process.env.PORT ?? 3000); app.listen(port, () => console.log(`VFS API listening on ${port}`));
