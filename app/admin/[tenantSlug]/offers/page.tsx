import Link from "next/link";
import { eq } from "drizzle-orm";
import { formatMoney } from "@/lib/format-money";
import { OfferForm } from "@/presentation/admin/OfferForm";
import { db } from "@/infrastructure/db/client";
import { offers, products, tenants } from "@/infrastructure/db/schema";

type Props = { params: Promise<{ tenantSlug: string }> };

export default async function AdminOffersPage({ params }: Props) {
  const { tenantSlug } = await params;
  const [tenant] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.slug, tenantSlug))
    .limit(1);

  const rows = tenant
    ? await db
        .select({ offer: offers, product: products })
        .from(offers)
        .innerJoin(products, eq(offers.productId, products.id))
        .where(eq(offers.tenantId, tenant.id))
    : [];

  return (
    <div className="space-y-10">
      <section>
        <h1 className="text-2xl font-bold text-zinc-900">Ofertas</h1>
        <p className="mt-1 text-zinc-600">
          Cada oferta gera um link{" "}
          <code className="text-sm">/checkout/{tenantSlug}/[slug]</code>
        </p>
      </section>

      {rows.length > 0 ? (
        <ul className="space-y-2">
          {rows.map(({ offer, product }) => (
            <li
              key={offer.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-3"
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
