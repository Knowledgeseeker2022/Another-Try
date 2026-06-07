"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

function LakeIcon() {
  return (
    <svg viewBox="0 0 32 32" fill="none" className="w-8 h-8">
      <path d="M4 20 Q8 14 12 20 Q16 26 20 20 Q24 14 28 20" stroke="hsl(var(--primary))" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M4 16 Q8 10 12 16 Q16 22 20 16 Q24 10 28 16" stroke="hsl(var(--accent))" strokeWidth="2" strokeLinecap="round" strokeOpacity="0.7" />
      <circle cx="16" cy="9" r="3" fill="hsl(var(--primary))" fillOpacity="0.9" />
      <path d="M16 6V3M13.5 7.5L11 5M18.5 7.5L21 5" stroke="hsl(var(--primary))" strokeWidth="1.5" strokeLinecap="round" strokeOpacity="0.6" />
    </svg>
  );
}

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const callbackUrl = params.get("callbackUrl") ?? "/dashboard";

  const [form, setForm] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [ssoLoading, setSsoLoading] = useState(false);

  async function handleCredentials(e: React.FormEvent) {
    e.preventDefault();
    if (!form.email || !form.password) return;
    setLoading(true);
    try {
      const res = await signIn("credentials", {
        email: form.email,
        password: form.password,
        redirect: false,
        callbackUrl,
      });
      if (res?.error) {
        toast.error("Invalid email or password");
      } else {
        router.push(callbackUrl);
        router.refresh();
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleSSO() {
    setSsoLoading(true);
    await signIn("microsoft-entra-id", { callbackUrl });
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Logo + title */}
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-card border border-border/60 shadow-lg">
          <LakeIcon />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Lake Evendim</h1>
          <p className="text-sm text-muted-foreground mt-1">Bedrock Admin Control Plane</p>
        </div>
      </div>

      {/* Card */}
      <div className="bg-card border border-border rounded-xl p-6 shadow-xl shadow-black/20">
        {/* SSO */}
        <button
          type="button"
          onClick={handleSSO}
          disabled={ssoLoading}
          className="w-full flex items-center justify-center gap-3 h-10 px-4 rounded-lg border border-border bg-muted/30 hover:bg-muted/60 text-foreground text-sm font-medium transition-colors disabled:opacity-60"
        >
          {ssoLoading ? (
            <span className="w-4 h-4 border-2 border-foreground/30 border-t-foreground rounded-full animate-spin" />
          ) : (
            <svg viewBox="0 0 21 21" className="w-4 h-4" xmlns="http://www.w3.org/2000/svg">
              <rect x="1" y="1" width="9" height="9" fill="#f25022"/>
              <rect x="11" y="1" width="9" height="9" fill="#7fba00"/>
              <rect x="1" y="11" width="9" height="9" fill="#00a4ef"/>
              <rect x="11" y="11" width="9" height="9" fill="#ffb900"/>
            </svg>
          )}
          Continue with Microsoft
        </button>

        <div className="flex items-center gap-3 my-5">
          <div className="flex-1 h-px bg-border" />
          <span className="text-xs text-muted-foreground">or sign in with password</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        {/* Credentials form */}
        <form onSubmit={handleCredentials} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="email" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              placeholder="admin@yourcompany.com"
              className="h-10 px-3 rounded-lg bg-input border border-border text-foreground text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring transition"
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="password" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              placeholder="••••••••"
              className="h-10 px-3 rounded-lg bg-input border border-border text-foreground text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring transition"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="h-10 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {loading && (
              <span className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
            )}
            Sign In
          </button>
        </form>
      </div>

      <p className="text-center text-xs text-muted-foreground">
        Access restricted to authorized administrators only.
      </p>
    </div>
  );
}
