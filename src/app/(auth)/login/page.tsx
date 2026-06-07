import { Suspense } from "react";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="flex flex-col gap-8"><div className="h-32 animate-pulse rounded-xl bg-card border border-border" /></div>}>
      <LoginForm />
    </Suspense>
  );
}
