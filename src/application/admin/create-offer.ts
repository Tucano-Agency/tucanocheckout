import { eq } from "drizzle-orm";
import type { Database } from "@/infrastructure/db/client";
import { offers, plans, products, tenants } from "@/infrastructure/db/schema";

export type CreateOfferInput = {
  readonly productName: string;
  readonly productDescription?: string;
  readonly publicSlug: string;
  readonly pricingMode: "one_time" | "subscription";
  readonly amountMinor: number;
  readonly currency: "BRL" | "USD" | "EUR";
  readonly planInterval?: "month" | "year";
  readonly planIntervalCount?: number;
  readonly trialDays?: number;
  readonly pagarmePlanId?: string;
};

export async function createTenantOffer(
  db: Database,
  tenantSlug: string,
  input: CreateOfferInput,
): Promise<
  | { ok: true; offerId: string; checkoutPath: string }
  | { ok: false; message: string }
> {
  const [tenant] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.slug, tenantSlug))
    .limit(1);

  if (!tenant) return { ok: false, message: "Tenant não encontrado." };

  const [product] = await db
    .insert(products)
    .values({
      tenantId: tenant.id,
      name: input.productName,
      description: input.productDescription ?? null,
      kind: "digital",
    })
    .returning();

  let planId: string | null = null;
  if (input.pricingMode === "subscription") {
    const interval = input.planInterval ?? "month";
    const [plan] = await db
      .insert(plans)
      .values({
        productId: product.id,
        name: `${input.productName} — ${interval}`,
        interval,
        intervalCount: input.planIntervalCount ?? 1,
        trialDays: input.trialDays ?? 0,
        gatewayPlanRefs: input.pagarmePlanId
          ? { pagarme: input.pagarmePlanId }
          : {},
      })
      .returning();
    planId = plan.id;
  }

  const [offer] = await db
    .insert(offers)
    .values({
      tenantId: tenant.id,
      productId: product.id,
      planId,
      pricingMode: input.pricingMode,
      amountMinor: input.amountMinor,
      currency: input.currency,
      publicSlug: input.publicSlug,
    })
    .returning();

  return {
    ok: true,
    offerId: offer.id,
    checkoutPath: `/checkout/${tenantSlug}/${input.publicSlug}`,
  };
}
