import { createHash } from "crypto";
import { auth } from "./auth";
import { db } from "./db";

export interface AuthResult {
  authenticated: boolean;
  userId?: string | null;
  apiKeyId?: string;
  scopes?: string[];
}

export async function authenticateRequest(req: Request): Promise<AuthResult> {
  // Try API key first (Bearer token)
  const authHeader = req.headers.get("authorization") ?? "";
  if (authHeader.startsWith("Bearer le_live_")) {
    const rawKey = authHeader.slice(7);
    const keyHash = createHash("sha256").update(rawKey).digest("hex");

    const apiKey = await db.apiKey.findUnique({ where: { keyHash } });
    if (!apiKey || apiKey.status !== "ACTIVE") {
      return { authenticated: false };
    }
    if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
      return { authenticated: false };
    }

    // Update last used timestamp (non-blocking)
    db.apiKey.update({ where: { id: apiKey.id }, data: { lastUsedAt: new Date() } }).catch(() => {});

    return {
      authenticated: true,
      userId: apiKey.userId,
      apiKeyId: apiKey.id,
      scopes: apiKey.scopes,
    };
  }

  // Fall back to session auth
  const session = await auth();
  if (session?.user?.id) {
    return { authenticated: true, userId: session.user.id };
  }

  return { authenticated: false };
}

export function hasScope(result: AuthResult, scope: string): boolean {
  // Session auth (no scopes) = full access
  if (!result.apiKeyId) return true;
  return (result.scopes ?? []).includes(scope) || (result.scopes ?? []).includes("*");
}
