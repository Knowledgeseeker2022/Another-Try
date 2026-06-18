// Module augmentation for the scoped-RBAC session-revocation token version.
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface User {
    /** Snapshot of User.tokenVersion at sign-in; bumped to revoke sessions. */
    tokenVersion?: number;
  }
  interface Session {
    user: { id: string } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    tokenVersion?: number;
  }
}
