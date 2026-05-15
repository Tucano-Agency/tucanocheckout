import type { CanonicalWebhookEvent } from "@/domain/webhooks/canonical-webhook-event";
import {
  amountMinorFromDecimalString,
  isRecord,
  readString,
} from "@/infrastructure/webhooks/webhook-utils";

export function parsePagarmeWebhookBody(
  body: Record<string, unknown>,
): CanonicalWebhookEvent {
  const type = String(body.type ?? body.event ?? "");
  const normalized = type.toLowerCase();
  const data = body.data;

  if (!isRecord(data)) {
    return {
      type: "ignored",
      provider: "pagarme",
      reason: "no_data",
    };
  }

  const subscriptionId =
    typeof data.id === "string" && normalized.includes("subscription")
      ? data.id
      : typeof data.subscription_id === "string"
        ? data.subscription_id
        : readString(data, "subscription_id");

  if (subscriptionId && normalized.includes("subscription")) {
    if (normalized.includes("canceled") || normalized.includes("cancelled")) {
      return {
        type: "subscription.cancelled",
        provider: "pagarme",
        subscriptionId,
      };
    }
    if (normalized.includes("active") || normalized.includes("created")) {
      return {
        type: "subscription.activated",
        provider: "pagarme",
        subscriptionId,
        status: "active",
      };
    }
    if (normalized.includes("past_due") || normalized.includes("overdue")) {
      return {
        type: "subscription.past_due",
        provider: "pagarme",
        subscriptionId,
      };
    }
  }

  const chargeId =
    typeof data.id === "string" && !normalized.includes("subscription")
      ? data.id
      : typeof data.charge_id === "string"
        ? data.charge_id
        : readString(data, "charge_id");

  if (!chargeId) {
    return { type: "ignored", provider: "pagarme", reason: "no_charge_id" };
  }

  const gatewaySubId =
    readString(data, "subscription_id") ??
    (isRecord(data.subscription) ? readString(data.subscription, "id") : undefined);

  const amountMinor =
    typeof data.amount === "number"
      ? data.amount
      : amountMinorFromDecimalString(data.amount);

  if (
    normalized.includes("paid") ||
    normalized === "charge.paid" ||
    normalized === "order.paid"
  ) {
    return {
      type: "payment.confirmed",
      provider: "pagarme",
      chargeId,
      subscriptionId: gatewaySubId,
      amountMinor,
      raw: { type, data },
    };
  }

  if (
    normalized.includes("failed") ||
    normalized === "charge.payment_failed"
  ) {
    return {
      type: "payment.failed",
      provider: "pagarme",
      chargeId,
      subscriptionId: gatewaySubId,
      failureReason: `Pagar.me event: ${type}`,
      raw: { type, data },
    };
  }

  if (
    normalized.includes("canceled") &&
    !normalized.includes("subscription")
  ) {
    return {
      type: "payment.failed",
      provider: "pagarme",
      chargeId,
      subscriptionId: gatewaySubId,
      failureReason: `Pagar.me event: ${type}`,
      raw: { type, data },
    };
  }

  return { type: "ignored", provider: "pagarme", reason: type || "unknown" };
}
