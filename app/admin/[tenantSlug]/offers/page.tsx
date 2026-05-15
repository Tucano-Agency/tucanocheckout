import Link from "next/link";
import { eq } from "drizzle-orm";
import { getTenantBySlugCached } from "@/application/admin/get-tenant-by-slug-cached";
import { formatMoney } from "@/lib/format-money";
import { OfferForm } from "@/presentation/admin/OfferForm";
import { AdminPageHeader } from "@/presentation/admin/AdminPageHeader";
import { db } from "@/infrastructure/db/client";
import { offers, products } from "@/infrastructure/db/schema";

type Props = { params: Promise<{ tenantSlug: string }> };

export default async function AdminOffersPage({ params }: Props) {
  const { tenantSlug } = await params;
  const tenant = await getTenantBySlugCached(tenantSlug);

  const rows = tenant
    ? await db
        .select({ offer: offers, product: products })
        .from(offers)
        .innerJoin(products, eq(offers.productId, products.id))
        .where(eq(offers.tenantId, tenant.id))
    : [];

  return (
    <div className="space-y-10">
      <AdminPageHeader
        title="Ofertas"
        description={
          <>
            Cada oferta publica um link{" "}
            <code className="rounded-md bg-zinc-100 px-1.5 py-0.5 font-mono text-[13px] text-zinc-800">
              /checkout/{tenantSlug}/[slug]
            </code>
            .
          </>
        }
      />

      {rows.length > 0 ? (
        <ul className="space-y-3">
          {rows.map(({ offer, product }) => (
            <li
              key={offer.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-zinc-200/90 bg-white px-5 py-4 shadow-sm ring-1 ring-zinc-100"
            >
              <div>
                <p className="font-medium text-zinc-900">{product.name}</p>
                <p className="text-sm text-zinc-500">
                  {offer.pricingMode === "subscription" ? "Assinatura" : "Avulso"}{" "}
                  · {formatMoney(offer.amountMinor, offer.currency)}
                </p>
              </div>
              <Link
                href={`/checkout/${tenantSlug}/${offer.publicSlug}`}
                target="_blank"
                className="text-sm font-medium text-emerald-700 hover:underline"
              >
                Abrir checkout →
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-zinc-500">Nenhuma oferta ainda.</p>
      )}

      <section className="border-t border-zinc-200 pt-8">
        <h2 className="text-lg font-semibold text-zinc-900">Nova oferta</h2>
        <div className="mt-4">
          <OfferForm tenantSlug={tenantSlug} />
        </div>
      </section>
    </div>
  );
}
