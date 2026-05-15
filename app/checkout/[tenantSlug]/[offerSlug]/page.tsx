import { notFound } from "next/navigation";
import { getPublicOfferBySlugs } from "@/application/checkout/get-public-offer";
import { db } from "@/infrastructure/db/client";
import { CheckoutForm } from "@/presentation/checkout/CheckoutForm";
import { formatMoney, planIntervalLabel } from "@/lib/format-money";

type PageProps = {
  params: Promise<{ tenantSlug: string; offerSlug: string }>;
};

export async function generateMetadata({ params }: PageProps) {
  try {
    const { tenantSlug, offerSlug } = await params;
    const offer = await getPublicOfferBySlugs(db, tenantSlug, offerSlug);
    if (!offer) return { title: "Checkout — Tucano" };
    return {
      title: `${offer.productName} — ${offer.tenantName}`,
      description: offer.productDescription ?? `Checkout ${offer.productName}`,
    };
  } catch {
    return { title: "Checkout — Tucano" };
  }
}

export default async function CheckoutOfferPage({ params }: PageProps) {
  const { tenantSlug, offerSlug } = await params;
  let offer;
  try {
    offer = await getPublicOfferBySlugs(db, tenantSlug, offerSlug);
  } catch (err) {
    console.error("[checkout] falha ao carregar oferta:", err);
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-zinc-50 px-6">
        <div className="max-w-md rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
          <p className="font-semibold text-red-900">
            Erro ao conectar ao banco de dados
          </p>
          <p className="mt-2 text-sm text-red-800">
            Confira na Vercel se{" "}
            <code className="rounded bg-red-100 px-1">DATABASE_URL</code> está
            correta (senha com caracteres especiais deve estar codificada na
            URI), se o deploy foi refeito após salvar variáveis e os logs da
            função na aba Observability.
          </p>
        </div>
      </div>
    );
  }

  if (!offer) notFound();

  const price = formatMoney(offer.amountMinor, offer.currency);
  const isSubscription = offer.pricingMode === "subscription";

  return (
    <div className="min-h-dvh bg-gradient-to-b from-zinc-50 via-white to-emerald-50/40">
      <header className="border-b border-zinc-200/80 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-lg items-center justify-between px-4 py-4">
          <span className="text-sm font-semibold tracking-tight text-emerald-800">
            Tucano Checkout
          </span>
          <span className="text-xs text-zinc-500">{offer.tenantName}</span>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 py-8">
        <article className="mb-8">
          <p className="text-sm font-medium text-emerald-700">
            {isSubscription ? "Assinatura" : "Compra segura"}
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-zinc-900">
            {offer.productName}
          </h1>
          {offer.productDescription ? (
            <p className="mt-2 text-zinc-600">{offer.productDescription}</p>
          ) : null}
          <div className="mt-6 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-zinc-900">{price}</span>
            {offer.plan ? (
              <span className="text-sm text-zinc-500">
                {planIntervalLabel(
                  offer.plan.interval,
                  offer.plan.intervalCount,
                )}
              </span>
            ) : null}
          </div>
          {offer.plan && offer.plan.trialDays > 0 ? (
            <p className="mt-2 text-sm text-emerald-700">
              {offer.plan.trialDays} dias grátis para começar
            </p>
          ) : null}
        </article>

        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-xl shadow-zinc-200/50">
          <CheckoutForm offer={offer} />
        </div>
      </main>
    </div>
  );
}
