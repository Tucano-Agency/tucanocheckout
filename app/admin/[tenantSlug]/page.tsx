import Link from "next/link";
import { eq } from "drizzle-orm";
import { db } from "@/infrastructure/db/client";
import { offers, tenantGateways } from "@/infrastructure/db/schema";
import { tenants } from "@/infrastructure/db/schema";

type Props = { params: Promise<{ tenantSlug: string }> };

export default async function AdminDashboardPage({ params }: Props) {
  const { tenantSlug } = await params;
  const [tenant] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.slug, tenantSlug))
    .limit(1);

  if (!tenant) return null;

  const gatewayRows = await db
    .select()
    .from(tenantGateways)
    .where(eq(tenantGateways.tenantId, tenant.id));

  const offerRows = await db
    .select()
    .from(offers)
    .where(eq(offers.tenantId, tenant.id));

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-2xl font-bold text-zinc-900">Visão geral</h1>
        <p className="mt-1 text-zinc-600">
          Configure gateways BYOG e publique links de checkout.
        </p>
      </section>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-zinc-200 bg-white p-6">
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
        <div className="rounded-2xl border border-zinc-200 bg-white p-6">
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
