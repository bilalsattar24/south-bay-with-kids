import { createHash, timingSafeEqual } from "crypto";

/** Keys shorter than this are ignored (generate with `openssl rand -hex 32`). */
export const MIN_KEY_LENGTH = 24;

export type ApiKeyKind = "production" | "test";

type StoredKey = { digest: Buffer; kind: ApiKeyKind; keyId: string };

export type KeyConfig = { keys: StoredKey[]; ignored: number };

export type AuthResult =
  | { ok: true; keyId: string; kind: ApiKeyKind }
  | { ok: false; status: 401 | 503; code: string; message: string };

function digest(value: string): Buffer {
  return createHash("sha256").update(value, "utf8").digest();
}

/** Short, non-reversible label for a key (rate-limit bucket, logs). */
export function keyIdFor(key: string): string {
  return `key_${digest(key).toString("hex").slice(0, 12)}`;
}

function splitKeys(raw: string | undefined): string[] {
  return (raw ?? "")
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);
}

/**
 * SBWK_API_KEYS      comma-separated production keys.
 * SBWK_API_TEST_KEYS comma-separated staging/test keys. Never honored when
 *                    VERCEL_ENV=production, even if set there by mistake.
 */
export function loadKeyConfig(env: Record<string, string | undefined>): KeyConfig {
  const keys: StoredKey[] = [];
  let ignored = 0;
  const add = (raw: string | undefined, kind: ApiKeyKind) => {
    for (const key of splitKeys(raw)) {
      if (key.length < MIN_KEY_LENGTH) {
        ignored += 1;
        continue;
      }
      keys.push({ digest: digest(key), kind, keyId: keyIdFor(key) });
    }
  };
  add(env.SBWK_API_KEYS, "production");
  if (env.VERCEL_ENV !== "production") add(env.SBWK_API_TEST_KEYS, "test");
  return { keys, ignored };
}

export function extractBearerToken(header: string | null): string | null {
  if (!header) return null;
  const match = header.match(/^Bearer[ \t]+([^\s,]+)[ \t]*$/i);
  return match ? match[1] : null;
}

/**
 * Compares the presented key against every configured key using
 * fixed-length SHA-256 digests and `timingSafeEqual`, without exiting early,
 * so timing does not reveal which key (or how much of one) matched.
 */
export function authenticate(
  headers: { get(name: string): string | null },
  config: KeyConfig,
): AuthResult {
  if (config.keys.length === 0) {
    return {
      ok: false,
      status: 503,
      code: "api_not_configured",
      message: "The events API is not configured on this deployment.",
    };
  }

  const token = extractBearerToken(headers.get("authorization"));
  if (!token) {
    const hint = headers.get("x-api-key")
      ? " Send the key as `Authorization: Bearer <key>`; `X-API-Key` is not supported."
      : "";
    return {
      ok: false,
      status: 401,
      code: "unauthorized",
      message: `Missing or malformed Authorization header.${hint}`,
    };
  }

  const presented = digest(token);
  let match: StoredKey | null = null;
  for (const key of config.keys) {
    if (timingSafeEqual(presented, key.digest) && match === null) match = key;
  }
  if (!match) {
    return { ok: false, status: 401, code: "unauthorized", message: "Invalid API key." };
  }
  return { ok: true, keyId: match.keyId, kind: match.kind };
}
