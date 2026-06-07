"use client";

import { useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { BookMarked, ChevronRight, ChevronDown, AlertTriangle, X } from "lucide-react";

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
    title: "Platform Administration",
    articles: [
      {
        title: "Initial Setup Checklist",
        desc: "Step-by-step guide to configuring Lake Evendim from scratch.",
        blocks: [
          { type: "heading", text: "1. Environment Variables" },
          { type: "para", text: "Copy .env.example to .env and fill in all required values: DATABASE_URL, REDIS_URL, AUTH_SECRET, ENCRYPTION_KEY, and NEXTAUTH_URL." },
          { type: "heading", text: "2. Database Setup" },
          { type: "code", text: "npx prisma db push       # Apply schema to database\nnpx tsx prisma/seed.ts   # Create default roles, permissions, admin user" },
          { type: "heading", text: "3. Start Services" },
          { type: "code", text: "npm run build            # Build the Next.js app\nnpm start                # Start the web server\nnpm run worker           # Start the sync worker (separate terminal)" },
          { type: "heading", text: "4. First Login" },
          { type: "list", items: [
            "Navigate to the platform URL",
            "Log in with: admin@evendim.local / Admin1234!",
            "Immediately change the admin password",
          ]},
          { type: "heading", text: "5. Connect Your First Service" },
          { type: "para", text: "Go to Services and click Connect on HaloPSA. Enter your tenant URL, client ID, and client secret. Trigger a manual sync to populate organizations." },
        ],
      },
      {
        title: "Environment Variables Reference",
        desc: "All required and optional environment variables with descriptions and example values.",
        blocks: [
          { type: "heading", text: "Required" },
          { type: "list", items: [
            "DATABASE_URL — PostgreSQL connection string (postgresql://user:pass@host:5432/db)",
            "REDIS_URL — Redis connection string (redis://localhost:6379)",
            "AUTH_SECRET — Random 32+ character secret for JWT signing. Generate: openssl rand -base64 32",
            "NEXTAUTH_URL — The canonical URL of your deployment (e.g., https://lake.yourdomain.com)",
          ]},
          { type: "heading", text: "Security" },
          { type: "list", items: [
            "ENCRYPTION_KEY — 64-character hex string for AES-256-GCM credential encryption. Generate: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"",
            "Without ENCRYPTION_KEY: service credentials are stored as plain JSON (not suitable for production)",
          ]},
          { type: "heading", text: "Microsoft SSO (Optional)" },
          { type: "list", items: [
            "AUTH_MICROSOFT_ENTRA_ID_ID — Application (client) ID from your Azure app registration",
            "AUTH_MICROSOFT_ENTRA_ID_SECRET — Client secret from your Azure app registration",
            "AUTH_MICROSOFT_ENTRA_ID_TENANT_ID — Your Azure tenant ID",
          ]},
        ],
      },
      {
        title: "Database Configuration",
        desc: "PostgreSQL setup, connection pooling, migrations, and backup strategy.",
        blocks: [
          { type: "heading", text: "PostgreSQL Requirements" },
          { type: "list", items: [
            "Version 14 or higher",
            "Standard PostgreSQL features — no extensions required",
          ]},
          { type: "heading", text: "Applying Schema Changes" },
          { type: "code", text: "npx prisma db push        # Apply current schema (initial setup)\nnpx prisma migrate dev    # Generate a migration file (recommended for prod)\nnpx prisma migrate deploy # Apply pending migrations in production" },
          { type: "heading", text: "Backup Strategy" },
          { type: "code", text: "# Daily backup example\npg_dump $DATABASE_URL > backup_$(date +%Y%m%d).sql\n\n# Restore\npsql $DATABASE_URL < backup_20240101.sql" },
          { type: "heading", text: "Re-seeding" },
          { type: "para", text: "The seed script is idempotent — safe to re-run. It won't overwrite existing data. Run: npx tsx prisma/seed.ts" },
        ],
      },
      {
        title: "Redis Configuration",
        desc: "Redis setup, memory limits, eviction policies, and monitoring.",
        blocks: [
          { type: "heading", text: "Redis Requirements" },
          { type: "list", items: [
            "Version 6 or higher",
            "Used for: API response caching and BullMQ job queue",
          ]},
          { type: "heading", text: "Recommended Configuration (redis.conf)" },
          { type: "code", text: "maxmemory 256mb\nmaxmemory-policy noeviction   # Required for BullMQ\nsave 900 1\nappendonly yes                # AOF persistence" },
          { type: "heading", text: "Why noeviction?" },
          { type: "para", text: "BullMQ requires that job queue entries are never evicted by memory pressure. With allkeys-lru, Redis may delete queued sync jobs causing silent data loss. With noeviction, Redis returns an error instead — BullMQ handles this gracefully." },
          { type: "heading", text: "Flushing the cache" },
          { type: "code", text: "redis-cli FLUSHDB    # Clears only current database — safe\nredis-cli FLUSHALL   # Clears ALL databases — also clears BullMQ queues!" },
        ],
      },
    ],
  },
  {
    title: "User & Access Management",
    articles: [
      {
        title: "Managing Users and Roles",
        desc: "Creating users, assigning roles, managing groups, and setting permissions.",
        blocks: [
          { type: "heading", text: "Creating Users" },
          { type: "list", items: [
            "Go to Users in the sidebar",
            "Click 'Invite User'",
            "Enter email, name, and select a role",
            "The user is created immediately and can log in",
          ]},
          { type: "heading", text: "Editing Users" },
          { type: "para", text: "Click any user row in the Users table to open the edit modal. You can change their display name, activate or deactivate the account, and add or remove roles." },
          { type: "heading", text: "Built-in System Roles" },
          { type: "list", items: [
            "Super Admin — Full access to everything",
            "Admin — Full access except role and permission management",
            "Support — Read access plus limited service interaction",
            "Read-Only — Read-only access to all non-sensitive resources",
          ]},
          { type: "heading", text: "Groups" },
          { type: "para", text: "Create groups (e.g., 'Engineering Team', 'NOC') and assign roles to the group. All group members inherit the group's roles — useful for managing large teams." },
        ],
      },
      {
        title: "Configuring RBAC",
        desc: "How role-based access control works and how to design permission sets for your team.",
        blocks: [
          { type: "heading", text: "Permission Model" },
          { type: "para", text: "Permissions are resource + action pairs. Resources: users, roles, groups, services, orgs, api-keys, apps, settings, audit, dashboard. Actions: read, write, delete, admin." },
          { type: "heading", text: "How permissions are evaluated" },
          { type: "list", items: [
            "User has one or more roles",
            "Each role has zero or more permissions",
            "A user can perform an action if any of their roles grants that permission",
            "Missing permission = 403 Forbidden",
          ]},
          { type: "heading", text: "Security principle" },
          { type: "para", text: "Follow least-privilege: give users only the permissions they need. Most team members should be Support or Read-Only. Reserve Admin for platform operators." },
        ],
      },
      {
        title: "Bulk User Import",
        desc: "Importing users from CSV or from Microsoft Entra ID directory sync.",
        blocks: [
          { type: "heading", text: "API-based batch creation" },
          { type: "para", text: "Bulk import via CSV is not yet in the UI. For now, create users via the API:" },
          { type: "code", text: "curl -X POST https://your-platform/api/users \\\n  -H \"Authorization: Bearer YOUR_API_KEY\" \\\n  -H \"Content-Type: application/json\" \\\n  -d '{\"email\":\"user@company.com\",\"name\":\"User Name\",\"roleId\":\"ROLE_ID\"}'" },
          { type: "heading", text: "Microsoft Entra ID Sync" },
          { type: "para", text: "When M365 is connected and synced, cloud users from your tenant are imported into the CloudUser table. These are NOT automatically created as platform users — they represent M365 accounts for reporting. To grant access, create the user manually via Invite User using the same email." },
        ],
      },
      {
        title: "Disabling and Removing Users",
        desc: "How to safely deactivate or remove users without data loss.",
        blocks: [
          { type: "heading", text: "Deactivating a User (Recommended)" },
          { type: "list", items: [
            "Click the user's row in the Users table",
            "Toggle 'Active' to off in the edit modal",
            "Save changes",
          ]},
          { type: "heading", text: "What deactivation does" },
          { type: "list", items: [
            "Sets isActive = false on the user record",
            "All existing sessions expire within their natural timeout",
            "API keys they created remain active — revoke separately if needed",
            "Audit log entries remain attributed to their user ID",
            "Fully reversible — you can reactivate at any time",
          ]},
          { type: "heading", text: "Important: Revoke API Keys First" },
          { type: "para", text: "Before deactivating a user, go to API Keys and revoke any keys they own. Deactivated users' keys are NOT automatically revoked." },
        ],
      },
    ],
  },
  {
    title: "SSO & Identity",
    articles: [
      {
        title: "Microsoft Entra ID Setup",
        desc: "Register the Lake Evendim app in Azure, configure tenant and scopes, and test SSO login.",
        blocks: [
          { type: "heading", text: "Step 1: Register the app in Azure" },
          { type: "list", items: [
            "Sign in to portal.azure.com",
            "Go to Microsoft Entra ID → App registrations → New registration",
            "Name: 'Lake Evendim' (or your preferred name)",
            "Supported account types: 'Accounts in this organizational directory only'",
            "Redirect URI: Web → https://your-platform-url/api/auth/callback/microsoft-entra-id",
          ]},
          { type: "heading", text: "Step 2: Get credentials" },
          { type: "list", items: [
            "Application (client) ID → set as AUTH_MICROSOFT_ENTRA_ID_ID",
            "Directory (tenant) ID → set as AUTH_MICROSOFT_ENTRA_ID_TENANT_ID",
          ]},
          { type: "heading", text: "Step 3: Create a client secret" },
          { type: "list", items: [
            "Go to Certificates & secrets → New client secret",
            "Set expiry (24 months recommended)",
            "Copy the value immediately → set as AUTH_MICROSOFT_ENTRA_ID_SECRET",
          ]},
          { type: "heading", text: "Step 4: Configure in Lake Evendim" },
          { type: "list", items: [
            "Go to SSO in the sidebar and click 'Configure SSO'",
            "Enter your Tenant ID, Client ID, Client Secret",
            "Add your company's email domains to the allowed list",
            "Enable SSO",
          ]},
        ],
      },
      {
        title: "Enforcing SSO",
        desc: "How to require SSO for all users and disable local password login.",
        blocks: [
          { type: "heading", text: "Current behavior" },
          { type: "para", text: "Both SSO (Microsoft) and local credentials (email/password) are available simultaneously. Users can use either method." },
          { type: "heading", text: "Recommended approach" },
          { type: "list", items: [
            "Disable local passwords for SSO users (set password = null in the database)",
            "Configure Entra ID Conditional Access to require MFA for the registered app",
            "Use Entra ID group membership to control who can authenticate",
          ]},
          { type: "heading", text: "Conditional Access in Entra ID" },
          { type: "para", text: "In the Azure portal, go to Entra ID → Security → Conditional Access. Create a policy targeting the Lake Evendim app registration that requires MFA and optionally blocks access from non-company networks." },
        ],
      },
      {
        title: "Troubleshooting SSO",
        desc: "Common Entra ID errors, token issues, and redirect URI mismatches.",
        blocks: [
          { type: "heading", text: "AADSTS50011: Redirect URI mismatch" },
          { type: "para", text: "The redirect URI in your Azure app registration does not exactly match NEXTAUTH_URL + /api/auth/callback/microsoft-entra-id. Check for trailing slashes, http vs https, and port numbers." },
          { type: "heading", text: "AADSTS700016: Application not found" },
          { type: "para", text: "Wrong tenant ID or the app is not registered in that tenant. Double-check AUTH_MICROSOFT_ENTRA_ID_TENANT_ID." },
          { type: "heading", text: "AADSTS65001: User has not consented" },
          { type: "para", text: "In Azure, go to the app registration → API Permissions and click 'Grant admin consent.'" },
          { type: "heading", text: "User authenticates but sees 403" },
          { type: "para", text: "Their email domain is not in the SSO allowed domains list. Go to the SSO page in Lake Evendim and add their domain." },
        ],
      },
    ],
  },
  {
    title: "Integrations & Services",
    articles: [
      {
        title: "Adding a New Integration",
        desc: "How to connect a new service: credentials, scopes, poll schedule, and initial sync.",
        blocks: [
          { type: "heading", text: "Credential requirements by service" },
          { type: "list", items: [
            "HaloPSA — Tenant URL, Client ID, Client Secret (from HaloPSA Admin → Integrations → API)",
            "Microsoft 365 — Azure Tenant ID, Client ID, Client Secret (app registration with User.Read.All, Organization.Read.All)",
            "Todyl — API Key (from Todyl portal → Settings → API)",
            "NinjaRMM — Client ID and Secret (from Ninja Admin → API)",
          ]},
          { type: "heading", text: "Steps" },
          { type: "list", items: [
            "Go to Services in the sidebar",
            "Find the service card and click 'Connect'",
            "Enter the credentials in the modal",
            "Select sync mode: Polling (recommended to start) or Webhook",
            "Click 'Save & Connect'",
          ]},
          { type: "heading", text: "Verify the sync" },
          { type: "para", text: "Check the Dashboard — the service should move to CONNECTED within a minute. If it stays PENDING for more than 2 minutes, check that the worker process is running (npm run worker)." },
        ],
      },
      {
        title: "Handling Sync Failures",
        desc: "Diagnosing sync errors, re-authorizing OAuth tokens, and manual retries.",
        blocks: [
          { type: "heading", text: "Common failure causes" },
          { type: "list", items: [
            "401 Unauthorized — OAuth token expired or credentials changed. Re-enter credentials and trigger a manual sync.",
            "429 Too Many Requests — API rate limit hit. BullMQ retries automatically with backoff (3 attempts: 5s, 10s, 20s).",
            "Connection timeout — Network issue or the external service is down. Check their status page.",
          ]},
          { type: "heading", text: "Triggering a manual retry" },
          { type: "para", text: "On the Services page, click the service card and select 'Trigger Sync Now.' This bypasses the schedule and runs immediately." },
          { type: "heading", text: "Checking sync history" },
          { type: "para", text: "The audit log records every service.sync.triggered and service.sync.completed / service.sync.failed event. Filter the audit log by action to see all sync history." },
        ],
      },
      {
        title: "Poll Schedule Tuning",
        desc: "Balancing API quota usage against data freshness for each integration.",
        blocks: [
          { type: "heading", text: "Recommended intervals by service" },
          { type: "list", items: [
            "HaloPSA tickets — Every 5-15 minutes for active helpdesk environments",
            "Microsoft 365 users — Every 60 minutes is sufficient; user accounts change rarely",
            "Todyl security events — Every 5 minutes for active SOC; consider webhooks instead",
            "NinjaRMM — Every 15 minutes",
            "Pax8 licensing — Every 60 minutes; billing data does not change frequently",
          ]},
          { type: "heading", text: "Configuring intervals" },
          { type: "para", text: "The default poll interval is set in Settings → Data Polling → Default Poll Interval. Individual service intervals can be adjusted per service (planned for a future release)." },
          { type: "heading", text: "Webhook alternative" },
          { type: "para", text: "For high-frequency data (security events, new tickets), consider switching the service to Webhook mode after initial setup. This triggers a sync immediately on each event — more efficient and faster than polling." },
        ],
      },
      {
        title: "Rate Limit Management",
        desc: "Monitoring API rate limit consumption and adjusting polling frequency.",
        blocks: [
          { type: "heading", text: "Typical API quotas" },
          { type: "list", items: [
            "HaloPSA — 1000 requests/hour per client ID. Each sync uses roughly 50 requests for 500 clients + 2000 tickets.",
            "Microsoft Graph — 10,000 requests per 10 minutes per tenant. M365 connector uses about 10 requests for 1000 users.",
            "Todyl — Check your plan's limits in the Todyl portal.",
          ]},
          { type: "heading", text: "What happens when rate limited" },
          { type: "para", text: "The connector receives a 429 response. BullMQ retries the job up to 3 times with exponential backoff (5s, 10s, 20s). If all 3 attempts fail, the service moves to ERROR status. The next scheduled sync will try again." },
          { type: "heading", text: "Staying under limits" },
          { type: "list", items: [
            "Increase poll interval in Settings → Data Polling",
            "Use webhooks for high-frequency services",
            "Reduce Parallel Sync Workers setting if hitting limits across multiple services simultaneously",
          ]},
        ],
      },
    ],
  },
  {
    title: "Security & Compliance",
    articles: [
      {
        title: "Audit Log Review",
        desc: "What events are logged, how to search and export audit data.",
        blocks: [
          { type: "heading", text: "What is logged" },
          { type: "list", items: [
            "User creation, edit, deactivation",
            "Service connect, disconnect, sync trigger, sync success, sync failure",
            "Organization creation, update, deletion, mapping confirmation",
            "SSO configuration changes",
            "API key generation and revocation",
            "Settings changes and webhook events received",
          ]},
          { type: "heading", text: "Audit log fields" },
          { type: "list", items: [
            "Action — Dot-notation event name (e.g., user.created, service.sync.failed)",
            "Resource — The type of object affected (User, Service, Organization, etc.)",
            "Resource ID — The specific record's ID",
            "User — Who performed the action (null for system/worker events)",
            "Metadata — Additional context (error message, encrypted flag, etc.)",
          ]},
          { type: "heading", text: "Exporting" },
          { type: "para", text: "The GET /api/audit endpoint returns the audit log as JSON. Use your API key to query it programmatically for export to your SIEM or compliance tool." },
        ],
      },
      {
        title: "API Key Security",
        desc: "Best practices for key rotation, scope minimization, and revocation.",
        blocks: [
          { type: "heading", text: "Key storage" },
          { type: "para", text: "Lake Evendim stores only a SHA-256 hash of each API key — never the plaintext. The raw key is shown exactly once on creation. If lost, generate a new key." },
          { type: "heading", text: "Scope minimization" },
          { type: "list", items: [
            "read:tickets — Access to /api/data/tickets",
            "read:security-events — Access to /api/data/security-events",
            "read:cloud-users — Access to /api/data/cloud-users",
            "A dashboard that only needs tickets should only have read:tickets",
          ]},
          { type: "heading", text: "Key rotation" },
          { type: "list", items: [
            "Generate a new key with the same scopes",
            "Update the consuming application with the new key",
            "Revoke the old key from the API Keys page",
            "Rotate every 90 days or immediately after a suspected exposure",
          ]},
          { type: "heading", text: "Monitoring usage" },
          { type: "para", text: "The API Keys page shows the Last Used timestamp for each key. Any key not used in 30+ days should be reviewed and possibly revoked." },
        ],
      },
      {
        title: "Incident Response",
        desc: "Steps to take when a security incident is detected in the audit log.",
        blocks: [
          { type: "heading", text: "Signs of a security incident" },
          { type: "list", items: [
            "Unexpected user.created or user.updated events",
            "API key generation by an unknown user",
            "Service credentials changed unexpectedly",
            "Large volume of sync triggers outside normal schedule",
          ]},
          { type: "heading", text: "Immediate response steps" },
          { type: "list", items: [
            "Identify the scope — Search the audit log for the suspicious user. What actions did they take?",
            "Contain — Deactivate the affected user account immediately (Users page → toggle isActive off)",
            "Revoke API keys — Revoke any keys the compromised user created",
            "Rotate credentials — Re-rotate affected service credentials in the source systems, then update Lake Evendim config",
            "Investigate — Review the full audit log for the user: new users created, settings changed, API keys generated",
            "Harden — Enable MFA for all users, rotate the AUTH_SECRET env var (forces all sessions to expire)",
          ]},
        ],
      },
    ],
  },
  {
    title: "Operations",
    articles: [
      {
        title: "Monitoring and Alerting",
        desc: "Setting up notifications for sync failures, Redis pressure, and login anomalies.",
        blocks: [
          { type: "heading", text: "Health endpoint" },
          { type: "para", text: "GET /api/health returns a JSON status object. Point your uptime monitor (UptimeRobot, Pingdom, Datadog Synthetics) at this endpoint." },
          { type: "heading", text: "Log-based alerting" },
          { type: "para", text: "The worker process logs sync failures to stdout in JSON format. Ship logs to your SIEM or log aggregator (Datadog, CloudWatch, Splunk) and set alerts on level: error with action: sync.failed." },
          { type: "heading", text: "Process monitoring" },
          { type: "para", text: "Run the worker under a process manager so it restarts on crash:" },
          { type: "code", text: "pm2 start npm --name \"evendim-worker\" -- run worker\npm2 startup && pm2 save" },
          { type: "heading", text: "Notification channels" },
          { type: "para", text: "In Settings → Notifications, configure alert toggles for sync failures and high Redis memory. Email/Slack delivery requires the corresponding env vars (SMTP, Slack webhook URL, etc.) — planned for a future release." },
        ],
      },
      {
        title: "Backup and Recovery",
        desc: "PostgreSQL backup strategy, Redis persistence, and point-in-time recovery.",
        blocks: [
          { type: "heading", text: "PostgreSQL Backups" },
          { type: "code", text: "# Daily backup\npg_dump $DATABASE_URL | gzip > backup_$(date +%Y%m%d_%H%M%S).sql.gz\n\n# Restore\ngunzip -c backup_20240101.sql.gz | psql $DATABASE_URL" },
          { type: "heading", text: "What to back up" },
          { type: "list", items: [
            "PostgreSQL database — all platform data, user accounts, audit logs, synced records",
            ".env file — especially ENCRYPTION_KEY (without it, service credentials are unreadable after restore)",
            "Redis is ephemeral — it is a cache and job queue, not a source of truth. Data loss only requires a restart and fresh sync.",
          ]},
          { type: "heading", text: "Recovery steps after database loss" },
          { type: "list", items: [
            "Restore from most recent backup: psql $DATABASE_URL < backup.sql",
            "Verify environment variables (especially DATABASE_URL and ENCRYPTION_KEY)",
            "Run: npx prisma db push to ensure schema is current",
            "Restart all processes",
            "Trigger manual syncs for all services to repopulate time-sensitive data",
          ]},
        ],
      },
      {
        title: "Upgrading Lake Evendim",
        desc: "Safe upgrade procedures, migration steps, and rollback.",
        blocks: [
          { type: "heading", text: "Before upgrading" },
          { type: "list", items: [
            "Read the changelog for breaking changes",
            "Back up the database: pg_dump $DATABASE_URL > pre_upgrade_backup.sql",
            "Back up your .env file",
            "Test the upgrade in a staging environment first",
          ]},
          { type: "heading", text: "Upgrade procedure" },
          { type: "code", text: "pm2 stop evendim-worker   # Stop the worker\ngit pull origin main       # Pull new code\nnpm install                # Install dependencies\nnpx prisma migrate deploy  # Apply pending migrations\nnpm run build              # Build\npm2 restart all            # Restart services" },
          { type: "heading", text: "Rollback procedure" },
          { type: "code", text: "pm2 stop evendim-app evendim-worker\npsql $DATABASE_URL < pre_upgrade_backup.sql\ngit checkout v1.x.x\nnpm install && npm run build\npm2 restart all" },
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
            <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-secondary/60 shrink-0" />
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

export default function AdminGuidePage() {
  const [openArticle, setOpenArticle] = useState<Article | null>(null);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});

  function toggleSection(title: string) {
    setExpandedSections((prev) => ({ ...prev, [title]: !prev[title] }));
  }

  return (
    <div className="flex flex-col h-full">
      <PageHeader title="Admin Guide" subtitle="Administrative documentation for platform operators" />

      <div className="flex-1 overflow-y-auto p-6 max-w-4xl space-y-6">
        <div className="rounded-xl border border-border bg-gradient-to-br from-secondary/5 to-primary/5 p-6 flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-secondary/10 border border-secondary/20 flex items-center justify-center shrink-0">
            <BookMarked className="w-5 h-5 text-secondary" />
          </div>
          <div className="flex-1">
            <h2 className="text-base font-semibold text-foreground">Administrator Documentation</h2>
            <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
              Reference material for platform administrators. Click any article to read the full guide.
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3 rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-3">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground">
            Admin actions affect the entire platform. Always test in a non-production environment before making changes that affect data sync, authentication, or access control.
          </p>
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
                      className="w-full text-left flex items-start justify-between gap-4 p-4 rounded-lg border border-border/60 bg-card hover:border-secondary/30 hover:bg-card/80 transition-colors group"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground group-hover:text-secondary transition-colors">{article.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{article.desc}</p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-secondary shrink-0 mt-0.5 transition-colors" />
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
