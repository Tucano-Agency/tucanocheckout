import type { CanonicalWebhookEvent } from "@/domain/webhooks/canonical-webhook-event";
import {
  amountMinorFromDecimalString,
  isRecord,
  readAsaasSubscriptionId,
  readString,
} from "@/infrastructure/webhooks/webhook-utils";

const PAID_EVENTS = new Set([
  "PAYMENT_RECEIVED",
  "PAYMENT_CONFIRMED",
  "PAYMENT_RECEIVED_IN_CASH",
]);

const FAILED_EVENTS = new Set([
  "PAYMENT_OVERDUE",
  "PAYMENT_DELETED",
  "PAYMENT_REFUNDED",
  "PAYMENT_CHARGEBACK_REQUESTED",
  "PAYMENT_CHARGEBACK_DISPUTE",
]);

export function parseAsaasWebhookBody(
  body: Record<string, unknown>,
): CanonicalWebhookEvent {
  const event = String(body.event ?? "");

  const subscription = body.subscription;
  if (isRecord(subscription)) {
    const subId = readString(subscription, "id");
    if (subId) {
      if (
        event === "SUBSCRIPTION_DELETED" ||
        event === "SUBSCRIPTION_INACTIVATED"
      ) {
        return {
          type: "subscription.cancelled",
          provider: "asaas",
          subscriptionId: subId,
        };
      }
      if (
        event === "SUBSCRIPTION_CREATED" ||
        event === "SUBSCRIPTION_UPDATED"
      ) {
        return {
          type: "subscription.activated",
          provider: "asaas",
          subscriptionId: subId,
          status: "active",
        };
      }
    }
  }

  const payment = body.payment;
  if (!isRecord(payment)) {
    return {
      type: "ignored",
      provider: "asaas",
      reason: event || "no_payment",
    };
  }

  const chargeId = readString(payment, "id");
  if (!chargeId) {
    return { type: "ignored", provider: "asaas", reason: "no_payment_id" };
  }

  const gatewaySubId = readAsaasSubscriptionId(payment);
  const amountMinor = amountMinorFromDecimalString(payment.value);

  if (PAID_EVENTS.has(event)) {
    return {
      type: "payment.confirmed",
      provider: "asaas",
      chargeId,
      subscriptionId: gatewaySubId,
      amountMinor,
      currency: "BRL",
      raw: { event, payment },
    };
  }

  if (event === "PAYMENT_OVERDUE" && gatewaySubId) {
    return {
      type: "subscription.past_due",
      provider: "asaas",
      subscriptionId: gatewaySubId,
      chargeId,
    };
  }

  if (FAILED_EVENTS.has(event)) {
    return {
      type: "payment.failed",
      provider: "asaas",
      chargeId,
      subscriptionId: gatewaySubId,
      failureReason: `Asaas event: ${event}`,
      raw: { event, payment },
    };
  }

  return { type: "ignored", provider: "asaas", reason: event || "unknown" };
}
