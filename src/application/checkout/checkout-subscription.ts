import { and, eq } from "drizzle-orm";
import {
  checkoutFail,
  type CheckoutFailure,
} from "@/application/checkout/checkout-types";
import type { Database } from "@/infrastructure/db/client";
import { offers, plans, tenants } from "@/infrastructure/db/schema";

export type SubscriptionOfferContext = {
  readonly offer: typeof offers.$inferSelect;
  readonly plan: typeof plans.$inferSelect;
  readonly tenant: typeof tenants.$inferSelect;
};

export type LoadedSubscriptionContext =
  | SubscriptionOfferContext
  | CheckoutFailure;

export function isSubscriptionLoadFailure(
  v: LoadedSubscriptionContext,
): v is CheckoutFailure {
  return "ok" in v && v.ok === false;
}

export async function loadOfferSubscriptionContext(
  db: Database,
  offerId: string,
): Promise<LoadedSubscriptionContext> {
  const [row] = await db
    .select({
      offer: offers,
      plan: plans,
      tenant: tenants,
    })
    .from(offers)
    .innerJoin(tenants, eq(offers.tenantId, tenants.id))
    .innerJoin(plans, eq(offers.planId, plans.id))
    .where(
      and(
        eq(offers.id, offerId),
        eq(offers.isActive, true),
        eq(plans.isActive, true),
      ),
    )
    .limit(1);

  if (!row) {
    return checkoutFail(404, "offer_not_found", "Oferta ou plano inexistente.");
  }

  if (
    row.tenant.platformSubscriptionStatus === "suspended_due_to_billing" ||
    row.tenant.platformSubscriptionStatus === "cancelled"
  ) {
    return checkoutFail(
      403,
      "tenant_blocked",
      "Conta do produtor indisponível para checkout.",
    );
  }

  if (row.offer.pricingMode !== "subscription" || !row.offer.planId) {
    return checkoutFail(
      400,
      "offer_not_subscription",
      "Esta oferta não é uma assinatura.",
    );
  }

  return row;
}

export function resolveGatewayPlanId(
  plan: typeof plans.$inferSelect,
  provider: "pagarme" | "asaas",
): string | null {
  const refs = plan.gatewayPlanRefs ?? {};
  const id = refs[provider];
  return typeof id === "string" && id.length > 0 ? id : null;
}
