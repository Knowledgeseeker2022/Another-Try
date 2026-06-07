"use client";

import { useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { BookOpen, ChevronRight, ChevronDown, X } from "lucide-react";

type Block =
  | { type: "para"; text: string }
  | { type: "code"; text: string }
  | { type: "heading"; text: string }
  | { type: "list"; items: string[] };

interface Article {
  title: string;
  desc: string;
  blocks: Block[];
}

const SECTIONS: { title: string; articles: Article[] }[] = [
  {
    title: "Getting Started",
    articles: [
      {
        title: "What is Lake Evendim?",
        desc: "Overview of the platform, its role in the Bedrock data lake architecture, and how it connects to your MSP tools.",
        blocks: [
          { type: "para", text: "Lake Evendim is the admin control plane for your Bedrock data lake. It connects your MSP tools — PSA, RMM, security platforms, licensing systems, and accounting — into a single normalized data store." },
          { type: "heading", text: "What it does" },
          { type: "list", items: [
            "Pulls data from connected services (HaloPSA, M365, Todyl, NinjaRMM, etc.) on a configurable schedule or via webhooks",
            "Normalizes that data into unified records: Organizations, Tickets, Security Events, and Cloud Users",
            "Matches clients across different systems into a single Organization record",
            "Exposes all data via authenticated API endpoints for your downstream dashboards and tools",
          ]},
          { type: "heading", text: "How it fits into Bedrock" },
          { type: "para", text: "Lake Evendim is the data ingestion and normalization layer. Other dashboards (reporting, billing, security ops) query its API using API keys rather than connecting directly to each source system. This means you change credentials in one place and all downstream tools stay connected." },
        ],
      },
      {
        title: "Logging In",
        desc: "Sign in with your Microsoft account (SSO) or local credentials. MFA setup instructions included.",
        blocks: [
          { type: "heading", text: "Local Credentials" },
          { type: "para", text: "Navigate to the login page and enter your email and password. Local accounts are created by an admin from the Users page." },
          { type: "heading", text: "Microsoft SSO" },
          { type: "para", text: "If your organization has configured Microsoft Entra ID integration, click 'Sign in with Microsoft' on the login page. Your email domain must be listed in the SSO allowed domains." },
          { type: "heading", text: "Multi-Factor Authentication" },
          { type: "list", items: [
            "Enter your email and password as usual",
            "When prompted, open your authenticator app (Google Authenticator, Microsoft Authenticator, Authy)",
            "Enter the current 6-digit code — codes rotate every 30 seconds",
          ]},
          { type: "heading", text: "Forgotten Password" },
          { type: "para", text: "Contact your platform administrator to reset your password. Password self-reset is not currently available." },
        ],
      },
      {
        title: "Navigating the Platform",
        desc: "A tour of the sidebar, modules, and how information is organized.",
        blocks: [
          { type: "heading", text: "Data & Integrations" },
          { type: "list", items: [
            "Dashboard — Real-time health overview of all services and system metrics",
            "Services — Manage integrations: connect, configure, and trigger syncs",
            "Org Matching — Review and confirm how clients map across your tools",
          ]},
          { type: "heading", text: "Identity & Access" },
          { type: "list", items: [
            "Users — Manage platform users: invite, edit roles, activate/deactivate",
            "Roles — Define permission sets for different team members",
            "Groups — Organize users into groups and assign roles in bulk",
            "API Keys — Generate keys for downstream dashboard access",
            "SSO — Configure Microsoft Entra ID single sign-on",
          ]},
          { type: "heading", text: "Administration" },
          { type: "list", items: [
            "Settings — Platform-wide configuration and external data access settings",
            "Audit Log — Full activity log of every action in the system",
            "User Guide / Admin Guide — Documentation",
          ]},
        ],
      },
      {
        title: "Understanding the Dashboard",
        desc: "Reading system health indicators, alerts, and service sync status.",
        blocks: [
          { type: "heading", text: "Stat Cards (top row)" },
          { type: "list", items: [
            "Services Online — How many integrations are actively connected vs total configured",
            "Organizations — Total client organizations in the normalized database",
            "Platform Users — Admin and staff users with access to this platform",
            "Data Records — Total records ingested: tickets + security events + cloud users combined",
          ]},
          { type: "heading", text: "System Health Cards" },
          { type: "list", items: [
            "Database — Real counts of organizations, services, audit events, and data records",
            "Redis / Cache — Live connection status, memory usage, and cache hit rate",
            "System — App server version, Node.js runtime version, and process uptime",
          ]},
          { type: "heading", text: "Service Health list" },
          { type: "para", text: "All 11 services with their current status and last sync time. DISCONNECTED is normal for services you have not configured yet." },
          { type: "heading", text: "Recent Activity" },
          { type: "para", text: "The last 8 audit log entries. Shows what happened, which resource was affected, and which user triggered it. Click 'View log' for the full searchable audit trail." },
        ],
      },
    ],
  },
  {
    title: "Organizations",
    articles: [
      {
        title: "Org Matching Explained",
        desc: "How Bedrock maps clients across HaloPSA, NinjaRMM, Pax8, and other systems into a single normalized record.",
        blocks: [
          { type: "para", text: "Every MSP tool has its own client list. HaloPSA calls them 'clients,' NinjaRMM calls them 'customers,' Pax8 calls them 'companies.' The same real-world client exists in 4-5 systems with slightly different names." },
          { type: "heading", text: "The problem it solves" },
          { type: "para", text: "Without org matching, you cannot answer 'show me all open tickets AND security alerts AND license counts for Acme Corp' because Acme Corp exists as different records in different systems." },
          { type: "heading", text: "How matching works" },
          { type: "list", items: [
            "When HaloPSA syncs, it creates Organization records and OrgMapping entries linking Lake Evendim to the HaloPSA client ID",
            "When NinjaRMM syncs, it tries to match its customers to existing Organizations by name similarity and domain",
            "Matches above 80% confidence are auto-confirmed; lower confidence matches wait for your review",
            "Once matched, all data (tickets, alerts, cloud users) is linked to the same Organization record",
          ]},
        ],
      },
      {
        title: "Confirming Org Matches",
        desc: "How to review, approve, or override auto-matched organizations.",
        blocks: [
          { type: "heading", text: "Reviewing a match" },
          { type: "list", items: [
            "Go to Org Matching in the sidebar",
            "Use the status filter to show 'Unconfirmed' matches",
            "Click 'Confirm Match' on any org to approve all its unconfirmed mappings",
            "The org's data from all matched services will immediately be linked",
          ]},
          { type: "heading", text: "Creating a new org manually" },
          { type: "para", text: "If a client exists in one of your tools but has not been synced yet, click 'Create Organization.' Enter the name, slug (URL-safe identifier), and domain. The next sync will automatically match service records to this org." },
        ],
      },
      {
        title: "Org Groups and Criteria",
        desc: "Grouping organizations by tier, compliance requirements, or custom filters.",
        blocks: [
          { type: "heading", text: "Creating a group" },
          { type: "list", items: [
            "Go to Org Groups in the sidebar",
            "Click 'New Org Group'",
            "Give it a name (e.g., 'Enterprise Tier', 'HIPAA Clients', 'Managed SOC')",
            "Assign a color for easy identification in reports",
          ]},
          { type: "heading", text: "Use cases" },
          { type: "list", items: [
            "Tier segmentation — Group Enterprise, Professional, and Standard clients separately",
            "Compliance grouping — Tag all HIPAA or SOC2 clients for targeted reporting",
            "Geographic grouping — US East, EU, etc. Useful for data residency and support routing",
            "MSP service tiers — 'Fully Managed' vs 'Co-Managed' vs 'Project-Only' clients",
          ]},
        ],
      },
    ],
  },
  {
    title: "Services & Data",
    articles: [
      {
        title: "How Data Polling Works",
        desc: "The cache-first fetch model: how records are stored, served, and evicted.",
        blocks: [
          { type: "heading", text: "Polling cycle" },
          { type: "list", items: [
            "A sync job is triggered (manually from Services page, or automatically by the BullMQ worker)",
            "The connector authenticates to the external API (OAuth2, bearer token, etc.)",
            "Data is fetched page by page and upserted into PostgreSQL",
            "The Redis cache for affected queries is invalidated so the next read gets fresh data",
          ]},
          { type: "heading", text: "Sync modes" },
          { type: "list", items: [
            "Polling — Lake Evendim calls out to the service on a schedule (every 15 minutes by default)",
            "Webhook — The service pushes changes in real-time. You must configure the webhook URL in the external system.",
          ]},
          { type: "heading", text: "Worker process" },
          { type: "para", text: "Sync jobs run in a separate Node.js process started with: npm run worker. The web app and worker communicate via Redis/BullMQ. If the worker is not running, sync jobs will queue but not execute." },
        ],
      },
      {
        title: "Service Sync Status",
        desc: "Understanding connected, warning, and error states for each integration.",
        blocks: [
          { type: "heading", text: "Status meanings" },
          { type: "list", items: [
            "DISCONNECTED (gray) — No credentials provided. Click Connect to add them.",
            "PENDING (blue) — Credentials saved, sync job is queued. Worker will pick it up shortly.",
            "CONNECTED (green) — Last sync completed successfully.",
            "ERROR (red) — Last sync failed. Click the service card to see the error message.",
          ]},
          { type: "heading", text: "Common error causes" },
          { type: "list", items: [
            "Expired OAuth token or API key — re-enter credentials and trigger a manual sync",
            "Incorrect tenant URL or client ID",
            "API rate limit hit — BullMQ retries automatically with exponential backoff",
            "Service outage on the provider side — check their status page",
          ]},
        ],
      },
      {
        title: "Cache and Redis",
        desc: "What the Redis cache stores and when data is fetched fresh from external APIs.",
        blocks: [
          { type: "heading", text: "What is cached" },
          { type: "list", items: [
            "Organization lists (TTL: 2 minutes)",
            "Service status lists (TTL: 30 seconds)",
            "Audit log queries (TTL: 60 seconds)",
            "Settings (TTL: 5 minutes)",
          ]},
          { type: "heading", text: "What is NOT cached" },
          { type: "list", items: [
            "Individual org details (always live)",
            "User list (always live — security sensitive)",
            "Data lake records (tickets, security events, cloud users) — always from PostgreSQL",
          ]},
          { type: "heading", text: "Job queue" },
          { type: "para", text: "BullMQ uses Redis to store sync job queues. Each sync trigger adds a job to the queue. The worker reads from this queue and processes jobs with automatic retry on failure (3 attempts with exponential backoff)." },
          { type: "heading", text: "Flushing the cache" },
          { type: "code", text: "node -e \"const r = require('ioredis'); const c = new r();\nc.flushdb().then(() => { console.log('flushed'); c.disconnect(); })\"" },
        ],
      },
    ],
  },
  {
    title: "Account & Security",
    articles: [
      {
        title: "Setting Up MFA",
        desc: "Enable TOTP-based multi-factor authentication on your account.",
        blocks: [
          { type: "heading", text: "What you need" },
          { type: "para", text: "An authenticator app on your phone: Google Authenticator, Microsoft Authenticator, Authy, or 1Password all work." },
          { type: "heading", text: "Setup steps" },
          { type: "list", items: [
            "Contact your admin to enable MFA on your account",
            "Once enabled, your next login will prompt for a 6-digit code",
            "Open your authenticator app and scan the QR code shown during first login setup",
            "Enter the 6-digit code to confirm setup",
            "From this point on, every login requires your password + TOTP code",
          ]},
          { type: "heading", text: "If you lose access to your authenticator app" },
          { type: "para", text: "Contact your platform administrator. They can disable MFA on your account so you can log in and reconfigure it." },
        ],
      },
      {
        title: "Changing Your Password",
        desc: "Steps to update your local password.",
        blocks: [
          { type: "heading", text: "For local (non-SSO) accounts" },
          { type: "para", text: "Password changes are currently handled by an administrator on the Users page. Contact your platform administrator, who can update your account from the Users page by clicking your user row." },
          { type: "heading", text: "For SSO accounts" },
          { type: "para", text: "If you log in via Microsoft (SSO), your password is managed entirely by Microsoft Entra ID. Change it through your Microsoft account settings or your organization's IT portal." },
          { type: "heading", text: "Password requirements" },
          { type: "list", items: [
            "Minimum 8 characters",
            "Mix of uppercase, lowercase, and numbers recommended",
            "Platform stores only the bcrypt hash — your actual password is never stored",
          ]},
        ],
      },
      {
        title: "API Keys for Your Apps",
        desc: "How to generate and use API keys to access Bedrock data from your applications.",
        blocks: [
          { type: "heading", text: "Generating a key" },
          { type: "list", items: [
            "Go to API Keys in the sidebar",
            "Click 'Generate API Key'",
            "Give the key a descriptive name (e.g., 'Reporting Dashboard')",
            "Select scopes for what data the key can access",
            "Optionally set an expiration date",
            "Copy the key immediately — it is shown only once",
          ]},
          { type: "heading", text: "Using a key" },
          { type: "para", text: "Include the key in the Authorization header of your HTTP requests:" },
          { type: "code", text: "Authorization: Bearer le_live_your_key_here\n\nGET /api/data/tickets?orgId=xxx&status=open\nGET /api/data/security-events?severity=critical\nGET /api/data/cloud-users?orgId=xxx&licensed=true" },
          { type: "heading", text: "Available scopes" },
          { type: "list", items: [
            "read:tickets — Access to /api/data/tickets",
            "read:security-events — Access to /api/data/security-events",
            "read:cloud-users — Access to /api/data/cloud-users",
          ]},
        ],
      },
    ],
  },
];

function BlockRenderer({ block }: { block: Block }) {
  const fmt = (text: string) => text
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/'(.*?)'/g, "<em>$1</em>");

  if (block.type === "heading") {
    return <h4 className="text-sm font-semibold text-foreground mt-4 mb-1">{block.text}</h4>;
  }
  if (block.type === "code") {
    return (
      <pre className="rounded-lg bg-muted/40 border border-border p-3 text-xs font-mono text-foreground overflow-x-auto whitespace-pre my-2">
        {block.text}
      </pre>
    );
  }
  if (block.type === "list") {
    return (
      <ul className="space-y-1 my-1">
        {block.items.map((item, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
            <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-primary/60 shrink-0" />
            <span dangerouslySetInnerHTML={{ __html: fmt(item) }} />
          </li>
        ))}
      </ul>
    );
  }
  return <p className="text-sm text-muted-foreground leading-relaxed" dangerouslySetInnerHTML={{ __html: fmt(block.text) }} />;
}

function ArticleModal({ article, onClose }: { article: Article; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
      <div className="relative w-full max-w-2xl max-h-[85vh] flex flex-col rounded-2xl border border-border bg-card shadow-2xl">
        <div className="flex items-start justify-between gap-4 px-6 py-4 border-b border-border shrink-0">
          <div>
            <h2 className="text-base font-semibold text-foreground">{article.title}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">{article.desc}</p>
          </div>
          <button onClick={onClose} className="shrink-0 w-7 h-7 flex items-center justify-center rounded-lg hover:bg-muted/40 text-muted-foreground transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-2">
          {article.blocks.map((block, i) => <BlockRenderer key={i} block={block} />)}
        </div>
      </div>
    </div>
  );
}

export default function UserGuidePage() {
  const [openArticle, setOpenArticle] = useState<Article | null>(null);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});

  function toggleSection(title: string) {
    setExpandedSections((prev) => ({ ...prev, [title]: !prev[title] }));
  }

  return (
    <div className="flex flex-col h-full">
      <PageHeader title="User Guide" subtitle="Platform documentation for all users" />

      <div className="flex-1 overflow-y-auto p-6 max-w-4xl space-y-6">
        <div className="rounded-xl border border-border bg-gradient-to-br from-primary/5 to-accent/5 p-6 flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
            <BookOpen className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-foreground">Welcome to Lake Evendim</h2>
            <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
              Lake Evendim is the admin control plane for your Bedrock data lake. Click any article below to read the full documentation.
            </p>
          </div>
        </div>

        {SECTIONS.map((section) => {
          const isOpen = expandedSections[section.title] !== false;
          return (
            <div key={section.title}>
              <button onClick={() => toggleSection(section.title)} className="flex items-center gap-2 mb-3 group">
                {isOpen
                  ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />
                  : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />
                }
                <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground group-hover:text-foreground transition-colors">
                  {section.title}
                </h3>
                <span className="text-[10px] text-muted-foreground/60">({section.articles.length})</span>
              </button>

              {isOpen && (
                <div className="space-y-2 pl-5">
                  {section.articles.map((article) => (
                    <button
                      key={article.title}
                      onClick={() => setOpenArticle(article)}
                      className="w-full text-left flex items-start justify-between gap-4 p-4 rounded-lg border border-border/60 bg-card hover:border-primary/30 hover:bg-card/80 transition-colors group"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">{article.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{article.desc}</p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary shrink-0 mt-0.5 transition-colors" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {openArticle && <ArticleModal article={openArticle} onClose={() => setOpenArticle(null)} />}
    </div>
  );
}
