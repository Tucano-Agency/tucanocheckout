import { eq } from "drizzle-orm";
import type { PaymentOrchestrator } from "@/application/payment/PaymentOrchestrator";
import type { SubscribeBody } from "@/application/checkout/subscribe.schema";
import type { CheckoutFailure } from "@/application/checkout/checkout-types";
import {
  isSubscriptionLoadFailure,
  loadOfferSubscriptionContext,
  resolveGatewayPlanId,
} from "@/application/checkout/checkout-subscription";
import { isPostgresUniqueViolation } from "@/infrastructure/db/postgres-errors";
import { resolveGatewayProvider } from "@/application/checkout/checkout-order";
import { asIdempotencyKey } from "@/domain/payment/payment.types";
import type { Database } from "@/infrastructure/db/client";
import {
  customers,
  subscriptions,
  transactions,
} from "@/infrastructure/db/schema";

export type SubscribeOfferSuccess = {
  readonly ok: true;
  readonly subscriptionId: string;
  readonly status: "active" | "trialing" | "incomplete";
  readonly gatewaySubscriptionId: string;
  readonly gatewayProvider: "pagarme" | "asaas";
  readonly replay: boolean;
};

export type SubscribeOfferResult = SubscribeOfferSuccess | CheckoutFailure;

export async function subscribeOffer(
  db: Database,
  createOrchestrator: (tenantId: string) => PaymentOrchestrator,
  body: SubscribeBody,
  remoteIp?: string | null,
): Promise<SubscribeOfferResult> {
  const loaded = await loadOfferSubscriptionContext(db, body.offerId);
  if (isSubscriptionLoadFailure(loaded)) return loaded;

  const { offer, plan, tenant } = loaded;
  const orchestrator = createOrchestrator(tenant.id);
  const txKey = `${body.idempotencyKey}:subscription`;

  const [existingTx] = await db
    .select()
    .from(transactions)
    .where(eq(transactions.idempotencyKey, txKey))
    .limit(1);

  if (existingTx?.status === "succeeded" && existingTx.subscriptionId) {
    const [sub] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.id, existingTx.subscriptionId))
      .limit(1);
    if (sub) {
      return {
        ok: true,
        subscriptionId: sub.id,
        status:
          sub.status === "trialing"
            ? "trialing"
            : sub.status === "active"
              ? "active"
              : "incomplete",
        gatewaySubscriptionId: sub.gatewaySubscriptionId,
        gatewayProvider: sub.gatewayProvider,
        replay: true,
      };
    }
  }

  if (existingTx?.status === "failed") {
    return {
      ok: false,
      httpStatus: 409,
      code: "subscription_failed",
      message:
        existingTx.failureReason ??
        "Assinatura anterior falhou para esta chave de idempotência.",
    };
  }

  const gatewayProvider = await resolveGatewayProvider(
    orchestrator,
    tenant.id,
    "card",
    offer.currency,
  );

  const gatewayPlanId = resolveGatewayPlanId(plan, gatewayProvider);
  if (gatewayProvider === "pagarme" && !gatewayPlanId) {
    return {
      ok: false,
      httpStatus: 400,
      code: "gateway_plan_missing",
      message:
        "Configure `plans.gateway_plan_refs.pagarme` com o ID do plano no Pagar.me.",
    };
  }

  const [cust] = await db
    .insert(customers)
    .values({
      tenantId: tenant.id,
      email: body.customer.email,
      name: body.customer.name,
      phone: body.customer.phone,
      document: body.customer.document,
    })
    .onConflictDoUpdate({
      target: [customers.tenantId, customers.email],
      set: {
        name: body.customer.name,
        document: body.customer.document,
        updatedAt: new Date(),
        ...(body.customer.phone ? { phone: body.customer.phone } : {}),
      },
    })
    .returning();

  const planRef = gatewayPlanId ?? `tucano:${plan.id}`;

  const gwResult = await orchestrator.createSubscription(tenant.id, {
    idempotencyKey: asIdempotencyKey(body.idempotencyKey),
    currency: offer.currency,
    planReference: planRef,
    customerReference: cust.id,
    payer: {
      email: body.customer.email,
      name: body.customer.name,
      taxId: body.customer.document,
      phone: body.customer.phone,
    },
    payment: {
      kind: "card",
      card: {
        holderName: body.card.holderName,
        number: body.card.number,
        expMonth: body.card.expMonth,
        expYear: body.card.expYear,
        cvv: body.card.cvv,
        billingAddress: body.card.billingAddress
          ? {
              line1: body.card.billingAddress.line1,
              line2: body.card.billingAddress.line2,
              city: body.card.billingAddress.city,
              region: body.card.billingAddress.region,
              postalCode: body.card.billingAddress.postalCode,
              country: body.card.billingAddress.country,
            }
          : undefined,
      },
    },
    amountMinor: offer.amountMinor,
    billingInterval: plan.interval,
    intervalCount: plan.intervalCount,
    trialDays: plan.trialDays,
    metadata: {
      ...(remoteIp ? { remoteIp } : {}),
      offerSlug: offer.publicSlug,
      planId: plan.id,
    },
  });

  if (gwResult.status === "failed" || !gwResult.subscriptionId) {
    try {
      await db.insert(transactions).values({
        tenantId: tenant.id,
        type: "subscription_create",
        status: "failed",
        paymentMethod: "card",
        amountMinor: offer.amountMinor,
        currency: offer.currency,
        gatewayProvider,
        idempotencyKey: txKey,
        failureReason: gwResult.failureMessage ?? "Falha ao criar assinatura.",
        gatewayMetadata:
          gwResult.raw && typeof gwResult.raw === "object"
            ? (gwResult.raw as Record<string, unknown>)
            : {},
      });
    } catch (e) {
      if (!isPostgresUniqueViolation(e)) throw e;
    }
    return {
      ok: false,
      httpStatus: 402,
      code: "subscription_declined",
      message: gwResult.failureMessage ?? "Assinatura não aprovada pelo gateway.",
    };
  }

  const subStatus =
    gwResult.status === "trialing"
      ? "trialing"
      : gwResult.status === "active"
        ? "active"
        : "incomplete";

  let subscriptionRow: typeof subscriptions.$inferSelect;
  try {
    const [ins] = await db
      .insert(subscriptions)
      .values({
        tenantId: tenant.id,
        customerId: cust.id,
        offerId: offer.id,
        planId: plan.id,
        gatewayProvider,
        gatewaySubscriptionId: gwResult.subscriptionId,
        status: subStatus,
        metadata: { idempotencyKey: body.idempotencyKey },
      })
      .returning();
    subscriptionRow = ins;
  } catch (e) {
    if (!isPostgresUniqueViolation(e)) throw e;
    const [sub] = await db
      .select()
      .from(subscriptions)
      .where(
        eq(subscriptions.gatewaySubscriptionId, gwResult.subscriptionId),
      )
      .limit(1);
    if (!sub) throw e;
    subscriptionRow = sub;
  }

  try {
    await db.insert(transactions).values({
      tenantId: tenant.id,
      subscriptionId: subscriptionRow.id,
      type: "subscription_create",
      status: "succeeded",
      paymentMethod: "card",
      amountMinor: offer.amountMinor,
      currency: offer.currency,
      gatewayProvider,
      gatewayChargeId: gwResult.subscriptionId,
      idempotencyKey: txKey,
      gatewayMetadata:
        gwResult.raw && typeof gwResult.raw === "object"
          ? (gwResult.raw as Record<string, unknown>)
          : {},
    });
  } catch (e) {
    if (!isPostgresUniqueViolation(e)) throw e;
  }

  return {
    ok: true,
    subscriptionId: subscriptionRow.id,
    status:
      subscriptionRow.status === "trialing"
        ? "trialing"
        : subscriptionRow.status === "active"
          ? "active"
          : "incomplete",
    gatewaySubscriptionId: subscriptionRow.gatewaySubscriptionId,
    gatewayProvider,
    replay: false,
  };
}
