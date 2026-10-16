import 'server-only';
import { createClient, type User } from '@supabase/supabase-js';
import { createHmac, timingSafeEqual } from 'node:crypto';

export type PayMongoMode = 'test' | 'live';

export function getPayMongoConfig() {
  const mode = (process.env.PAYMONGO_MODE || 'test').toLowerCase();
  if (mode !== 'test' && mode !== 'live') {
    throw new Error('PAYMONGO_MODE must be test or live.');
  }

  const secretKey = process.env.PAYMONGO_SECRET_KEY || '';
  const expectedPrefix = mode === 'test' ? 'sk_test_' : 'sk_live_';
  if (!secretKey.startsWith(expectedPrefix)) {
    throw new Error(`PayMongo is configured for ${mode} mode, but PAYMONGO_SECRET_KEY does not match.`);
  }

  return { mode: mode as PayMongoMode, secretKey };
}

export function getSupabaseAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!url || !serviceRoleKey) {
    throw new Error('Missing server-side Supabase configuration.');
  }

  return createClient(url, serviceRoleKey, {
    db: { schema: 'FLT' },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

export async function authenticateSupabaseUser(request: Request): Promise<User | null> {
  const authorization = request.headers.get('authorization') || '';
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    '';
  if (!url || !anonKey) throw new Error('Missing Supabase public configuration.');

  const authClient = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data, error } = await authClient.auth.getUser(match[1]);
  if (error || !data.user) return null;
  return data.user;
}

export function payMongoBasicAuthorization(secretKey: string) {
  return `Basic ${Buffer.from(`${secretKey}:`).toString('base64')}`;
}

export function verifyPayMongoSignature(
  rawBody: string,
  signatureHeader: string | null,
  webhookSecret: string,
  mode: PayMongoMode
): boolean {
  if (!signatureHeader || !webhookSecret) return false;

  const parts: Record<string, string> = {};
  for (const part of signatureHeader.split(',')) {
    const separator = part.indexOf('=');
    if (separator > 0) {
      parts[part.slice(0, separator).trim()] = part.slice(separator + 1).trim();
    }
  }

  const timestamp = parts.t;
  const receivedSignature = mode === 'test' ? parts.te : parts.li;
  if (!timestamp || !receivedSignature || !/^\d+$/.test(timestamp)) return false;

  const timestampSeconds = Number(timestamp);
  if (!Number.isSafeInteger(timestampSeconds) || Math.abs(Date.now() / 1000 - timestampSeconds) > 300) {
    return false;
  }

  const expected = createHmac('sha256', webhookSecret)
    .update(`${timestamp}.${rawBody}`, 'utf8')
    .digest('hex');

  const receivedBuffer = Buffer.from(receivedSignature, 'hex');
  const expectedBuffer = Buffer.from(expected, 'hex');
  if (receivedBuffer.length !== expectedBuffer.length || receivedBuffer.length === 0) return false;
  return timingSafeEqual(receivedBuffer, expectedBuffer);
}

export function getAppBaseUrl(request: Request) {
  const configured = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || '';
  const requestOrigin = new URL(request.url).origin;
  // Always return test-mode Preview payments to the same preview deployment.
  let candidate = requestOrigin;
  if (process.env.VERCEL_ENV !== 'preview' && configured && !configured.includes('MY_APP_URL')) {
    try {
      const configuredUrl = new URL(configured);
      if (configuredUrl.protocol === 'https:' || configuredUrl.hostname === 'localhost' || configuredUrl.hostname === '127.0.0.1') {
        candidate = configuredUrl.origin;
      }
    } catch {
      // Use the current deployment origin when an optional URL is unset or malformed.
    }
  }
  const url = new URL(candidate);
  if (url.protocol !== 'https:' && url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') {
    throw new Error('APP_URL must use HTTPS outside localhost.');
  }
  return url.origin;
}
