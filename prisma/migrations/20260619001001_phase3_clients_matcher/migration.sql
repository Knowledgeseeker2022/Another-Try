-- AlterTable
ALTER TABLE "OrgDomainAuth" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "OrgMatchSuggestion" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Organization" ALTER COLUMN "domains" DROP DEFAULT;

-- AlterTable
ALTER TABLE "SsoTenant" ALTER COLUMN "provider" SET DEFAULT 'microsoft-entra-id';
