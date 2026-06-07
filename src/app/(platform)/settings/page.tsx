"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { Save, Bell, Shield, Database, Clock, Globe, Palette, Loader2, Share2 } from "lucide-react";

type SettingValue = string | boolean | number;

interface SettingItem {
  key: string;
  label: string;
  description: string;
  type: "toggle" | "select" | "input" | "number";
  defaultValue: SettingValue;
  options?: string[];
}

const SECTIONS: { id: string; title: string; icon: React.ElementType; iconColor: string; settings: SettingItem[] }[] = [
  {
    id: "general", title: "General", icon: Globe, iconColor: "text-primary",
    settings: [
      { key: "platform_name",    label: "Platform Name",    description: "Display name shown in the UI and emails.",       type: "input",  defaultValue: "Lake Evendim" },
      { key: "support_email",    label: "Support Email",    description: "Contact address for support escalations.",        type: "input",  defaultValue: "support@evendim.io" },
      { key: "default_timezone", label: "Default Timezone", description: "Used for scheduled tasks and log timestamps.",    type: "select", defaultValue: "UTC", options: ["UTC", "US/Eastern", "US/Pacific", "Europe/London", "Europe/Berlin"] },
    ],
  },
  {
    id: "appearance", title: "Appearance", icon: Palette, iconColor: "text-accent",
    settings: [
      { key: "dark_mode_default", label: "Dark Mode Default", description: "Force dark theme for all users.",   type: "toggle", defaultValue: true },
      { key: "compact_tables",    label: "Compact Tables",    description: "Reduce row height in data tables.",  type: "toggle", defaultValue: false },
    ],
  },
  {
    id: "polling", title: "Data Polling", icon: Clock, iconColor: "text-amber-400",
    settings: [
      { key: "default_poll_interval", label: "Default Poll Interval (min)", description: "Global default for service sync frequency.", type: "number", defaultValue: 15 },
      { key: "cache_ttl",             label: "Cache TTL (sec)",             description: "How long records are served from cache.",     type: "number", defaultValue: 300 },
      { key: "auto_purge_old",        label: "Auto-Purge Old Records",      description: "Remove stale cache entries automatically.",    type: "toggle", defaultValue: true },
      { key: "parallel_workers",      label: "Parallel Sync Workers",       description: "Number of concurrent sync jobs.",             type: "number", defaultValue: 4 },
    ],
  },
  {
    id: "security", title: "Security", icon: Shield, iconColor: "text-emerald-400",
    settings: [
      { key: "require_mfa",           label: "Require MFA",           description: "Enforce MFA for all local users.",      type: "toggle", defaultValue: false },
      { key: "session_timeout_min",   label: "Session Timeout (min)", description: "Auto-logout after inactivity.",         type: "number", defaultValue: 480 },
      { key: "audit_retention_days",  label: "Audit Log Retention",   description: "Days to retain audit log entries.",     type: "number", defaultValue: 90 },
      { key: "api_rate_limit_rpm",    label: "API Rate Limit (RPM)",  description: "Max requests per minute per API key.",  type: "number", defaultValue: 1000 },
    ],
  },
  {
    id: "notifications", title: "Notifications", icon: Bell, iconColor: "text-secondary",
    settings: [
      { key: "alert_on_sync_failure", label: "Alert on Sync Failure", description: "Send notification when a service sync fails.",  type: "toggle", defaultValue: true },
      { key: "alert_on_high_redis",   label: "Alert on High Redis",   description: "Notify when Redis memory exceeds 80%.",         type: "toggle", defaultValue: true },
      { key: "notification_channel",  label: "Notification Channel",  description: "Where to send platform alerts.",                type: "select", defaultValue: "Email", options: ["Email", "Slack", "Teams", "PagerDuty"] },
      { key: "alert_cooldown_min",    label: "Alert Cooldown (min)",  description: "Minimum time between repeated alerts.",         type: "number", defaultValue: 30 },
    ],
  },
  {
    id: "database", title: "Database", icon: Database, iconColor: "text-teal-400",
    settings: [
      { key: "db_pool_size",      label: "Connection Pool Size", description: "Maximum simultaneous DB connections.",  type: "number", defaultValue: 20 },
      { key: "db_query_timeout",  label: "Query Timeout (ms)",  description: "Max time before a query is aborted.",   type: "number", defaultValue: 5000 },
      { key: "db_auto_vacuum",    label: "Auto-Vacuum",         description: "Enable PostgreSQL auto-vacuum.",         type: "toggle", defaultValue: true },
    ],
  },
  {
    id: "external-access", title: "External Data Access", icon: Share2, iconColor: "text-violet-400",
    settings: [
      { key: "external_api_enabled",     label: "Enable External API",       description: "Allow downstream dashboards to query data endpoints using API keys.",  type: "toggle", defaultValue: true },
      { key: "external_default_page_size", label: "Default Page Size",       description: "Default number of records returned per page in data endpoints.",       type: "number", defaultValue: 100 },
      { key: "external_max_page_size",   label: "Max Page Size",             description: "Maximum records a downstream dashboard can request per page.",          type: "number", defaultValue: 500 },
      { key: "external_include_raw_data", label: "Include Raw Data",         description: "Include rawData field (original API response) in data endpoint results.", type: "toggle", defaultValue: false },
    ],
  },
];

const ALL_KEYS = SECTIONS.flatMap((s) => s.settings.map((i) => i.key));

export default function SettingsPage() {
  const [values, setValues] = useState<Record<string, SettingValue>>(() => {
    const defaults: Record<string, SettingValue> = {};
    SECTIONS.forEach((s) => s.settings.forEach((i) => { defaults[i.key] = i.defaultValue; }));
    return defaults;
  });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.ok ? r.json() : {})
      .then((data: Record<string, SettingValue>) => {
        setValues((prev) => {
          const merged = { ...prev };
          ALL_KEYS.forEach((key) => {
            if (data[key] !== undefined) merged[key] = data[key];
          });
          return merged;
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function setValue(key: string, val: SettingValue) {
    setValues((prev) => ({ ...prev, [key]: val }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!res.ok) throw new Error();
      toast.success("Settings saved.");
    } catch {
      toast.error("Failed to save settings.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Settings"
        subtitle="Platform-wide configuration and preferences"
        actions={
          <button
            onClick={handleSave}
            disabled={saving || loading}
            className="flex items-center gap-2 h-8 px-3 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors disabled:opacity-60"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Save Changes
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        {loading && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading settings…
          </div>
        )}

        {SECTIONS.map((section) => {
          const Icon = section.icon;
          return (
            <div key={section.id} className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="px-5 py-3.5 border-b border-border flex items-center gap-2">
                <Icon className={`w-4 h-4 ${section.iconColor}`} />
                <h3 className="text-sm font-semibold text-foreground">{section.title}</h3>
              </div>
              <div className="px-5 divide-y divide-border/50">
                {section.settings.map((item) => (
                  <div key={item.key} className="flex items-start justify-between gap-6 py-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">{item.label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
                    </div>
                    <div className="shrink-0">
                      {item.type === "toggle" && (
                        <button
                          type="button"
                          onClick={() => setValue(item.key, !values[item.key])}
                          className={`w-9 h-5 rounded-full border relative transition-colors ${values[item.key] ? "bg-primary border-primary" : "bg-muted border-border"}`}
                        >
                          <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${values[item.key] ? "left-4" : "left-0.5"}`} />
                        </button>
                      )}
                      {item.type === "input" && (
                        <input
                          value={values[item.key] as string}
                          onChange={(e) => setValue(item.key, e.target.value)}
                          className="h-8 w-52 px-2.5 rounded-md bg-input border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                        />
                      )}
                      {item.type === "number" && (
                        <input
                          type="number"
                          value={values[item.key] as number}
                          onChange={(e) => setValue(item.key, Number(e.target.value))}
                          className="h-8 w-24 px-2.5 rounded-md bg-input border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                        />
                      )}
                      {item.type === "select" && (
                        <select
                          value={values[item.key] as string}
                          onChange={(e) => setValue(item.key, e.target.value)}
                          className="h-8 px-2.5 rounded-md bg-input border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                        >
                          {item.options?.map((o) => <option key={o}>{o}</option>)}
                        </select>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {/* Downstream dashboard integration reference */}
        <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Share2 className="w-4 h-4 text-violet-400" />
            <h3 className="text-sm font-semibold text-foreground">Downstream Dashboard Integration</h3>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            External dashboards and automation tools can query Lake Evendim's data endpoints using API keys.
            Generate a key from the <a href="/api-keys" className="text-primary hover:underline">API Keys</a> page and include it in requests:
          </p>
          <pre className="rounded-lg bg-muted/40 border border-border p-3 text-xs font-mono text-foreground overflow-x-auto">
            {`Authorization: Bearer le_live_your_key_here\n\nGET /api/data/tickets?orgId=xxx&status=open&pageSize=100\nGET /api/data/security-events?severity=critical\nGET /api/data/cloud-users?orgId=xxx&licensed=true\nGET /api/orgs`}
          </pre>
          <p className="text-xs text-muted-foreground">
            Each key can be scoped to specific data: <code className="text-xs bg-muted/60 rounded px-1 py-0.5 font-mono">read:tickets</code>, <code className="text-xs bg-muted/60 rounded px-1 py-0.5 font-mono">read:security-events</code>, <code className="text-xs bg-muted/60 rounded px-1 py-0.5 font-mono">read:cloud-users</code>.
            All endpoints return paginated JSON with a <code className="text-xs bg-muted/60 rounded px-1 py-0.5 font-mono">meta</code> field containing total count and page info.
          </p>
        </div>
      </div>
    </div>
  );
}
