# Changelog

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
