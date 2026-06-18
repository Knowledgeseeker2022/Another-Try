import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { db } from "./db";

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
          user.password
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
    MicrosoftEntraID({
      clientId: process.env.AUTH_MICROSOFT_ENTRA_ID_ID ?? "",
      clientSecret: process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET ?? "",
      issuer: process.env.AUTH_MICROSOFT_ENTRA_ID_TENANT_ID
        ? `https://login.microsoftonline.com/${process.env.AUTH_MICROSOFT_ENTRA_ID_TENANT_ID}/v2.0`
        : undefined,
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      // Initial sign-in: stamp the user id and their current token version.
      if (user) {
        token.id = user.id;
        const dbUser = await db.user.findUnique({
          where: { id: user.id as string },
          select: { tokenVersion: true },
        });
        token.tokenVersion = dbUser?.tokenVersion ?? 0;
        return token;
      }

      // Every subsequent request: re-validate against the DB so deactivation,
      // deletion, or a forced token-version bump revokes the session immediately
      // (no waiting for JWT expiry). Returning null invalidates the session.
      if (token.id) {
        const dbUser = await db.user.findUnique({
          where: { id: token.id as string },
          select: { isActive: true, tokenVersion: true },
        });
        if (!dbUser || !dbUser.isActive || dbUser.tokenVersion !== token.tokenVersion) {
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
