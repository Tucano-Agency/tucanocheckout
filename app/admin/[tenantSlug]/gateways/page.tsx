import { eq } from "drizzle-orm";
import { getTenantBySlugCached } from "@/application/admin/get-tenant-by-slug-cached";
import { GatewayForm } from "@/presentation/admin/GatewayForm";
import { AdminPageHeader } from "@/presentation/admin/AdminPageHeader";
import { db } from "@/infrastructure/db/client";
import { tenantGateways } from "@/infrastructure/db/schema";

type Props = { params: Promise<{ tenantSlug: string }> };

export default async function AdminGatewaysPage({ params }: Props) {
  const { tenantSlug } = await params;
  const tenant = await getTenantBySlugCached(tenantSlug);

  const rows = tenant
    ? await db
        .select()
        .from(tenantGateways)
        .where(eq(tenantGateways.tenantId, tenant.id))
    : [];

  return (
    <div className="space-y-10">
      <AdminPageHeader
        title="Gateways BYOG"
        description={
          <>
            Chaves do tenant criptografadas (AES-256-GCM). Você usa seu próprio
            Asaas ou Pagar.me — a plataforma não fica com percentual das vendas.
          </>
        }
      />

      {rows.length > 0 ? (
        <ul className="divide-y divide-zinc-100 overflow-hidden rounded-2xl border border-zinc-200/90 bg-white shadow-sm ring-1 ring-zinc-100">
          {rows.map((g) => (
            <li key={g.id} className="flex items-center justify-between px-4 py-3 text-sm">
              <span className="font-medium capitalize">{g.provider}</span>
              <span className="text-zinc-500">
                {g.isDefault ? "Padrão · " : ""}
                {(g.supportedCurrencies ?? []).join(", ") || "BRL"}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      <GatewayForm tenantSlug={tenantSlug} />
    </div>
  );
}
