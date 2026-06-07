"use client";

import { useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { CheckCircle2, Circle, ChevronRight, Copy, ExternalLink, Key } from "lucide-react";

const STEPS = [
  {
    id: 1,
    title: "Register App in Azure Portal",
    description: "Create an App Registration in Microsoft Entra ID for Lake Evendim.",
    content: (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground leading-relaxed">
          Sign in to the <strong className="text-foreground">Azure Portal</strong> and navigate to{" "}
          <strong className="text-foreground">Microsoft Entra ID → App registrations → New registration</strong>.
        </p>
        <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-2">
          <Field label="Name" value="Lake Evendim" />
          <Field label="Supported account types" value="Accounts in this organizational directory only" />
          <Field label="Redirect URI (Web)" value={`${typeof window !== "undefined" ? window.location.origin : "https://your-domain.com"}/api/auth/callback/microsoft-entra-id`} copyable />
        </div>
        <a href="https://portal.azure.com" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-sm text-primary hover:underline">
          Open Azure Portal <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>
    ),
  },
  {
    id: 2,
    title: "Configure API Permissions",
    description: "Grant the required Microsoft Graph permissions for user and group data.",
    content: (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">In your App Registration, go to <strong className="text-foreground">API permissions → Add a permission → Microsoft Graph → Delegated permissions</strong> and add:</p>
        <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-1.5">
          {["openid", "profile", "email", "User.Read", "GroupMember.Read.All"].map((perm) => (
            <div key={perm} className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <code className="text-xs font-mono text-foreground">{perm}</code>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">Click <strong className="text-foreground">Grant admin consent</strong> after adding all permissions.</p>
      </div>
    ),
  },
  {
    id: 3,
    title: "Create Client Secret",
    description: "Generate a client secret for server-to-server authentication.",
    content: (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">Navigate to <strong className="text-foreground">Certificates &amp; secrets → New client secret</strong>.</p>
        <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-2">
          <Field label="Description" value="Lake Evendim Production" />
          <Field label="Expiry" value="24 months (recommended)" />
        </div>
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
          <p className="text-xs text-amber-400 font-medium">Copy the secret value immediately</p>
          <p className="text-xs text-muted-foreground mt-1">Azure will not show it again after you navigate away.</p>
        </div>
      </div>
    ),
  },
  {
    id: 4,
    title: "Configure Environment Variables",
    description: "Add your Tenant ID, Client ID, and Client Secret to your environment.",
    content: (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">Add the following to your <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">.env</code> file:</p>
        <div className="rounded-lg border border-border bg-muted/20 p-4">
          <pre className="text-xs font-mono text-foreground whitespace-pre-wrap leading-relaxed">{`AUTH_MICROSOFT_ENTRA_ID_ID="<your-client-id>"
AUTH_MICROSOFT_ENTRA_ID_SECRET="<your-client-secret>"
AUTH_MICROSOFT_ENTRA_ID_TENANT_ID="<your-tenant-id>"`}</pre>
        </div>
        <p className="text-xs text-muted-foreground">Find your Tenant ID and Client ID on the app's <strong className="text-foreground">Overview</strong> page in Azure Portal.</p>
      </div>
    ),
  },
  {
    id: 5,
    title: "Test SSO Login",
    description: "Verify the configuration by signing in with a Microsoft account.",
    content: (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">Restart the server, then navigate to the login page and click <strong className="text-foreground">Continue with Microsoft</strong>.</p>
        <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-2">
          <CheckItem text="You are redirected to Microsoft login" />
          <CheckItem text="You are returned to the platform after authenticating" />
          <CheckItem text="Your name and email appear in the top right" />
          <CheckItem text="The Audit Log shows a user.login event" />
        </div>
        <div className="flex items-center gap-2 pt-2">
          <a href="/login" className="flex items-center gap-1.5 h-8 px-4 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors">
            <Key className="w-3.5 h-3.5" /> Test Login
          </a>
        </div>
      </div>
    ),
  },
];

function Field({ label, value, copyable }: { label: string; value: string; copyable?: boolean }) {
  return (
    <div className="flex items-start gap-3">
      <span className="text-xs text-muted-foreground w-40 shrink-0">{label}</span>
      <div className="flex items-center gap-1.5 min-w-0">
        <code className="text-xs font-mono text-foreground break-all">{value}</code>
        {copyable && (
          <button className="w-5 h-5 flex items-center justify-center rounded text-muted-foreground hover:text-foreground shrink-0">
            <Copy className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  );
}

function CheckItem({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-4 h-4 rounded border border-border flex items-center justify-center" />
      <span className="text-xs text-foreground">{text}</span>
    </div>
  );
}

export default function SSOSetupPage() {
  const [activeStep, setActiveStep] = useState(1);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);

  function markComplete(stepId: number) {
    if (!completedSteps.includes(stepId)) {
      setCompletedSteps((s) => [...s, stepId]);
    }
    if (stepId < STEPS.length) setActiveStep(stepId + 1);
  }

  return (
    <div className="flex flex-col h-full">
      <PageHeader title="SSO Setup" subtitle="Microsoft Entra ID configuration and onboarding wizard" />

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Steps nav */}
          <div className="lg:col-span-1">
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              {STEPS.map((step, i) => {
                const isCompleted = completedSteps.includes(step.id);
                const isActive = activeStep === step.id;
                return (
                  <button
                    key={step.id}
                    onClick={() => setActiveStep(step.id)}
                    className={`w-full text-left flex items-start gap-3 px-4 py-3.5 transition-colors border-b border-border/60 last:border-0 ${isActive ? "bg-primary/10" : "hover:bg-muted/20"}`}
                  >
                    <div className={`w-6 h-6 rounded-full border flex items-center justify-center shrink-0 mt-0.5 ${isCompleted ? "bg-emerald-500 border-emerald-500" : isActive ? "border-primary bg-primary/10" : "border-border"}`}>
                      {isCompleted
                        ? <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                        : <span className={`text-[10px] font-bold ${isActive ? "text-primary" : "text-muted-foreground"}`}>{i + 1}</span>
                      }
                    </div>
                    <div className="min-w-0">
                      <p className={`text-xs font-semibold ${isActive ? "text-primary" : isCompleted ? "text-emerald-400" : "text-foreground"}`}>{step.title}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed line-clamp-2">{step.description}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Step content */}
          <div className="lg:col-span-2">
            {STEPS.filter((s) => s.id === activeStep).map((step) => (
              <div key={step.id} className="rounded-xl border border-border bg-card p-6 space-y-5">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-semibold text-muted-foreground">Step {step.id} of {STEPS.length}</span>
                    {completedSteps.includes(step.id) && (
                      <span className="text-[10px] text-emerald-400 font-semibold bg-emerald-500/10 border border-emerald-500/20 rounded-full px-1.5 py-0.5">Completed</span>
                    )}
                  </div>
                  <h2 className="text-base font-semibold text-foreground">{step.title}</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">{step.description}</p>
                </div>

                <div className="border-t border-border" />

                {step.content}

                <div className="border-t border-border pt-4 flex items-center justify-between">
                  {activeStep > 1 && (
                    <button
                      onClick={() => setActiveStep((s) => s - 1)}
                      className="text-xs text-muted-foreground hover:text-foreground"
                    >
                      ← Back
                    </button>
                  )}
                  <div className="ml-auto">
                    <button
                      onClick={() => markComplete(step.id)}
                      className="flex items-center gap-1.5 h-8 px-4 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors"
                    >
                      {step.id === STEPS.length ? "Finish Setup" : "Mark Complete"} <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
