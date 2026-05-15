import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { getTenantBySlugCached } from "@/application/admin/get-tenant-by-slug-cached";
import { db } from "@/infrastructure/db/client";
import {
  customers,
  offers,
  orders,
  products,
} from "@/infrastructure/db/schema";
import { formatMoney } from "@/lib/format-money";
import { orderStatusLabelPt } from "@/lib/order-status-label";
import { AdminPageHeader } from "@/presentation/admin/AdminPageHeader";

type Props = { params: Promise<{ tenantSlug: string }> };

export default async function AdminOrdersPage({ params }: Props) {
  const { tenantSlug } = await params;
  const tenant = await getTenantBySlugCached(tenantSlug);

  if (!tenant) return null;

  const rows = await db
    .select({
      order: orders,
      offerSlug: offers.publicSlug,
      productName: products.name,
      customerEmail: customers.email,
    })
    .from(orders)
    .innerJoin(offers, eq(orders.offerId, offers.id))
    .innerJoin(products, eq(offers.productId, products.id))
    .leftJoin(customers, eq(orders.customerId, customers.id))
    .where(eq(orders.tenantId, tenant.id))
    .orderBy(desc(orders.createdAt))
    .limit(150);

  return (
    <div className="space-y-10">
      <AdminPageHeader
        title="Pedidos"
        description="Últimos pedidos originados no checkout (até 150 registros)."
      />

      {rows.length === 0 ? (
        <p className="text-sm text-zinc-500">
          Nenhum pedido ainda. Quando alguém iniciar um checkout, aparece aqui.
        </p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-zinc-200/90 bg-white shadow-sm ring-1 ring-zinc-100">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-zinc-100 text-sm">
            <thead className="bg-zinc-50/90 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-4 py-3">Data</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">Produto</th>
                <th className="px-4 py-3">Total</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {rows.map(({ order, offerSlug, productName, customerEmail }) => (
                <tr key={order.id} className="text-zinc-800">
                  <td className="whitespace-nowrap px-4 py-3 text-zinc-600">
                    {order.createdAt.toLocaleString("pt-BR", {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        order.status === "paid"
                          ? "font-medium text-emerald-700"
                          : order.status === "failed"
                            ? "font-medium text-red-700"
                            : "text-zinc-700"
                      }
                    >
                      {orderStatusLabelPt(order.status)}
                    </span>
                  </td>
                  <td className="max-w-[180px] truncate px-4 py-3 text-zinc-600">
                    {customerEmail ?? "—"}
                  </td>
                  <td className="max-w-[200px] truncate px-4 py-3">
                    {productName}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 font-medium">
                    {formatMoney(order.totalAmountMinor, order.currency)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <Link
                      href={`/checkout/${tenantSlug}/${offerSlug}`}
                      target="_blank"
                      className="text-emerald-700 hover:underline"
                    >
                      Oferta →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}
    </div>
  );
}
