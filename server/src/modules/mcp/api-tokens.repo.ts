// Repository wrapping the `api_tokens` table (db/schema/api-tokens.ts) — personal bearer tokens
// for MCP clients. Every function is scoped by `userId` except resolveApiToken, which is the one
// function in this codebase (alongside telegram.repo.ts's getUserIdByChatId) that mints a UserId
// from an untrusted external string — see its own comment below.
import { randomBytes, createHash } from "node:crypto";
import { and, eq, isNull, or, gt } from "drizzle-orm";
import db from "../../db/client.js";
import { apiTokens } from "../../db/schema/index.js";
import type { UserId } from "../../db/user-id.js";

// An explicit column list, NOT `db.select()` (select-star) — `apiTokens` also carries
// `tokenHash`, which must never reach an API response (same "never leak the secret column"
// discipline as vacancies.repo.ts's VACANCY_COLUMNS excluding the embedding column).
const TOKEN_COLUMNS = {
  id: apiTokens.id,
  label: apiTokens.label,
  scope: apiTokens.scope,
  createdAt: apiTokens.createdAt,
  lastUsedAt: apiTokens.lastUsedAt,
  expiresAt: apiTokens.expiresAt,
  revokedAt: apiTokens.revokedAt,
};

export interface ApiTokenSummary {
  id: number;
  label: string;
  scope: string;
  createdAt: Date;
  lastUsedAt: Date | null;
  expiresAt: Date | null;
  revokedAt: Date | null;
}

function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export interface NewApiToken {
  label: string;
  scope: "read" | "read_write";
  expiresAt?: Date;
}

export async function createApiToken(userId: UserId, input: NewApiToken): Promise<{ id: number; rawToken: string }> {
  const rawToken = `jt_${randomBytes(32).toString("base64url")}`;
  const [row] = await db
    .insert(apiTokens)
    .values({ userId, tokenHash: hashToken(rawToken), label: input.label, scope: input.scope, expiresAt: input.expiresAt })
    .returning({ id: apiTokens.id });
  return { id: row!.id, rawToken };
}

export async function listApiTokens(userId: UserId): Promise<ApiTokenSummary[]> {
  return db
    .select(TOKEN_COLUMNS)
    .from(apiTokens)
    .where(and(eq(apiTokens.userId, userId), isNull(apiTokens.revokedAt)));
}

export async function revokeApiToken(userId: UserId, id: number): Promise<void> {
  await db
    .update(apiTokens)
    .set({ revokedAt: new Date() })
    .where(and(eq(apiTokens.userId, userId), eq(apiTokens.id, id)));
}

export interface ResolvedApiToken {
  userId: UserId;
  scope: "read" | "read_write";
  tokenId: number;
}

/** The only function that mints a UserId from an untrusted external string — mirrors
 * telegram.repo.ts's getUserIdByChatId resolver pattern. Called on every MCP request
 * (mcp.routes.ts's bearer-auth verifier), so it also opportunistically bumps `lastUsedAt`
 * fire-and-forget — never awaited, so a slow/failed bookkeeping write never adds latency to an
 * otherwise-valid request. */
export async function resolveApiToken(rawToken: string): Promise<ResolvedApiToken | null> {
  const [row] = await db
    .select()
    .from(apiTokens)
    .where(
      and(
        eq(apiTokens.tokenHash, hashToken(rawToken)),
        isNull(apiTokens.revokedAt),
        or(isNull(apiTokens.expiresAt), gt(apiTokens.expiresAt, new Date())),
      ),
    );
  if (!row) return null;
  void db.update(apiTokens).set({ lastUsedAt: new Date() }).where(eq(apiTokens.id, row.id));
  return { userId: row.userId as UserId, scope: row.scope as "read" | "read_write", tokenId: row.id };
}
