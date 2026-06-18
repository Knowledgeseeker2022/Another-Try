# Security Model — Lake Evendim

> **Snapshot date:** 2026-06-18
> Scope: this describes the security model **as it exists in the code today**, including
> known gaps. Lake Evendim is pre-refactor / prototype-stage — treat this as an honest
> baseline to harden against, not a statement of production readiness.

---

## 1. Authentication

### Human users (web UI)
- **Auth.js / NextAuth 5 (beta)** with a **JWT session strategy** (`src/lib/auth.ts`).
- **Credentials provider:** email + password. Passwords hashed with **bcrypt** (cost factor 12). Login is gated on `User.isActive`; `lastLoginAt` is updated on success.
- **Microsoft Entra ID (Azure AD) provider — multi-tenant (Phase 2):** QCT registers one Azure app with "Accounts in any organizational directory" (multi-tenant mode). The app's `clientId`/`clientSecret` live in env vars; issuer is `.../organizations/v2.0` (accepts tokens from any tenant). The `signIn` callback validates the token's `tid` claim against `SsoTenant` in the DB — tenant must be `isEnabled`, domain check is secondary, and at least one `SsoGroupMapping` must match the user's Entra groups. Default-deny: no matching mapping = no session. Group memberships are synced to `UserGroup` (`ssoProvisioned: true`) on every successful sign-in; stale SSO memberships are cleaned up. Group overage (>200 groups) falls back to Microsoft Graph API.
- **Generic login failure by design:** `authorize()` returns `null` for *any* failure — wrong password and database-unreachable look identical to the user ("email or password is incorrect"). This avoids account enumeration but can mask outages.
- A Prisma adapter is wired alongside the JWT strategy. Because sessions are JWT, the DB `Session` table is largely **vestigial**.
- **Session revocation (Phase 1):** each user has a `tokenVersion`; the JWT carries a snapshot of it and the `jwt` callback re-validates `isActive` + `tokenVersion` against the DB on every request. Deactivating or deleting a user (and any `tokenVersion` bump) **invalidates their session immediately**, no waiting for token expiry. Note: this is enforced wherever `auth()` runs (all admin APIs, server components); `middleware.ts` only checks token presence, so a revoked user may briefly see a cached page shell until the next data call, which fails.

### Machine / API clients (data endpoints)
- Endpoints under `/api/data/*` authenticate via **`Authorization: Bearer le_live_<key>`**.
- Keys are looked up by **SHA-256 hash** of the presented key against `ApiKey.keyHash` — the plaintext key is never stored and is shown to the user **only once at creation**.
- Checks: key must be `ACTIVE` and not expired; `lastUsedAt` is updated asynchronously.
- **Scope enforcement** via `hasScope()` in `src/lib/api-auth.ts` (`*` = wildcard). A valid session is treated as full access.

### Webhooks (inbound events)
- `/api/webhooks/{slug}` verifies a per-service **HMAC-SHA256** signature using `timingSafeEqual` against `metadata.webhookSecret`. Rejected attempts are written to the audit log.

---

## 2. Authorization (scoped RBAC)

- Full **role- and group-based access control** model: `Role`, `Permission`, `RolePermission`, `Group`, `UserRole`, `UserGroup`, `GroupRole`. Both roles **and** groups can grant permissions.
- Permissions are modeled as **resource × action** (read / write / delete / admin); `admin` on a resource implies read/write/delete on it.
- **Scoped grants (Phase 1):** a grant is `(user or group) → role → optional scope`. Scope = an optional **app** (`appId` null = Admin-wide / all apps) and an optional **client-organization subset** (`scopeAllOrgs`, or specific orgs / org-groups). No scope = global. This is what lets a client executive see only their org's dashboard while an internal exec sees all clients.
- **Enforcement (Phase 1):** `src/lib/authz.ts` resolves a user's effective grants (direct + via groups) and exposes `can(userId, resource, action, scope)`, `requirePermission(...)` (route guard returning 401/403), and `accessibleOrgIds(userId, appId?)` for data-row filtering. The users, roles, groups, and permissions APIs now enforce these. *Previously RBAC was modeled but not enforced — any authenticated user had full access to the admin APIs.*
- Seeded **system roles:** Super Admin (break-glass, all permissions), Operations Manager, Compliance Lead, Technician, Client Executive (client-scoped, read-only), Read-Only. Each has a real least-privilege permission set; **least privilege by default** — a new user has no access until granted.
- The data APIs (`/api/data/*`) remain scope-gated by API key (`hasScope()`); other admin routes outside Users/Roles/Groups still authorize on session presence only (to be tightened in later phases).

---

## 3. Secrets & encryption

- **Service credentials** (third-party API creds stored on `Service.config`) are encrypted with **AES-256-GCM** (`src/lib/crypto.ts`) using `ENCRYPTION_KEY` (must be 64 hex chars / 32 bytes).
- **Dev caveat:** if `ENCRYPTION_KEY` is unset, credentials are stored as **plaintext JSON**. Acceptable only for local development; must be set everywhere else.
- `AUTH_SECRET` signs JWT sessions. Entra client secret lives in `AUTH_MICROSOFT_ENTRA_ID_SECRET`.
- All secrets are environment-sourced (`.env`); see `.env.example` for the full list.

---

## 4. Route protection

- `src/middleware.ts` redirects unauthenticated users to `/login`.
- **Public (unauthenticated) prefixes:** `/login`, `/api/auth`, `/api/data` (API-key authed downstream), `/api/webhooks` (HMAC authed), `/api/health`.
- Everything else under `(platform)` and the admin `/api/*` routes requires a session.

---

## 5. Auditing

- An `AuditLog` model (indexed on `createdAt`, `userId`, `action`, `resource`) records administrative and system actions, including worker syncs and rejected webhooks.
- The Audit Log UI currently loads the most recent 50 entries and filters client-side.

---

## 6. Known gaps & risks (read before relying on any of the above)

1. **MFA is scaffolded, not enforced.** `auth.ts` accepts any truthy TOTP code (a "simplified here" placeholder); `otplib` is a dependency but TOTP is not actually verified in the authorize path.
2. ~~**SSO config is not wired into login.**~~ **RESOLVED (Phase 2)** — `auth.ts` now reads `SsoTenant` on every Entra sign-in. The `SsoConfig` model was replaced by a proper multi-tenant `SsoTenant` model. SSO settings configured in the Admin UI now directly govern who can log in.
3. **Default admin credentials are seeded** (`admin@evendim.local` / `Admin1234!`). Must be rotated before any non-local use.
4. **Encryption is optional in dev** — without `ENCRYPTION_KEY`, third-party service credentials persist as plaintext in the database.
5. ~~**No server-side session revocation.**~~ **RESOLVED (Phase 1)** — deactivation/deletion now revokes sessions immediately via per-user `tokenVersion` re-validated in the JWT callback. Residual note: enforcement happens where `auth()` runs (APIs/server components), not in edge `middleware.ts`, so a revoked user may briefly see a cached page shell before the next data call fails.
6. **App registry grants nothing.** The `App` model is an informational registry; it is **not** linked to API-key issuance or access enforcement (`api-auth.ts` never references it).
7. **No automated tests / CI / container or IaC config** in the repo; backing services are started ad hoc. There is no security regression coverage.
8. **`.next/` build output is committed to git** — generated artifacts in version control; should be `.gitignore`d.

---

*Derived from source inspection at the snapshot date. This reflects code actually present,
not aspirational design. When any of the gaps above are closed, update this file and add a
dated line to `CHANGELOG.md`.*
