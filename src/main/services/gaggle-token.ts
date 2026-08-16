export type ParsedGaggleToken = {
  token: string;
  userId: string;
  expiresAt?: string;
};

type JwtPayload = {
  user_id?: unknown;
  sub?: unknown;
  exp?: unknown;
  iss?: unknown;
};

const decodeBase64Url = (value: string): string => {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padding = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));
  return Buffer.from(normalized + padding, 'base64').toString('utf8');
};

export const normalizeBearerToken = (value: string): string =>
  value.trim().replace(/^Bearer\s+/i, '').trim();

export const parseGaggleToken = (value: string): ParsedGaggleToken => {
  const token = normalizeBearerToken(value);
  const parts = token.split('.');
  if (parts.length !== 3 || !parts.every(Boolean)) {
    throw new Error('Token 不是有效的 JWT');
  }

  let payload: JwtPayload;
  try {
    payload = JSON.parse(decodeBase64Url(parts[1])) as JwtPayload;
  } catch {
    throw new Error('无法解析 Token');
  }

  const userId = typeof payload.user_id === 'string'
    ? payload.user_id
    : typeof payload.sub === 'string'
      ? payload.sub
      : '';
  if (!userId) {
    throw new Error('Token 中没有用户 ID');
  }

  if (
    typeof payload.iss === 'string' &&
    !payload.iss.startsWith('https://securetoken.google.com/')
  ) {
    throw new Error('Token 不是 Gaggle 使用的 Firebase Token');
  }

  const expiresAt = typeof payload.exp === 'number' && Number.isFinite(payload.exp)
    ? new Date(payload.exp * 1000).toISOString()
    : undefined;

  return { token, userId, expiresAt };
};

export const isGaggleTokenExpired = (
  token: Pick<ParsedGaggleToken, 'expiresAt'>,
  skewMilliseconds = 30_000
): boolean => {
  if (!token.expiresAt) return false;
  return Date.parse(token.expiresAt) <= Date.now() + skewMilliseconds;
};
