import { describe, expect, it, vi } from 'vitest';
import {
  isGaggleTokenExpired,
  normalizeBearerToken,
  parseGaggleToken,
} from './gaggle-token';

const encode = (value: unknown): string =>
  Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');

const tokenFor = (payload: Record<string, unknown>): string =>
  `${encode({ alg: 'RS256', typ: 'JWT' })}.${encode(payload)}.signature`;

describe('gaggle token parsing', () => {
  it('extracts the Firebase user id and expiry without retaining a Bearer prefix', () => {
    const token = tokenFor({
      user_id: 'firebase-user-123',
      sub: 'fallback-user',
      exp: 2_000_000_000,
      iss: 'https://securetoken.google.com/gaggle-staging',
    });

    expect(parseGaggleToken(`Bearer ${token}`)).toEqual({
      token,
      userId: 'firebase-user-123',
      expiresAt: new Date(2_000_000_000 * 1000).toISOString(),
    });
  });

  it('falls back to sub and rejects unrelated issuers', () => {
    expect(parseGaggleToken(tokenFor({ sub: 'sub-user' })).userId).toBe('sub-user');
    expect(() => parseGaggleToken(tokenFor({
      sub: 'sub-user',
      iss: 'https://example.com/',
    }))).toThrow('Firebase Token');
  });

  it('normalizes pasted tokens and detects expiry with a clock skew', () => {
    expect(normalizeBearerToken('  bearer abc.def.ghi  ')).toBe('abc.def.ghi');
    vi.setSystemTime(new Date('2026-07-26T00:00:00.000Z'));
    expect(isGaggleTokenExpired({ expiresAt: '2026-07-26T00:00:20.000Z' })).toBe(true);
    expect(isGaggleTokenExpired({ expiresAt: '2026-07-26T00:02:00.000Z' })).toBe(false);
    vi.useRealTimers();
  });
});
