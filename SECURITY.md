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
- **Microsoft Entra ID (Azure AD) provider:** issuer derived from `AUTH_MICROSOFT_ENTRA_ID_TENANT_ID`. Configured **entirely from environment variables**.
- **Generic login failure by design:** `authorize()` returns `null` for *any* failure — wrong password and database-unreachable look identical to the user ("email or password is incorrect"). This avoids account enumeration but can mask outages.
- A Prisma adapter is wired alongside the JWT strategy. Because sessions are JWT, the DB `Session` table is largely **vestigial** — there is no easy server-side session revocation.

### Machine / API clients (data endpoints)
- Endpoints under `/api/data/*` authenticate via **`Authorization: Bearer le_live_<key>`**.
- Keys are looked up by **SHA-256 hash** of the presented key against `ApiKey.keyHash` — the plaintext key is never stored and is shown to the user **only once at creation**.
- Checks: key must be `ACTIVE` and not expired; `lastUsedAt` is updated asynchronously.
- **Scope enforcement** via `hasScope()` in `src/lib/api-auth.ts` (`*` = wildcard). A valid session is treated as full access.

### Webhooks (inbound events)
- `/api/webhooks/{slug}` verifies a per-service **HMAC-SHA256** signature using `timingSafeEqual` against `metadata.webhookSecret`. Rejected attempts are written to the audit log.

---

## 2. Authorization (RBAC)

- Full **role- and group-based access control** model: `Role`, `Permission`, `RolePermission`, `Group`, `UserRole`, `UserGroup`, `GroupRole`. Both roles **and** groups can grant permissions.
- Permissions are modeled as **resource × action** (read / write / delete / admin).
- Seeded **system roles:** Super Admin, Admin, Support, Read-Only.
- Admin CRUD API routes require a valid session; the data APIs are scope-gated by API key.

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
2. **SSO config is not wired into login.** The `SsoConfig` record (and the SSO admin page's allowed-domains, etc.) is only read/written by `/api/sso` and its UI — `auth.ts` does **not** consume it. The Entra provider is driven purely by env vars, so SSO settings configured in the UI (e.g. allowed email domains) are **not enforced at authentication time**.
3. **Default admin credentials are seeded** (`admin@evendim.local` / `Admin1234!`). Must be rotated before any non-local use.
4. **Encryption is optional in dev** — without `ENCRYPTION_KEY`, third-party service credentials persist as plaintext in the database.
5. **No server-side session revocation.** JWT sessions + a vestigial DB session table mean a compromised/issued token can't be easily invalidated before expiry.
6. **App registry grants nothing.** The `App` model is an informational registry; it is **not** linked to API-key issuance or access enforcement (`api-auth.ts` never references it).
7. **No automated tests / CI / container or IaC config** in the repo; backing services are started ad hoc. There is no security regression coverage.
8. **`.next/` build output is committed to git** — generated artifacts in version control; should be `.gitignore`d.

---

*Derived from source inspection at the snapshot date. This reflects code actually present,
not aspirational design. When any of the gaps above are closed, update this file and add a
dated line to `CHANGELOG.md`.*
