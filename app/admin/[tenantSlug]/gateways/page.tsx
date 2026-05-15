import { eq } from "drizzle-orm";
import { GatewayForm } from "@/presentation/admin/GatewayForm";
import { db } from "@/infrastructure/db/client";
import { tenantGateways, tenants } from "@/infrastructure/db/schema";

type Props = { params: Promise<{ tenantSlug: string }> };

export default async function AdminGatewaysPage({ params }: Props) {
  const { tenantSlug } = await params;
  const [tenant] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.slug, tenantSlug))
    .limit(1);

  const rows = tenant
    ? await db
        .select()
        .from(tenantGateways)
        .where(eq(tenantGateways.tenantId, tenant.id))
    : [];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Gateways BYOG</h1>
        <p className="mt-1 text-zinc-600">
          Chaves do tenant — criptografadas com AES-256-GCM. A plataforma nunca
          recebe % das vendas.
        </p>
      </div>

      {rows.length > 0 ? (
        <ul className="rounded-xl border border-zinc-200 bg-white divide-y divide-zinc-100">
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
