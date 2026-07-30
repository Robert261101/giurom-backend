import { createHmac, timingSafeEqual } from 'crypto';

export interface RestosoftLinkPayload {
  v: 1;
  company_id: number;
  location_id: number;
}

export function canonicalLinkPayload(payload: RestosoftLinkPayload): string {
  return JSON.stringify({
    v: 1,
    company_id: payload.company_id,
    location_id: payload.location_id,
  });
}

function base64UrlEncode(buf: Buffer | string): string {
  const b = typeof buf === 'string' ? Buffer.from(buf, 'utf8') : buf;
  return b
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function base64UrlDecode(s: string): Buffer {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + pad;
  return Buffer.from(b64, 'base64');
}

function signPayload(canonical: string, secret: string): string {
  return createHmac('sha256', secret).update(canonical, 'utf8').digest('hex').slice(0, 32);
}

export function encodeRestosoftLinkCode(
  payload: RestosoftLinkPayload,
  secret: string,
): string {
  const canonical = canonicalLinkPayload(payload);
  const body = base64UrlEncode(canonical);
  const sig = signPayload(canonical, secret);
  return `rs2.${body}.${sig}`;
}

export function decodeRestosoftLinkCode(
  code: string,
  secret: string,
): RestosoftLinkPayload {
  const trimmed = code.trim();
  const parts = trimmed.split('.');
  if (parts.length !== 3 || parts[0] !== 'rs2') {
    throw new Error('Format cod invalid');
  }
  const [, body, sig] = parts;
  if (!body || !sig || !/^[0-9a-f]{32}$/i.test(sig)) {
    throw new Error('Format cod invalid');
  }
  let canonical: string;
  try {
    canonical = base64UrlDecode(body).toString('utf8');
  } catch {
    throw new Error('Format cod invalid');
  }
  const expected = signPayload(canonical, secret);
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(sig.toLowerCase(), 'utf8');
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new Error('Semnătură cod invalidă');
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(canonical);
  } catch {
    throw new Error('Payload cod invalid');
  }
  const obj = parsed as Partial<RestosoftLinkPayload>;
  if (
    obj?.v !== 1 ||
    typeof obj.company_id !== 'number' ||
    typeof obj.location_id !== 'number' ||
    !Number.isFinite(obj.company_id) ||
    !Number.isFinite(obj.location_id)
  ) {
    throw new Error('Payload cod invalid');
  }
  return {
    v: 1,
    company_id: obj.company_id,
    location_id: obj.location_id,
  };
}
