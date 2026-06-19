import { redirect } from "next/navigation";

// /org-matching was renamed to /clients in Phase 3.
export default function OrgMatchingRedirect() {
  redirect("/clients");
}
