import type { PaymentOrchestrator } from "@/application/payment/PaymentOrchestrator";
import type { ChargePixBody } from "@/application/checkout/charge-pix.schema";
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

export type ChargeOfferPixResult =
  | (CheckoutPaymentSuccess & {
      pix?: {
        copyPaste: string;
        qrCodeBase64?: string;
        expiresAt: string;
      };
    })
  | CheckoutFailure;

export async function chargeOfferPix(
  db: Database,
  createOrchestrator: (tenantId: string) => PaymentOrchestrator,
  body: ChargePixBody,
  remoteIp?: string | null,
): Promise<ChargeOfferPixResult> {
  const loaded = await loadOfferCheckoutContext(db, body.offerId);
  if (isCheckoutFailure(loaded)) return loaded;

  if (loaded.offer.currency !== "BRL") {
    return {
      ok: false,
      httpStatus: 400,
      code: "pix_brl_only",
      message: "PIX disponível apenas para ofertas em BRL.",
    };
  }

  const { offer, tenant } = loaded;
  const orchestrator = createOrchestrator(tenant.id);
  const txIdempotencyKey = `${body.idempotencyKey}:pix`;

  const existing = await findExistingTransaction(db, txIdempotencyKey);
  if (existing.kind === "replay") {
    return { ...existing.result, pix: undefined };
  }
  if (existing.kind === "failed") return existing.failure;

  const orderResult = await ensureCheckoutOrder(db, loaded, {
    idempotencyKey: body.idempotencyKey,
    customer: body.customer,
    remoteIp,
  });
  if (orderResult.kind === "replay") {
    return { ...orderResult.result, pix: undefined };
  }
  if (orderResult.kind === "failed") return orderResult.failure;

  const order = orderResult.order;
  const gatewayProvider = await resolveGatewayProvider(
    orchestrator,
    tenant.id,
    "pix",
    offer.currency,
  );

  const gwResult = await orchestrator.chargePix(tenant.id, {
    idempotencyKey: asIdempotencyKey(body.idempotencyKey),
    amount: { amountMinor: offer.amountMinor, currency: offer.currency },
    customerReference: order.customerId!,
    payer: {
      email: body.customer.email,
      name: body.customer.name,
      taxId: body.customer.document,
      phone: body.customer.phone,
    },
    expiresInSeconds: body.expiresInSeconds ?? 3600,
    metadata: {
      ...(remoteIp ? { remoteIp } : {}),
      itemCode: offer.publicSlug,
      itemDescription: `Oferta ${offer.publicSlug}`,
    },
  });

  if (gwResult.status === "failed") {
    return persistPaymentOutcome(db, {
      tenantId: tenant.id,
      orderId: order.id,
      offerAmountMinor: offer.amountMinor,
      offerCurrency: offer.currency,
      gatewayProvider,
      txIdempotencyKey,
      txType: "pix_charge",
      paymentMethod: "pix",
      orderStatus: "failed",
      txStatus: "failed",
      failureReason: gwResult.failureMessage ?? "Falha ao gerar PIX.",
      gatewayMetadata:
        gwResult.raw && typeof gwResult.raw === "object"
          ? (gwResult.raw as Record<string, unknown>)
          : {},
    });
  }

  const base = await persistPaymentOutcome(db, {
    tenantId: tenant.id,
    orderId: order.id,
    offerAmountMinor: offer.amountMinor,
    offerCurrency: offer.currency,
    gatewayProvider,
    txIdempotencyKey,
    txType: "pix_charge",
    paymentMethod: "pix",
    orderStatus: "pending_payment",
    txStatus: "pending",
    chargeId: gwResult.chargeId,
    failureReason: null,
    gatewayMetadata:
      gwResult.raw && typeof gwResult.raw === "object"
        ? (gwResult.raw as Record<string, unknown>)
        : {},
  });

  return {
    ...base,
    pix: gwResult.pix
      ? {
          copyPaste: gwResult.pix.copyPaste,
          qrCodeBase64: gwResult.pix.qrCodeBase64,
          expiresAt: gwResult.pix.expiresAt.toISOString(),
        }
      : undefined,
  };
}
