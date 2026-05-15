import { and, eq } from "drizzle-orm";
import type { Database } from "@/infrastructure/db/client";
import { offers, plans, products, tenants } from "@/infrastructure/db/schema";
import { withDbRetry } from "@/lib/db-retry";

export type PublicOfferView = {
  readonly offerId: string;
  readonly tenantSlug: string;
  readonly tenantName: string;
  readonly productName: string;
  readonly productDescription: string | null;
  readonly publicSlug: string;
  readonly pricingMode: "one_time" | "subscription";
  readonly amountMinor: number;
  readonly currency: "BRL" | "USD" | "EUR";
  readonly plan: {
    readonly interval: "day" | "week" | "month" | "year";
    readonly intervalCount: number;
    readonly trialDays: number;
  } | null;
};

export async function getPublicOfferBySlugs(
  db: Database,
  tenantSlug: string,
  offerSlug: string,
): Promise<PublicOfferView | null> {
  const [row] = await withDbRetry(() =>
    db
      .select({
        offer: offers,
        tenant: tenants,
        product: products,
        plan: plans,
      })
      .from(offers)
      .innerJoin(tenants, eq(offers.tenantId, tenants.id))
      .innerJoin(products, eq(offers.productId, products.id))
      .leftJoin(plans, eq(offers.planId, plans.id))
      .where(
        and(
          eq(tenants.slug, tenantSlug),
          eq(offers.publicSlug, offerSlug),
          eq(offers.isActive, true),
          eq(products.isActive, true),
        ),
      )
      .limit(1),
  );

  if (!row) return null;

  if (
    row.tenant.platformSubscriptionStatus === "suspended_due_to_billing" ||
    row.tenant.platformSubscriptionStatus === "cancelled"
  ) {
    return null;
  }

  return {
    offerId: row.offer.id,
    tenantSlug: row.tenant.slug,
    tenantName: row.tenant.name,
    productName: row.product.name,
    productDescription: row.product.description,
    publicSlug: row.offer.publicSlug,
    pricingMode: row.offer.pricingMode,
    amountMinor: row.offer.amountMinor,
    currency: row.offer.currency,
    plan:
      row.plan && row.offer.pricingMode === "subscription"
        ? {
            interval: row.plan.interval,
            intervalCount: row.plan.intervalCount,
            trialDays: row.plan.trialDays,
          }
        : null,
  };
}
