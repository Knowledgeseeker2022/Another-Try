# Changelog

All notable changes to Lake Evendim are recorded here, newest first. One plain-language
line per change. Dates are `YYYY-MM-DD`.

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
