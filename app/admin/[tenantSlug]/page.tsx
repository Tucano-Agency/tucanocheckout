import Link from "next/link";
import { and, count, eq } from "drizzle-orm";
import { getTenantBySlugCached } from "@/application/admin/get-tenant-by-slug-cached";
import { db } from "@/infrastructure/db/client";
import { offers, orders, tenantGateways } from "@/infrastructure/db/schema";
import { AdminPageHeader } from "@/presentation/admin/AdminPageHeader";

type Props = { params: Promise<{ tenantSlug: string }> };

export default async function AdminDashboardPage({ params }: Props) {
  const { tenantSlug } = await params;
  const tenant = await getTenantBySlugCached(tenantSlug);

  if (!tenant) return null;

  const [gatewayRows, offerRows, paidRow, pendingRow] = await Promise.all([
    db
      .select()
      .from(tenantGateways)
      .where(eq(tenantGateways.tenantId, tenant.id)),
    db.select().from(offers).where(eq(offers.tenantId, tenant.id)),
    db
      .select({ paidCount: count() })
      .from(orders)
      .where(
        and(eq(orders.tenantId, tenant.id), eq(orders.status, "paid")),
      ),
    db
      .select({ pendingCount: count() })
      .from(orders)
      .where(
        and(
          eq(orders.tenantId, tenant.id),
          eq(orders.status, "pending_payment"),
        ),
      ),
  ]);

  const paidCount = Number(paidRow[0]?.paidCount ?? 0);
  const pendingCount = Number(pendingRow[0]?.pendingCount ?? 0);

  return (
    <div className="space-y-10">
      <AdminPageHeader
        title="Visão geral"
        description="Resumo de vendas, pagamentos pendentes e configuração do seu checkout."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-zinc-200/90 bg-white p-6 shadow-sm ring-1 ring-zinc-100">
          <p className="text-sm text-zinc-500">Pedidos pagos</p>
          <p className="mt-2 text-3xl font-bold text-emerald-800">{paidCount}</p>
          <Link
            href={`/admin/${tenantSlug}/orders`}
            className="mt-4 inline-block text-sm font-medium text-emerald-700 hover:underline"
          >
            Ver lista →
          </Link>
        </div>
        <div className="rounded-2xl border border-zinc-200/90 bg-white p-6 shadow-sm ring-1 ring-zinc-100">
          <p className="text-sm text-zinc-500">Aguardando pagamento</p>
          <p className="mt-2 text-3xl font-bold text-amber-700">{pendingCount}</p>
          <Link
            href={`/admin/${tenantSlug}/orders`}
            className="mt-4 inline-block text-sm font-medium text-emerald-700 hover:underline"
          >
            Ver lista →
          </Link>
        </div>
        <div className="rounded-2xl border border-zinc-200/90 bg-white p-6 shadow-sm ring-1 ring-zinc-100">
          <p className="text-sm text-zinc-500">Gateways BYOG</p>
          <p className="mt-2 text-3xl font-bold text-zinc-900">
            {gatewayRows.length}
          </p>
          <Link
            href={`/admin/${tenantSlug}/gateways`}
            className="mt-4 inline-block text-sm font-medium text-emerald-700 hover:underline"
          >
            Configurar →
          </Link>
        </div>
        <div className="rounded-2xl border border-zinc-200/90 bg-white p-6 shadow-sm ring-1 ring-zinc-100">
          <p className="text-sm text-zinc-500">Ofertas ativas</p>
          <p className="mt-2 text-3xl font-bold text-zinc-900">
            {offerRows.filter((o) => o.isActive).length}
          </p>
          <Link
            href={`/admin/${tenantSlug}/offers`}
            className="mt-4 inline-block text-sm font-medium text-emerald-700 hover:underline"
          >
            Gerenciar →
          </Link>
        </div>
      </div>
    </div>
  );
}
