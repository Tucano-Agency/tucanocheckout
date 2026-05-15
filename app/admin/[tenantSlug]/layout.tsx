import type { ReactNode } from "react";
import { AdminAppShell } from "@/presentation/admin/AdminAppShell";
import { requireAdminForTenant } from "@/lib/require-admin";
import { getTenantBySlugCached } from "@/application/admin/get-tenant-by-slug-cached";

type Props = {
  children: ReactNode;
  params: Promise<{ tenantSlug: string }>;
};

export default async function AdminTenantLayout({ children, params }: Props) {
  const { tenantSlug } = await params;
  await requireAdminForTenant(tenantSlug);

  const tenant = await getTenantBySlugCached(tenantSlug);

  return (
    <AdminAppShell
      tenantSlug={tenantSlug}
      tenantName={tenant?.name ?? tenantSlug}
    >
      {children}
    </AdminAppShell>
  );
}
