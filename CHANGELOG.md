# Changelog

All notable changes to Lake Evendim are recorded here, newest first. One plain-language
line per change. Dates are `YYYY-MM-DD`.

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
