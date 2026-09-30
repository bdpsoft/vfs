import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
export function createShareToken(): string { return randomBytes(32).toString('base64url'); }
export function hashShareToken(token: string): string { return createHash('sha256').update(token).digest('hex'); }
export function verifyShareToken(token: string, hash: string): boolean { const actual = Buffer.from(hashShareToken(token), 'hex'); const expected = Buffer.from(hash, 'hex'); return actual.length === expected.length && timingSafeEqual(actual, expected); }
