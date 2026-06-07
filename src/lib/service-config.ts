export interface ServiceCredentialField {
  key: string;
  label: string;
  placeholder: string;
  type: "text" | "password" | "url";
  required: boolean;
  help?: string;
}

export interface ServiceMeta {
  slug: string;
  name: string;
  category: string;
  color: string;
  description: string;
  authType: "api-key" | "oauth2" | "basic" | "token";
  credentialFields: ServiceCredentialField[];
  pollIntervalMinutes: number;
}

export const SERVICE_META: Record<string, ServiceMeta> = {
  "microsoft-365": {
    slug: "microsoft-365",
    name: "Microsoft 365",
    category: "Identity / Licensing",
    color: "#0078d4",
    description: "Users, licenses, groups, and mailboxes from Microsoft 365 / Entra ID.",
    authType: "oauth2",
    pollIntervalMinutes: 15,
    credentialFields: [
      { key: "tenantId",     label: "Tenant ID",           placeholder: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx", type: "text",     required: true,  help: "Azure Active Directory tenant ID" },
      { key: "clientId",     label: "Client ID (App ID)",  placeholder: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx", type: "text",     required: true,  help: "Azure App Registration client ID" },
      { key: "clientSecret", label: "Client Secret",       placeholder: "your-client-secret-value",             type: "password", required: true,  help: "App registration client secret value" },
    ],
  },
  "halopsa": {
    slug: "halopsa",
    name: "HaloPSA",
    category: "PSA",
    color: "#e05a00",
    description: "Tickets, clients, assets, contracts, and SLAs from HaloPSA.",
    authType: "oauth2",
    pollIntervalMinutes: 15,
    credentialFields: [
      { key: "tenantUrl",    label: "Tenant URL",    placeholder: "https://yourcompany.halopsa.com", type: "url",      required: true,  help: "Your HaloPSA instance URL" },
      { key: "clientId",     label: "Client ID",     placeholder: "your-client-id",                 type: "text",     required: true  },
      { key: "clientSecret", label: "Client Secret", placeholder: "your-client-secret",             type: "password", required: true  },
    ],
  },
  "ninjarmm": {
    slug: "ninjarmm",
    name: "NinjaRMM",
    category: "RMM",
    color: "#00b4d8",
    description: "Devices, alerts, policies, and patch status from NinjaRMM.",
    authType: "oauth2",
    pollIntervalMinutes: 10,
    credentialFields: [
      { key: "clientId",     label: "Client ID",     placeholder: "your-ninja-client-id",     type: "text",     required: true,  help: "From NinjaRMM Administration > Apps > API" },
      { key: "clientSecret", label: "Client Secret", placeholder: "your-ninja-client-secret", type: "password", required: true  },
      { key: "region",       label: "Region Host",   placeholder: "app.ninjarmm.com",         type: "text",     required: false, help: "Instance hostname (default: app.ninjarmm.com)" },
    ],
  },
  "threatlocker": {
    slug: "threatlocker",
    name: "ThreatLocker",
    category: "Security",
    color: "#a855f7",
    description: "Application allow-listing, ringfencing policies, and audit events from ThreatLocker.",
    authType: "api-key",
    pollIntervalMinutes: 15,
    credentialFields: [
      { key: "apiKey",    label: "API Key",    placeholder: "your-threatlocker-api-key", type: "password", required: true, help: "Found in ThreatLocker Portal > Administration > API" },
      { key: "uniqueKey", label: "Unique ID",  placeholder: "your-unique-id",            type: "text",     required: true, help: "Organization unique key from ThreatLocker portal" },
    ],
  },
  "todyl": {
    slug: "todyl",
    name: "Todyl",
    category: "Security / SASE",
    color: "#10b981",
    description: "SASE policies, network events, and endpoint security data from Todyl.",
    authType: "api-key",
    pollIntervalMinutes: 15,
    credentialFields: [
      { key: "apiKey", label: "API Key",        placeholder: "your-todyl-api-key", type: "password", required: true,  help: "From Todyl Platform > Settings > API Tokens" },
      { key: "orgId",  label: "Organization ID", placeholder: "your-org-id",       type: "text",     required: false, help: "Todyl partner organization ID (optional)" },
    ],
  },
  "quickbooks": {
    slug: "quickbooks",
    name: "QuickBooks",
    category: "Accounting",
    color: "#2ca01c",
    description: "Invoices, customers, and financial data from QuickBooks Online.",
    authType: "oauth2",
    pollIntervalMinutes: 60,
    credentialFields: [
      { key: "clientId",     label: "Client ID",              placeholder: "your-qb-client-id",     type: "text",     required: true, help: "From Intuit Developer Portal" },
      { key: "clientSecret", label: "Client Secret",          placeholder: "your-qb-client-secret", type: "password", required: true },
      { key: "realmId",      label: "Realm ID (Company ID)",  placeholder: "1234567890",            type: "text",     required: true, help: "QuickBooks Online company ID" },
    ],
  },
  "pax8": {
    slug: "pax8",
    name: "Pax8",
    category: "Licensing / Distribution",
    color: "#ff5c35",
    description: "Subscriptions, renewals, product catalog, and partner data from Pax8.",
    authType: "oauth2",
    pollIntervalMinutes: 30,
    credentialFields: [
      { key: "clientId",     label: "Client ID",     placeholder: "your-pax8-client-id",     type: "text",     required: true, help: "From Pax8 Partner Portal > Developer > API Clients" },
      { key: "clientSecret", label: "Client Secret", placeholder: "your-pax8-client-secret", type: "password", required: true },
    ],
  },
  "datto": {
    slug: "datto",
    name: "Datto BCDR",
    category: "Backup / BDR",
    color: "#f59e0b",
    description: "Backup jobs, device health, recovery points, and alerts from Datto BCDR.",
    authType: "basic",
    pollIntervalMinutes: 15,
    credentialFields: [
      { key: "apiUrl",    label: "API URL",     placeholder: "https://api.datto.com",  type: "url",      required: true,  help: "Datto API base URL" },
      { key: "publicKey", label: "Public Key",  placeholder: "your-public-key",        type: "text",     required: true,  help: "Datto partner public API key" },
      { key: "secretKey", label: "Secret Key",  placeholder: "your-secret-key",        type: "password", required: true,  help: "Datto partner secret key" },
    ],
  },
  "auvik": {
    slug: "auvik",
    name: "Auvik",
    category: "Network Management",
    color: "#3b82f6",
    description: "Network topology, device inventory, and traffic data from Auvik.",
    authType: "basic",
    pollIntervalMinutes: 15,
    credentialFields: [
      { key: "email",  label: "Username (Email)", placeholder: "user@yourcompany.com",  type: "text",     required: true, help: "Auvik account email address" },
      { key: "apiKey", label: "API Key",          placeholder: "your-auvik-api-key",   type: "password", required: true, help: "From Auvik > Profile > API Access" },
    ],
  },
  "pulseway": {
    slug: "pulseway",
    name: "Pulseway",
    category: "RMM / PSA",
    color: "#ef4444",
    description: "Remote monitoring, device management, and PSA ticketing from Pulseway.",
    authType: "api-key",
    pollIntervalMinutes: 10,
    credentialFields: [
      { key: "apiToken",   label: "API Token",   placeholder: "your-pulseway-api-token", type: "password", required: true,  help: "From Pulseway WebApp > Account > API Access" },
      { key: "subdomain",  label: "Subdomain",   placeholder: "yourcompany",             type: "text",     required: false, help: "Custom subdomain for dedicated instances (optional)" },
    ],
  },
  "cove": {
    slug: "cove",
    name: "Cove Data Protection",
    category: "Backup / Cloud",
    color: "#0ea5e9",
    description: "Backup status, recovery points, and policy compliance from N-able Cove.",
    authType: "basic",
    pollIntervalMinutes: 30,
    credentialFields: [
      { key: "username", label: "Partner Username", placeholder: "partner@yourcompany.com",      type: "text",     required: true  },
      { key: "password", label: "Partner Password", placeholder: "your-password",               type: "password", required: true  },
      { key: "apiUrl",   label: "API Endpoint",     placeholder: "https://api.backup.management", type: "url",    required: false, help: "Optional custom API endpoint" },
    ],
  },
};

export function getServiceMeta(slug: string): ServiceMeta | undefined {
  return SERVICE_META[slug];
}

export const SERVICE_SLUGS = Object.keys(SERVICE_META);
