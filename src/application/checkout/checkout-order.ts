import { and, eq } from "drizzle-orm";
import type { PaymentOrchestrator } from "@/application/payment/PaymentOrchestrator";
import {
  checkoutFail,
  type CheckoutFailure,
  type CheckoutPaymentSuccess,
} from "@/application/checkout/checkout-types";
import type { Database } from "@/infrastructure/db/client";
import { isPostgresUniqueViolation } from "@/infrastructure/db/postgres-errors";
import {
  customers,
  offers,
  orders,
  tenants,
  transactions,
} from "@/infrastructure/db/schema";

export type OfferCheckoutContext = {
  readonly offer: typeof offers.$inferSelect;
  readonly tenant: typeof tenants.$inferSelect;
};

export type LoadedOfferContext = OfferCheckoutContext | CheckoutFailure;

export function isCheckoutFailure(
  v: LoadedOfferContext,
): v is CheckoutFailure {
  return "ok" in v && v.ok === false;
}

export type CustomerInput = {
  readonly email: string;
  readonly name: string;
  readonly phone?: string;
  readonly document: string;
};

export async function loadOfferCheckoutContext(
  db: Database,
  offerId: string,
): Promise<LoadedOfferContext> {
  const [ctx] = await db
    .select({ offer: offers, tenant: tenants })
    .from(offers)
    .innerJoin(tenants, eq(offers.tenantId, tenants.id))
    .where(and(eq(offers.id, offerId), eq(offers.isActive, true)))
    .limit(1);

  if (!ctx) {
    return checkoutFail(404, "offer_not_found", "Oferta inexistente ou inativa.");
  }

  if (
    ctx.tenant.platformSubscriptionStatus === "suspended_due_to_billing" ||
    ctx.tenant.platformSubscriptionStatus === "cancelled"
  ) {
    return checkoutFail(
      403,
      "tenant_blocked",
      "Conta do produtor indisponível para checkout.",
    );
  }

  if (ctx.offer.pricingMode !== "one_time") {
    return checkoutFail(
      400,
      "offer_not_one_time",
      "Esta oferta exige fluxo de assinatura; endpoint válido apenas para compra avulsa.",
    );
  }

  return ctx;
}

export function replayFromTransaction(
  tx: typeof transactions.$inferSelect,
  order: typeof orders.$inferSelect | undefined,
): CheckoutPaymentSuccess | null {
  if (tx.status === "succeeded") {
    return {
      ok: true,
      orderId: order?.id ?? tx.orderId ?? "",
      status: "paid",
      chargeId: tx.gatewayChargeId ?? undefined,
      gatewayProvider: tx.gatewayProvider,
      replay: true,
    };
  }
  if (tx.status === "pending" || tx.status === "processing") {
    return {
      ok: true,
      orderId: order?.id ?? tx.orderId ?? "",
      status: "pending_payment",
      chargeId: tx.gatewayChargeId ?? undefined,
      gatewayProvider: tx.gatewayProvider,
      replay: true,
    };
  }
  if (tx.status === "failed") {
    return null;
  }
  return null;
}

export async function findExistingTransaction(
  db: Database,
  txIdempotencyKey: string,
): Promise<
  | { kind: "replay"; result: CheckoutPaymentSuccess }
  | { kind: "failed"; failure: CheckoutFailure }
  | { kind: "none" }
> {
  const [existingTx] = await db
    .select()
    .from(transactions)
    .where(eq(transactions.idempotencyKey, txIdempotencyKey))
    .limit(1);

  if (!existingTx) return { kind: "none" };

  const [ord] = existingTx.orderId
    ? await db
        .select()
        .from(orders)
        .where(eq(orders.id, existingTx.orderId))
        .limit(1)
    : [];

  const replay = replayFromTransaction(existingTx, ord);
  if (replay) return { kind: "replay", result: replay };

  if (existingTx.status === "failed") {
    return {
      kind: "failed",
      failure: checkoutFail(
        409,
        "transaction_failed",
        existingTx.failureReason ?? "Cobrança anterior falhou para esta chave.",
      ),
    };
  }

  return { kind: "none" };
}

export async function ensureCheckoutOrder(
  db: Database,
  ctx: OfferCheckoutContext,
  body: {
    idempotencyKey: string;
    customer: CustomerInput;
    remoteIp?: string | null;
  },
): Promise<
  | { kind: "ok"; order: typeof orders.$inferSelect }
  | { kind: "replay"; result: CheckoutPaymentSuccess }
  | { kind: "failed"; failure: CheckoutFailure }
> {
  let [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.idempotencyKey, body.idempotencyKey))
    .limit(1);

  if (!order) {
    const [cust] = await db
      .insert(customers)
      .values({
        tenantId: ctx.tenant.id,
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

    try {
      const [ins] = await db
        .insert(orders)
        .values({
          tenantId: ctx.tenant.id,
          customerId: cust.id,
          offerId: ctx.offer.id,
          status: "pending_payment",
          currency: ctx.offer.currency,
          subtotalAmountMinor: ctx.offer.amountMinor,
          totalAmountMinor: ctx.offer.amountMinor,
          idempotencyKey: body.idempotencyKey,
          metadata: { remoteIp: body.remoteIp ?? null },
        })
        .returning();
      order = ins;
    } catch (e) {
      if (!isPostgresUniqueViolation(e)) throw e;
      const [o2] = await db
        .select()
        .from(orders)
        .where(eq(orders.idempotencyKey, body.idempotencyKey))
        .limit(1);
      order = o2;
    }
  }

  if (!order) {
    return {
      kind: "failed",
      failure: checkoutFail(
        500,
        "order_missing",
        "Não foi possível criar ou recuperar o pedido.",
      ),
    };
  }

  if (order.status === "paid") {
    const [tx] = await db
      .select()
      .from(transactions)
      .where(
        and(
          eq(transactions.orderId, order.id),
          eq(transactions.status, "succeeded"),
        ),
      )
      .limit(1);
    return {
      kind: "replay",
      result: {
        ok: true,
        orderId: order.id,
        status: "paid",
        chargeId: tx?.gatewayChargeId ?? undefined,
        gatewayProvider: tx?.gatewayProvider ?? "pagarme",
        replay: true,
      },
    };
  }

  if (order.status === "failed") {
    return {
      kind: "failed",
      failure: checkoutFail(
        409,
        "order_failed",
        "Pedido já falhou com esta chave de idempotência; gere uma nova chave para tentar de novo.",
      ),
    };
  }

  if (!order.customerId) {
    return {
      kind: "failed",
      failure: checkoutFail(
        500,
        "order_invalid",
        "Pedido sem cliente associado; contate o suporte.",
      ),
    };
  }

  return { kind: "ok", order };
}

export async function persistPaymentOutcome(
  db: Database,
  input: {
    tenantId: string;
    orderId: string;
    offerAmountMinor: number;
    offerCurrency: typeof offers.$inferSelect.currency;
    gatewayProvider: "pagarme" | "asaas";
    txIdempotencyKey: string;
    txType: "card_charge" | "pix_charge";
    paymentMethod: "card" | "pix";
    orderStatus: "paid" | "pending_payment" | "failed";
    txStatus: "succeeded" | "failed" | "pending" | "processing";
    chargeId?: string;
    failureReason: string | null;
    gatewayMetadata: Record<string, unknown>;
  },
): Promise<CheckoutPaymentSuccess> {
  try {
    await db.insert(transactions).values({
      tenantId: input.tenantId,
      orderId: input.orderId,
      type: input.txType,
      status: input.txStatus,
      paymentMethod: input.paymentMethod,
      amountMinor: input.offerAmountMinor,
      currency: input.offerCurrency,
      gatewayProvider: input.gatewayProvider,
      gatewayChargeId: input.chargeId ?? null,
      idempotencyKey: input.txIdempotencyKey,
      failureReason: input.failureReason,
      gatewayMetadata: input.gatewayMetadata,
    });
  } catch (e) {
    if (!isPostgresUniqueViolation(e)) throw e;
  }

  const [finalTx] = await db
    .select()
    .from(transactions)
    .where(eq(transactions.idempotencyKey, input.txIdempotencyKey))
    .limit(1);

  await db
    .update(orders)
    .set({ status: input.orderStatus, updatedAt: new Date() })
    .where(eq(orders.id, input.orderId));

  return {
    ok: true,
    orderId: input.orderId,
    status: input.orderStatus,
    chargeId: finalTx?.gatewayChargeId ?? input.chargeId ?? undefined,
    gatewayProvider: finalTx?.gatewayProvider ?? input.gatewayProvider,
    replay: false,
  };
}

export async function resolveGatewayProvider(
  orchestrator: PaymentOrchestrator,
  tenantId: string,
  method: "card" | "pix",
  currency: OfferCheckoutContext["offer"]["currency"],
): Promise<"pagarme" | "asaas"> {
  return orchestrator.pickProviderForPayment(tenantId, method, currency);
}
