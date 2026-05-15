import type { PaymentOrchestrator } from "@/application/payment/PaymentOrchestrator";
import type { ChargeCardBody } from "@/application/checkout/charge-card.schema";
import type { CheckoutFailure, CheckoutPaymentSuccess } from "@/application/checkout/checkout-types";
import {
  ensureCheckoutOrder,
  findExistingTransaction,
  isCheckoutFailure,
  loadOfferCheckoutContext,
  persistPaymentOutcome,
  resolveGatewayProvider,
} from "@/application/checkout/checkout-order";
import { asIdempotencyKey } from "@/domain/payment/payment.types";
import type { Database } from "@/infrastructure/db/client";

export type ChargeOfferCardResult = CheckoutPaymentSuccess | CheckoutFailure;

export async function chargeOfferCard(
  db: Database,
  createOrchestrator: (tenantId: string) => PaymentOrchestrator,
  body: ChargeCardBody,
  remoteIp?: string | null,
): Promise<ChargeOfferCardResult> {
  const loaded = await loadOfferCheckoutContext(db, body.offerId);
  if (isCheckoutFailure(loaded)) return loaded;
  const { offer, tenant } = loaded;
  const orchestrator = createOrchestrator(tenant.id);
  const txIdempotencyKey = `${body.idempotencyKey}:card`;

  const existing = await findExistingTransaction(db, txIdempotencyKey);
  if (existing.kind === "replay") return existing.result;
  if (existing.kind === "failed") return existing.failure;

  const orderResult = await ensureCheckoutOrder(db, loaded, {
    idempotencyKey: body.idempotencyKey,
    customer: body.customer,
    remoteIp,
  });
  if (orderResult.kind === "replay") return orderResult.result;
  if (orderResult.kind === "failed") return orderResult.failure;

  const order = orderResult.order;
  const gatewayProvider = await resolveGatewayProvider(
    orchestrator,
    tenant.id,
    "card",
    offer.currency,
  );

  const gwResult = await orchestrator.chargeCard(tenant.id, {
    idempotencyKey: asIdempotencyKey(body.idempotencyKey),
    amount: { amountMinor: offer.amountMinor, currency: offer.currency },
    customerReference: order.customerId!,
    payer: {
      email: body.customer.email,
      name: body.customer.name,
      taxId: body.customer.document,
      phone: body.customer.phone,
    },
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
    metadata: {
      ...(remoteIp ? { remoteIp } : {}),
      itemCode: offer.publicSlug,
      itemDescription: `Oferta ${offer.publicSlug}`,
      statementDescriptor: "TUCANO",
    },
  });

  let orderStatus: "paid" | "pending_payment" | "failed" = "pending_payment";
  let txStatus: "succeeded" | "failed" | "pending" | "processing" = "pending";
  let failureReason: string | null = null;

  if (gwResult.status === "succeeded") {
    orderStatus = "paid";
    txStatus = "succeeded";
  } else if (gwResult.status === "pending") {
    orderStatus = "pending_payment";
    txStatus = "processing";
  } else {
    orderStatus = "failed";
    txStatus = "failed";
    failureReason = gwResult.failureMessage;
  }

  const chargeId =
    gwResult.status === "succeeded" || gwResult.status === "pending"
      ? gwResult.chargeId
      : undefined;

  return persistPaymentOutcome(db, {
    tenantId: tenant.id,
    orderId: order.id,
    offerAmountMinor: offer.amountMinor,
    offerCurrency: offer.currency,
    gatewayProvider,
    txIdempotencyKey,
    txType: "card_charge",
    paymentMethod: "card",
    orderStatus,
    txStatus,
    chargeId,
    failureReason,
    gatewayMetadata:
      "raw" in gwResult && gwResult.raw
        ? (gwResult.raw as Record<string, unknown>)
        : {},
  });
}
