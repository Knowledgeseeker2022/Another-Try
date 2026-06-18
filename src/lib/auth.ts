import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { db } from "./db";

// ── Entra multi-tenant helpers ────────────────────────────────────────────────

interface EntraProfile {
  tid?: string;
  groups?: string[];
  _claim_names?: { groups?: string };
  [k: string]: unknown;
}

/**
 * Resolve the user's Entra group object IDs.
 * Primary source: `groups` claim in the ID token (requires Azure "Token configuration"
 * to emit group claims). When Entra detects >200 groups it replaces the claim with an
 * overage indicator — we detect that and fall back to the Graph API instead.
 */
async function getEntraGroupIds(
  accessToken: string | undefined | null,
  profile: EntraProfile,
): Promise<string[]> {
  const hasOverage = !!profile._claim_names?.groups;
  const claimGroups = profile.groups;

  if (!hasOverage && Array.isArray(claimGroups)) {
    return claimGroups as string[];
  }

  // Overage or no groups claim → call Graph API with the user's delegated token.
  if (!accessToken) return [];
  try {
    const res = await fetch(
      "https://graph.microsoft.com/v1.0/me/memberOf?$select=id,displayName&$top=999",
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (!res.ok) return [];
    const data = (await res.json()) as { value?: { id: string }[] };
    return data.value?.map((g) => g.id) ?? [];
  } catch {
    return [];
  }
}

/**
 * Sync SSO-provisioned group memberships for a user after a successful Entra sign-in.
 * - Removes stale SSO-provisioned rows for this tenant that are no longer in the mapping.
 * - Adds new SSO-provisioned rows; skips (does not overwrite) manually-assigned rows.
 */
async function syncSsoGroups(
  userId: string,
  ssoTenantId: string,
  mappedGroupIds: string[],
): Promise<void> {
  await db.userGroup.deleteMany({
    where: {
      userId,
      ssoProvisioned: true,
      ssoTenantId,
      groupId: { notIn: mappedGroupIds },
    },
  });
  if (mappedGroupIds.length > 0) {
    await db.userGroup.createMany({
      data: mappedGroupIds.map((groupId) => ({
        userId,
        groupId,
        ssoProvisioned: true,
        ssoTenantId,
      })),
      skipDuplicates: true, // preserve manually-assigned rows
    });
  }
}

// ── Auth.js configuration ─────────────────────────────────────────────────────

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(db),
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        totpCode: { label: "MFA Code", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await db.user.findUnique({
          where: { email: credentials.email as string },
        });

        if (!user || !user.password || !user.isActive) return null;

        const passwordValid = await bcrypt.compare(
          credentials.password as string,
          user.password,
        );
        if (!passwordValid) return null;

        // MFA check (if enabled, validate TOTP — simplified here)
        if (user.mfaEnabled && !credentials.totpCode) {
          throw new Error("MFA_REQUIRED");
        }

        await db.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        });

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          tokenVersion: user.tokenVersion,
        };
      },
    }),

    // Multi-tenant Entra: QCT registers ONE app with "Accounts in any organizational
    // directory" (multi-tenant). All client tenants authenticate through this single app.
    // The token's `tid` claim is the trust anchor — we look it up in SsoTenant.
    // Per-tenant clientId/clientSecret overrides are stored in SsoTenant but Auth.js
    // cannot switch provider credentials dynamically; use env vars for the shared QCT app.
    MicrosoftEntraID({
      clientId: process.env.AUTH_MICROSOFT_ENTRA_ID_ID ?? "",
      clientSecret: process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET ?? "",
      // "organizations" accepts tokens from any Azure AD tenant (multi-tenant mode).
      // Do NOT use a specific tenant ID here — that would reject all client tenant users.
      issuer: "https://login.microsoftonline.com/organizations/v2.0",
    }),
  ],

  callbacks: {
    // ── signIn: validate before the adapter creates the user ──────────────────
    async signIn({ user, account, profile }) {
      if (account?.provider !== "microsoft-entra-id") return true;

      const p = profile as EntraProfile | undefined;
      const tid = p?.tid;
      if (!tid) return false;

      // Look up the tenant config; unknown or disabled tenants are denied immediately.
      const tenant = await db.ssoTenant.findUnique({
        where: { tenantId: tid },
        select: { id: true, isEnabled: true, domains: true },
      });
      if (!tenant?.isEnabled) return false;

      // Domain check is secondary — the verified `tid` is the primary trust anchor.
      if (tenant.domains.length > 0) {
        const domain = (user.email ?? "").split("@")[1]?.toLowerCase() ?? "";
        if (!tenant.domains.includes(domain)) return false;
      }

      // Default-deny: at least one Entra group must map to a Lake Evendim group.
      const groupIds = await getEntraGroupIds(account.access_token, p ?? {});
      if (groupIds.length === 0) return false;

      const mappingCount = await db.ssoGroupMapping.count({
        where: { ssoTenantId: tenant.id, entraGroupId: { in: groupIds } },
      });
      return mappingCount > 0;
    },

    // ── jwt: stamp id/tokenVersion on initial sign-in; re-validate on every request ──
    async jwt({ token, user, account, profile }) {
      if (user) {
        // Initial sign-in (any provider): stamp user id + tokenVersion into the JWT.
        token.id = user.id;
        const dbUser = await db.user.findUnique({
          where: { id: user.id as string },
          select: { tokenVersion: true },
        });
        token.tokenVersion = dbUser?.tokenVersion ?? 0;

        // For Entra sign-ins: sync group memberships now that the user record exists
        // (adapter has created it by this point) and update lastLoginAt.
        if (account?.provider === "microsoft-entra-id") {
          const p = profile as EntraProfile | undefined;
          const tid = p?.tid;
          if (tid) {
            const tenant = await db.ssoTenant.findUnique({
              where: { tenantId: tid },
              select: { id: true },
            });
            if (tenant) {
              const groupIds = await getEntraGroupIds(account.access_token, p ?? {});
              const mappings = await db.ssoGroupMapping.findMany({
                where: { ssoTenantId: tenant.id, entraGroupId: { in: groupIds } },
                select: { groupId: true },
              });
              const mappedGroupIds = [...new Set(mappings.map((m) => m.groupId))];
              await syncSsoGroups(token.id as string, tenant.id, mappedGroupIds);
            }
          }
          await db.user.update({
            where: { id: token.id as string },
            data: { lastLoginAt: new Date() },
          });
        }

        return token;
      }

      // Every subsequent request: re-validate isActive + tokenVersion against the DB.
      // Returning null invalidates the session immediately (no waiting for JWT expiry).
      if (token.id) {
        const dbUser = await db.user.findUnique({
          where: { id: token.id as string },
          select: { isActive: true, tokenVersion: true },
        });
        if (
          !dbUser ||
          !dbUser.isActive ||
          dbUser.tokenVersion !== token.tokenVersion
        ) {
          return null;
        }
      }
      return token;
    },

    async session({ session, token }) {
      if (token?.id && session.user) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
});
