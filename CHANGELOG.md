# Changelog

All notable changes to Lake Evendim are recorded here, newest first. One plain-language
line per change. Dates are `YYYY-MM-DD`.

## 2026-06-19 — Phase 5: Services — mandatory encryption + automated scheduled polling

1. **`ENCRYPTION_KEY` is now mandatory — no plaintext fallback.** `encryptConfig()` and `encryptString()` throw immediately if `ENCRYPTION_KEY` is missing; there is no silent plaintext path. Generate the key with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` and add it to `.env.local`. The `encryptionAvailable()` helper is deleted — callers cannot opt out.
2. **Worker refuses to run with unencrypted credentials.** If a service's `config` is not an encrypted string (e.g., stored before `ENCRYPTION_KEY` was set), the sync job throws and surfaces an `ERROR` status rather than using plaintext. Re-enter credentials via the UI to re-encrypt.
3. **`config` field stripped from all API responses.** `GET /api/services` and `GET /api/services/[slug]` never return the encrypted blob — presence is indicated by `hasCredentials: boolean`. The encrypted ciphertext was harmless without the key but confusing in payloads.
4. **SSO reveal-secret endpoint deleted.** The `OPTIONS /api/sso/tenants/[id]` handler that returned the decrypted `clientSecret` is removed entirely. Credentials are write-only: to change a secret, re-enter it. No decryption-over-HTTP oracle.
5. **Repeatable polling scheduler via BullMQ `upsertJobScheduler`.** On worker startup, all `CONNECTED` + `POLLING` services register a repeatable scheduler (idempotent on restart). `PATCH /api/services/[slug]` refreshes the scheduler when credentials are saved. Disconnect removes the scheduler so no ghost-fires occur.
6. **Single concurrency lock per service: Redis `SET NX EX`.** Each sync acquires `lock:sync:{slug}` before doing any work. An overlapping scheduled fire or manual trigger skips immediately (logged as `service.sync.skipped`) — no double-ingestion, no upsert races. Lock TTL is 10 minutes; expires automatically on process crash.
7. **Incremental watermark, advances only on full success.** Connectors receive `effectiveFrom = lastSyncAt - 5min` (5-minute overlap for idempotent re-fetch). On failure, `lastSyncAt` is not updated — next run re-fetches from the same watermark, so records modified mid-window are never dropped. HaloPSA uses `date_modified_gte`; Todyl uses `updated_after`; M365 does full pull (no incremental filter for Graph users).
8. **Scheduled jobs swallow errors; manual jobs retry with backoff.** `triggeredBy: "scheduler"` jobs do not re-throw — the scheduler re-fires at the next interval. Manual-trigger jobs re-throw so BullMQ retries with exponential backoff (3 attempts, 5s base delay).
9. **Consecutive-failure escalation.** `Service.consecutiveFailures` counter increments on every failed sync, resets to 0 on success. At threshold 3, the worker writes `service.sync.escalated` to the audit log and emits a `console.error`. The UI shows an amber "N consecutive failures — manual check required" banner on the card and a page-level escalation alert.
10. **`nextSyncAt` computed and stored after each successful sync.** Displayed in the service card as "Next: X minutes" so the polling schedule is visible without opening the worker logs.
11. **Latest sync run summary inline on each service card.** Status (success/error), record counts, duration, and triggered-by (Scheduled / Manual) are shown without a separate page load. The `GET /api/services` list response now includes the most-recent `ServiceSyncLog` row.
12. Migration `20260619100000_phase5_service_hardening`: adds `Service.consecutiveFailures Int DEFAULT 0` and `ServiceSyncLog.triggeredBy Text`.

## 2026-06-19 — Phase 4: Client Groups — rule-based membership + controlled segments

1. **`OrgGroupMode` enum added (`MANUAL` | `RULE_BASED`).** Each group now declares its membership mode. Existing groups default to `MANUAL` — no data migration needed.
2. **Rule-based group membership computed on read, never persisted.** `OrgGroupMember` rows are MANUAL-only. Rule-based membership is a live query at read time (Prisma `findMany` where `segment = ruleValue`), which can never drift regardless of which code path writes `segment`. Eliminates an entire class of sync bug.
3. **One mode per group, strictly enforced.** Manual additions to a RULE_BASED group return `400`. A client may belong to multiple groups of any mode. No ambiguity on what "remove" means.
4. **`OrgGroup.criteria Json?` dropped.** The field was stored but never evaluated. Replaced by typed `ruleAttribute String?` + `ruleValue String?` columns — directly queryable, validated server-side, plain-language display derived deterministically.
5. **`segment` field is now a controlled list.** Ten values enforced at the API boundary: Financial, Federal, Healthcare, Legal, Technology, Education, Nonprofit, Manufacturing, Professional Services, Retail. Defined once in `src/lib/client-segments.ts`; both the client profile dropdown and the group-rule picker read from the same export. Typo variants cannot fragment groups.
6. **`src/lib/group-rules.ts` — rule evaluation library.** Exports `evaluateRule`, `getRuleGroupMembers`, `getRuleGroupMemberCount`, and `getClientGroups`. `getClientGroups` returns manual + rule-based groups for a client in a single call.
7. **Client profile and list API (`/api/clients`, `/api/clients/[id]`) include rule-based group memberships.** `allGroups` field on every org response carries both MANUAL and RULE_BASED memberships with a `membershipType` discriminator. Segment PATCH validates against the controlled list.
8. **New `/api/client-groups` route family.** `GET|POST /api/client-groups`, `GET|PATCH|DELETE /api/client-groups/[id]`, `GET|POST|DELETE /api/client-groups/[id]/members`. RULE_BASED groups return live `memberCount` from a COUNT query. Audit-logged: create, update, delete, member add/remove.
9. **`/client-groups` page** — colored card grid with mode badge (amber "Rule-based" / gray "Manual"), plain-language rule summary ("Segment is Financial"), create/edit modal with mode toggle and segment dropdown, live member count. Member count on RULE_BASED cards is computed on each page load.
10. **`/org-groups` redirects to `/client-groups`** — matching the Phase 3 `/org-matching` → `/clients` pattern. Sidebar link updated to point to `/client-groups`.
11. **Groups page (`/groups`) uses `/api/client-groups`** for org-group ref data in the grants editor.

## 2026-06-19 — Phase 3: Clients + canonical identity + match engine

1. **"Organizations" category renamed to "Clients" throughout the UI.** Sidebar, page headers, and all copy now say "Clients" and "Client Groups." Schema model names (`Organization`, `OrgMapping`, etc.) are unchanged — a wide migration for zero runtime gain. `/org-matching` redirects permanently to the new `/clients` route.
2. **Layered deterministic matching engine** (`src/lib/org-matcher.ts`). Three matchers run in priority order: (1) verified Entra tenant ID from `SsoTenant` (confidence 100 → auto-link), (2) verified domain from `SsoTenant.domains` (confidence 90 → auto-link), (3) normalized name after stripping legal suffixes (confidence 70 → review queue). Below 65: leave unmatched. AI-assisted fuzzy matching can later feed the same review queue.
3. **`Organization.domain String?` widened to `domains String[]`.** Supports multi-domain clients and is used as a matching signal by the engine.
4. **`Organization.segment String?` added.** Stores the client's segment ("Financial", "Federal Contractors", "Health", etc.) for Phase 4 org-group auto-assignment.
5. **New `OrgMatchSuggestion` model and review queue.** The engine enqueues middle-band matches (confidence 65–89) for one-click human review. `@@unique([serviceSlug, externalId])` guarantees one live suggestion per external entity. `REJECTED` suppresses re-suggestion forever.
6. **Confirming a suggestion triggers immediate backfill — not "on next sync."** Confirm and backfill run in a single Postgres transaction (`db.$transaction`, 30 s timeout): OrgMapping is created, suggestion transitions to CONFIRMED, and all existing `Ticket` / `SecurityEvent` / `CloudUser` records belonging to that external entity have `orgId` stamped atomically. Fails fully or succeeds fully.
7. **`orgMappingId String?` added to `Ticket`, `SecurityEvent`, `CloudUser`.** Tracks which OrgMapping set each record's `orgId`. Connector upserts never touch this column; only backfill writes it. Enables precise split reversal.
8. **Split/reject reversal.** `DELETE /api/clients/[id]/mappings/[mappingId]` deletes the mapping, nulls out `orgId` + `orgMappingId` on exactly the backfilled records (no other mappings' records touched), and upserts a `REJECTED` suggestion so the pair is never re-suggested. Runs in the same transaction.
9. **New `OrgDomainAuth` model.** Four rows per client (`IDENTITY`, `VULNERABILITY`, `COMPLIANCE`, `OPERATIONS`), each with status `UNKNOWN` (awaiting authorization) / `AUTHORIZED` / `NOT_AUTHORIZED`. `UNKNOWN` is visually and logically distinct from a pass or fail, and will be excluded from Phase 4 health scoring. Rows seeded in migration for all existing orgs; created lazily for new orgs.
10. **M365 connector now uses the matching engine.** Replaced the single `Organization.domain` string lookup with `resolveOrgMapping()` keyed on Entra `tenantId`, producing a proper `OrgMapping` with `matcherKey` and `wasAutoLinked`.
11. **Todyl connector now uses the matching engine.** Per-alert `tenant_id` resolution replaces the direct `OrgMapping` lookup; new tenants generate suggestions instead of silently dropping `orgId`.
12. **HaloPSA stays as source-of-truth.** Its `OrgMapping` upserts now stamp `matcherKey: "halopsa_source"` and `wasAutoLinked: false`.
13. **`OrgMapping` gets `matcherKey` and `wasAutoLinked`.** `wasAutoLinked: true` flags engine-created auto-links so the UI can surface a split button.
14. **New Clients UI** (`/clients`). Shows all canonical clients with: segment badge, domain list, mapping count, domain auth summary (N/4 authorized), and a pending-suggestions badge. Review queue at top for one-click confirm/reject. Client profile drawer: editable fields, per-domain auth grid (click to cycle status), service mappings with split button for auto-links.
15. **New API surface** (all require `orgs:read` or `orgs:write`): `GET|POST /api/clients`, `GET|PATCH|DELETE /api/clients/[id]`, `GET /api/clients/[id]/domain-auth`, `PATCH /api/clients/[id]/domain-auth/[domain]`, `DELETE /api/clients/[id]/mappings/[mappingId]`, `GET /api/match-suggestions`, `POST /api/match-suggestions/[id]/confirm`, `POST /api/match-suggestions/[id]/reject`.
16. Audit-logged all confirm, reject, split, domain-auth, and client CRUD operations.

All notable changes to Lake Evendim are recorded here, newest first. One plain-language
line per change. Dates are `YYYY-MM-DD`.

## 2026-06-18 — Phase 2: real, enforced, multi-tenant SSO

1. **Fixed the headline defect: SSO config now controls login.** Previously `SsoConfig` was written by the Admin UI but never read by `auth.ts` — all SSO behaviour came from static env vars only. `auth.ts` now queries `SsoTenant` at every Entra sign-in to validate the tenant, check domains, and enforce group mappings. Env vars still carry the shared QCT app credentials; the DB drives everything else.
2. **Replaced the single-tenant `SsoConfig` model with multi-tenant `SsoTenant`.** One row per Entra tenant (QCT plus any number of client tenants). `tenantId` (the Entra `tid` JWT claim) is the verified trust anchor — `NOT NULL UNIQUE`. Email domain is a secondary check only. Per-tenant `clientId`/`clientSecret` fields are nullable escape hatches; by default all tenants use the shared QCT Entra app credentials from env vars.
3. **Added `SsoGroupMapping`: Entra group → Lake Evendim Group.** Maps an Entra group object ID (immutable trust anchor) to a Lake Evendim `Group`, which carries `GroupRole` grants via the Phase 1 RBAC system. Removing a mapping removes access on the user's next login. No new permission system — SSO plugs directly into Phase 1's `resolveGrants()` path.
4. **Default-deny enforced.** An authenticated SSO user whose Entra groups match no mapping gets `false` from `signIn` and never receives a session. No fallback role, no default dashboard access.
5. **Group overage detection.** When Entra emits a `_claim_names.groups` overage indicator (>200 groups), auth.ts automatically falls back to a Microsoft Graph `GET /me/memberOf` call using the delegated access token. No silent data loss on large tenants.
6. **SSO-provisioned group memberships written to DB.** On each successful Entra sign-in, `UserGroup` rows with `ssoProvisioned: true` are synced: stale mappings removed, current ones added. Manually-assigned memberships (`ssoProvisioned: false`) are never touched. Removing a group mapping drops access on next login, consistent with Phase 1 `tokenVersion` revocation behaviour.
7. **Login form now hides the Microsoft button when SSO is unavailable.** A new public `/api/sso/status` endpoint returns `{ ssoEnabled }` based on live DB state and env-var presence. The button only appears when both conditions are met — no more click-into-guaranteed-failure path.
8. **Admin consent URL generated per tenant.** The SSO UI computes and surfaces the tenant-specific admin consent URL (`login.microsoftonline.com/{tenantId}/adminconsent?...`) for client onboarding.
9. **`clientSecret` now encrypted.** SSO tenant secrets are encrypted with AES-256-GCM via `crypto.ts` when `ENCRYPTION_KEY` is set (matching the service-credentials pattern). Added `encryptString`/`decryptString` helpers to `crypto.ts`.
10. **`sso` added as a permission resource** (`read/write/delete/admin`). Super Admin and Operations Manager receive full SSO permissions. Added to the catalog, all six roles reconciled.
11. **Adopted Prisma migration for Phase 2.** Migration `20260618200000_phase2_sso_tenant` renames `SsoConfig` → `SsoTenant`, hardens `tenantId` to `NOT NULL UNIQUE`, creates `SsoGroupMapping`, adds `ssoProvisioned`/`ssoTenantId` to `UserGroup`. Any existing `SsoConfig` row with a null `tenantId` is deleted (it cannot be a valid trust anchor).
12. Audit-logged all SSO tenant create/update/delete and group mapping create/delete operations.
13. `src/middleware.ts` updated: `/api/sso/status` is now a public path (called unauthenticated by the login form).

## 2026-06-18 — Phase 1: complete, scoped access model (Users / Roles / Groups)

1. **RBAC is now actually enforced.** Previously every admin API only checked "are you logged in" — any signed-in user could do anything. Added a `can()` / `requirePermission()` authorization layer (`src/lib/authz.ts`) and wired it into the users, roles, groups, and permissions APIs (resource × action).
2. **Added scope to role grants.** A grant is now `(user or group) → role → optional scope`: an optional app (null = Admin-wide) and an optional client-organization subset (all clients, or specific orgs / org-groups). Grants with no scope are global, so every existing assignment keeps working unchanged.
3. This is the model future dashboards plug into: a new dashboard is a new app scope value, never a new permission system. `accessibleOrgIds()` answers "which clients can this user see" for dashboard data filtering.
4. **Roles can now have their permissions edited.** Added `PATCH /api/roles` and a permission-matrix UI (resource × action grid) on the Roles page. Previously roles could be created but their permissions could never be set from the app.
5. **Groups are now fully manageable.** Added group editing, member management, and scoped role attachment (`/api/groups/[id]`) plus a Groups edit UI. Previously groups could only be created/deleted and membership/roles were unreachable from the app.
6. **Users get scoped role grants** in the invite/edit UI (role · app scope · client scope), replacing the flat role checkboxes.
7. **Reconciled the seeded roles.** Renamed Admin → Operations Manager and Support → Technician; added Compliance Lead and Client Executive (client-scoped, read-only); kept Super Admin and Read-Only. Previously only Super Admin had any permissions — Admin/Support/Read-Only were empty shells; now every role gets a real least-privilege permission set.
8. **Least privilege by default:** a newly created user has no access until a grant is added.
9. **Fixed the session-revocation security gap.** Deactivating or deleting a user now ends their active session immediately. Added `User.tokenVersion`; the JWT callback re-validates `isActive` + token version on every request, and deactivation bumps the version. (Previously a JWT stayed valid up to ~30 days after deactivation/deletion.)
10. **Aligned password hashing cost** for user creation to bcrypt factor 12 (was 10), matching the seed and SECURITY.md.
11. Audit-logged every role, permission, group, and grant change (`role.created/updated/deleted`, `group.created/updated/deleted`, `user.created/updated/deleted` now record the grants).
12. **Adopted Prisma migrations.** The repo previously used `db push` with no migration history; baselined the existing schema (`0_init`) and added `20260618165654_phase1_scoped_rbac`. The Phase 1 migration backfills the one existing grant as a global grant (no data loss).

## 2026-06-18 — Naming alignment (rename only, no behavior change)

1. Renamed the leftover placeholder product name **"Bedrock"** to **"Lake Evendim"** everywhere it described this product. Lake Evendim is now the single name for both the control plane and its data lake.
2. Updated the browser/page meta description (`src/app/layout.tsx`) from "Bedrock data lake admin control plane…" to "Lake Evendim data lake admin control plane…".
3. Updated the login screen subtitle (`src/app/(auth)/login/login-form.tsx`): removed the duplicate brand — the line under the "Lake Evendim" heading now reads just "Admin Control Plane" instead of "Bedrock Admin Control Plane".
4. Updated the Apps page copy (`src/app/(platform)/apps/page.tsx`): subtitle, empty-state text, and the Register-App dialog now say apps consume/access "Lake Evendim data" instead of "Bedrock data".
5. Updated the Services connect dialog (`src/app/(platform)/services/services-client.tsx`) to say credentials begin "syncing data into Lake Evendim" instead of "into Bedrock".
6. Updated the User Guide (`src/app/(platform)/user-guide/page.tsx`): the "What is Lake Evendim?" overview, the "How it fits into…" heading, the Org Matching description, and the API Keys description now reference Lake Evendim instead of Bedrock.
7. Editorial fix while renaming (to avoid a circular sentence): two User Guide lines that read "Lake Evendim is the admin control plane for your Bedrock data lake" now read "…for your data lake" (dropping the redundant brand rather than producing "Lake Evendim … for your Lake Evendim data lake"). Flagged here in case you prefer different wording.
8. No source/config/docs occurrences of "Bedrock" remain. The only leftovers are inside `.next/` build artifacts (webpack cache + one compiled page), which are generated output and will clear on the next `npm run build` — they were not hand-edited.
9. Added this `CHANGELOG.md`.
10. Added `SECURITY.md` documenting the current security model and known gaps.
