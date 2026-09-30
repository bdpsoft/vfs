import type { IStorageProvider } from '../storage/types.js';
import { createShareToken, hashShareToken } from '../security/tokens.js';

export interface ShareRepository { loadRequest(id: string): Promise<{ id: string; nodeId: string; remotePath: string; recipientEmail: string; expiresAt: Date }>; markReady(id: string, tokenHash: string): Promise<void>; markFailed(id: string, error: string): Promise<void>; }
export interface CacheService { isCached(nodeId: string): Promise<boolean>; hydrate(nodeId: string, provider: IStorageProvider, remotePath: string): Promise<void>; }
export interface Mailer { sendShare(email: string, url: string, expiresAt: Date): Promise<void>; }
export async function processShareJob(id: string, deps: { shares: ShareRepository; cache: CacheService; provider: IStorageProvider; mailer: Mailer; publicBaseUrl: string }) {
  try { const req = await deps.shares.loadRequest(id); if (!(await deps.cache.isCached(req.nodeId))) await deps.cache.hydrate(req.nodeId, deps.provider, req.remotePath); const raw = createShareToken(); await deps.shares.markReady(req.id, hashShareToken(raw)); await deps.mailer.sendShare(req.recipientEmail, `${deps.publicBaseUrl}/api/v1/shares/download/${raw}`, req.expiresAt); } catch (e) { await deps.shares.markFailed(id, e instanceof Error ? e.message : String(e)); throw e; }
}
