# Lake Evendim — Platform State & Infrastructure

> **Snapshot date:** 2026-06-18
> **Repo package:** `lake-evendim` v0.1.0 (private)
> **Type:** MSP "Data Lake" control plane — a Next.js full-stack app that aggregates data from MSP tooling (M365, PSA, RMM, security, backup, billing) into a unified store with RBAC, SSO, API keys, and downstream data APIs.

---

## 1. High-Level Architecture

```
                    ┌─────────────────────────────────────────────┐
                    │            Next.js 15 (App Router)           │
   Browser ────────▶│   - Server Components + Client Components    │
   (SSO / creds)    │   - /api route handlers (REST)              │
                    │   - middleware.ts (auth gate)               │
                    └───────────┬──────────────────┬──────────────┘
                                │                  │
                    ┌───────────▼────────┐  ┌──────▼───────────┐
                    │   PostgreSQL        │  │   Redis           │
                    │   (Prisma ORM)      │  │  - cache (getCached)
                    │   primary store     │  │  - BullMQ broker  │
                    └─────────────────────┘  └──────┬───────────┘
                                                     │
                                       ┌─────────────▼──────────────┐
                                       │  Sync Worker (separate proc)│
                                       │  `npm run worker`           │
                                       │  BullMQ "service-sync" queue│
                                       │  → Connectors (M365/Halo/   │
                                       │    Todyl) → write to DB     │
                                       └─────────────┬──────────────┘
                                                     │ outbound API calls
                          ┌──────────────────────────▼───────────────────────┐
                          │  External MSP services (Graph API, HaloPSA, etc.) │
                          └───────────────────────────────────────────────────┘

   Downstream dashboards ──Bearer le_live_…──▶ /api/data/* (API-key authed)
   External services ──HMAC webhook──▶ /api/webhooks/{slug} ──▶ queue sync
```

**Two runtime processes:**
1. **Web app** — `next dev` / `next start` (serves UI + API routes).
2. **Sync worker** — `npm run worker` (`tsx src/worker/sync.ts`), a standalone BullMQ consumer. The web app only *enqueues* jobs; the worker executes connector syncs.

---

## 2. Technology Stack

| Layer | Technology | Version | Notes |
|---|---|---|---|
| Runtime | Node.js | v20.20.2 (local) | |
| Framework | Next.js | 15.3.3 | App Router, `devIndicators: false` |
| UI library | React | 19.0.0 | |
| Language | TypeScript | ^5 | |
| ORM | Prisma | 6.3.0 | `@prisma/client` + CLI |
| Database | PostgreSQL | — | `provider = "postgresql"` |
| Cache / Broker | Redis | — | via `ioredis` 5.4.2 |
| Job queue | BullMQ | 5.78.0 | "service-sync" queue, bundles own ioredis |
| Auth | Auth.js (NextAuth) | 5.0.0-beta.25 | JWT sessions, Prisma adapter |
| Passwords | bcryptjs | 2.4.3 | cost factor 12 (seed) |
| MFA | otplib + qrcode | 12.0.1 / 1.5.4 | TOTP (scaffolded; see §9 caveat) |
| Styling | Tailwind CSS | 3.4.1 | + tailwindcss-animate, tailwind-merge, CVA |
| UI primitives | Radix UI | various | accordion, dialog, dropdown, select, tabs, toast, etc. |
| Icons | lucide-react | 0.468.0 | |
| Charts | recharts | 2.15.0 | |
| Markdown | react-markdown + remark-gfm | 9.0.3 / 4.0.0 | for guide pages |
| Toasts | sonner | 1.7.4 | |
| Tooling | tsx, ESLint 9, Playwright 1.60 | | `playwright` present but no test files found |

---

## 3. Application Structure (`src/`)

### Route groups (App Router)
- **`(auth)`** — unauthenticated shell: `/login` (credentials + Entra SSO form).
- **`(platform)`** — authenticated shell (sidebar + header). Pages:
  - **Platform:** `dashboard`, `settings`
  - **Identity:** `users`, `roles`, `groups`, `sso`
  - **Integrations:** `services`, `api-keys`, `apps`
  - **Organizations:** `org-matching`, `org-groups`
  - **Security:** `audit-log`
  - **Documentation:** `user-guide`, `admin-guide`, `sso-setup`

### API route handlers (`src/app/api/`)
- **Auth:** `auth/[...nextauth]` (Auth.js handlers)
- **Admin/CRUD (session-authed):** `users`, `users/[id]`, `roles`, `groups`, `services`, `services/[slug]`, `orgs`, `orgs/[id]`, `org-groups`, `api-keys`, `apps`, `sso`, `settings`, `audit`
- **Downstream data APIs (API-key authed):** `data/cloud-users`, `data/security-events`, `data/tickets` — paginated, scope-gated read endpoints for external dashboards.
- **Webhooks:** `webhooks/[slug]` — inbound HMAC-verified event receivers that enqueue a sync.
- **Health:** `health` — checks DB (`SELECT 1`) + Redis (`ping`); returns `ok`/`degraded`, 200/503.

### Core libraries (`src/lib/`)
| File | Responsibility |
|---|---|
| `db.ts` | Prisma singleton (global in dev) |
| `redis.ts` | ioredis singleton + `getCached()` (TTL 300s default) + `invalidateCache()` |
| `queue.ts` | BullMQ `syncQueue` + `queueSync(slug, userId)`; 3 attempts, exponential backoff |
| `auth.ts` | Auth.js config: Credentials + MicrosoftEntraID providers, JWT strategy |
| `api-auth.ts` | `authenticateRequest()` — Bearer `le_live_` API key (SHA-256 lookup) OR session; `hasScope()` |
| `crypto.ts` | AES-256-GCM encrypt/decrypt for service credentials (`ENCRYPTION_KEY`, 64-hex) |
| `service-config.ts` | Static catalog of 11 service definitions (credential fields, poll intervals) |
| `utils.ts` | `cn()` class merge helper |

### Connectors (`src/connectors/`)
- `base.ts` — `Connector` interface (`slug`, `sync(config, db)`), pagination helpers (`graphPages`, `haloPSAPages`).
- **Implemented:** `m365.ts` (Microsoft Graph → `CloudUser`), `halopsa.ts` (→ `Ticket`), `todyl.ts` (→ `SecurityEvent`).
- Registered in the worker via a `connectorMap` keyed by slug.

---

## 4. Data Model (Prisma — PostgreSQL)

**Auth/Identity:** `User`, `Account`, `Session`, `VerificationToken` (Auth.js), `Role`, `Permission`, `RolePermission`, `Group`, `UserRole`, `UserGroup`, `GroupRole` — full **RBAC with role-and-group-based permissions**.

**Integrations:** `Service` (status, `syncMode` POLLING/WEBHOOK, encrypted `config`, poll interval), `ServiceSyncLog` (per-run audit: records in/out, duration, error).

**Organizations:** `Organization`, `OrgMapping` (links org → external system IDs with match confidence), `OrgGroup`, `OrgGroupMember`.

**Platform:** `SsoConfig` (Entra ID), `ApiKey` (SHA-256 `keyHash`, `keyPrefix`, scopes, status), `App` (registered downstream apps), `Setting` (key/JSON), `AuditLog` (indexed by createdAt/userId/action/resource).

**Synced data lake records** (all keyed `@@unique([serviceSlug, externalId])`, soft-linked to org):
- `Ticket` — from HaloPSA (PSA)
- `SecurityEvent` — from Todyl (security/SASE)
- `CloudUser` — from Microsoft 365 (identity/licensing)

**Enums:** `ServiceStatus`, `SyncMode`, `OrgStatus`, `ApiKeyStatus`, `AppStatus`.

---

## 5. Service Integration Catalog

`service-config.ts` defines **11 services** (UI/credential metadata); only **3 have working connectors**.

| Slug | Name | Category | Auth | Poll (min) | Connector? |
|---|---|---|---|---|---|
| `microsoft-365` | Microsoft 365 | Identity/Licensing | oauth2 | 15 | ✅ |
| `halopsa` | HaloPSA | PSA | oauth2 | 15 | ✅ |
| `todyl` | Todyl | Security/SASE | api-key | 15 | ✅ |
| `ninjarmm` | NinjaRMM | RMM | oauth2 | 10 | ❌ catalog only |
| `threatlocker` | ThreatLocker | Security | api-key | 15 | ❌ |
| `quickbooks` | QuickBooks | Accounting | oauth2 | 60 | ❌ |
| `pax8` | Pax8 | Licensing/Distribution | oauth2 | 30 | ❌ |
| `datto` | Datto BCDR | Backup/BDR | basic | 15 | ❌ |
| `auvik` | Auvik | Network Mgmt | basic | 15 | ❌ |
| `pulseway` | Pulseway | RMM/PSA | api-key | 10 | ❌ |
| `cove` | Cove Data Protection | Backup/Cloud | basic | 30 | ❌ |

---

## 6. Authentication & Authorization

- **End-user auth (UI):** Auth.js with **JWT session strategy**.
  - **Credentials provider:** email + bcrypt password, gated on `isActive`; updates `lastLoginAt`. MFA branch throws `MFA_REQUIRED` when enabled without a code.
  - **Microsoft Entra ID provider:** issuer derived from `AUTH_MICROSOFT_ENTRA_ID_TENANT_ID`.
  - Prisma adapter wired (note: adapter + JWT strategy is a deliberate combo; DB `Session` rows are largely unused with JWT).
- **Route protection:** `src/middleware.ts` redirects unauthenticated users to `/login`. Public prefixes: `/login`, `/api/auth`, `/api/data`, `/api/webhooks`, `/api/health`.
- **Machine auth (data APIs):** `Bearer le_live_<key>` → SHA-256 hash lookup against `ApiKey.keyHash`, checks `ACTIVE` + not expired, async-updates `lastUsedAt`. Scope enforcement via `hasScope()` (`*` = wildcard; session auth = full access).
- **Webhook auth:** per-service HMAC-SHA256 (`timingSafeEqual`) using `metadata.webhookSecret`; rejects log to `AuditLog`.
- **RBAC seed:** resources × actions (read/write/delete/admin) permissions; system roles **Super Admin, Admin, Support, Read-Only**. Default user `admin@evendim.local` / `Admin1234!` (dev seed — must be rotated).

---

## 7. Background Processing & Sync

- **Queue:** BullMQ `service-sync` on Redis. Job options: 3 attempts, exponential backoff (5s base), keep last 100 completed / 200 failed.
- **Triggers:** manual (UI → `queueSync`) or webhook receipt (`/api/webhooks/{slug}` enqueues a full sync).
- **Worker (`src/worker/sync.ts`):** concurrency 3. Per job: loads `Service`, decrypts `config` (AES-256-GCM, or plain JSON if no key), runs connector, writes records, writes `ServiceSyncLog`, flips `Service.status` to `CONNECTED`/`ERROR`, and writes `AuditLog`. Graceful shutdown on SIGTERM/SIGINT.
- **Sync modes:** `POLLING` (interval per service) and `WEBHOOK`. Note: a scheduled poller (BullMQ repeatable jobs / cron) is **not present** — `pollInterval`/`nextSyncAt` exist in schema but nothing currently auto-enqueues on a timer (see §9).

---

## 8. Configuration & Secrets

Environment variables (`.env`, all keys present locally):

| Var | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection |
| `REDIS_URL` | Redis (cache + BullMQ) |
| `AUTH_SECRET` | Auth.js JWT signing |
| `AUTH_URL` | Auth.js base URL |
| `AUTH_MICROSOFT_ENTRA_ID_ID` / `_SECRET` / `_TENANT_ID` | Entra SSO app registration |
| `ENCRYPTION_KEY` | 64-hex (32-byte) AES-256-GCM key for service creds. **If unset, creds stored as plaintext JSON (dev only).** |
| `NEXT_PUBLIC_APP_URL` / `NEXT_PUBLIC_APP_NAME` | Client-exposed app metadata |

`next.config.ts`: `serverExternalPackages: ["@prisma/client", "bcryptjs"]`, remote image patterns for `*.microsoft.com` / `*.microsoftonline.com`.

---

## 9. Operational State, Gaps & Risks

**Current state:** Active local development. Working tree shows committed `.next/` build artifacts (the `.next/` directory is tracked in git — see git status), recent commits around dashboard + mock data cleanup. No deployment/IaC/CI config found (no Dockerfile, no `docs/`, no README, no `.github/`).

**Notable gaps / things to flag:**
1. **`.next/` build output is committed to git.** This should almost certainly be in `.gitignore`; it bloats the repo and causes churn.
2. **No automated polling scheduler.** Schema models periodic sync (`pollInterval`, `nextSyncAt`) but no repeatable/cron job enqueues syncs — currently manual or webhook-driven only.
3. **MFA is scaffolded, not enforced.** `auth.ts` accepts any truthy `totpCode` ("simplified here" comment); `otplib` is a dependency but TOTP isn't actually verified in the authorize path.
4. **Default admin credentials** (`admin@evendim.local` / `Admin1234!`) are seeded — must be changed before any non-local use.
5. **Encryption optional in dev.** Without `ENCRYPTION_KEY`, third-party service credentials persist as plaintext JSON in the DB.
6. **8 of 11 catalog services have no connector** — they appear in the UI but cannot sync yet.
7. **Auth.js Prisma adapter + JWT strategy** — DB session table is effectively vestigial; intentional but worth noting for anyone reasoning about session revocation.
8. **No tests despite Playwright dependency** — no spec files were found in the tree.

---

## 10. Common Commands

```bash
npm run dev          # Next.js dev server (web + API)
npm run build        # production build
npm run start        # production server
npm run worker       # BullMQ sync worker (separate process — required for syncs)
npm run lint         # ESLint

npm run db:push      # prisma db push (schema → DB, no migration)
npm run db:migrate   # prisma migrate dev
npm run db:seed      # seed permissions, roles, default admin
npm run db:studio    # Prisma Studio
```

---

*Generated from source inspection of the repository at the snapshot date above. Connector/feature coverage reflects code actually present, not the full service catalog.*
