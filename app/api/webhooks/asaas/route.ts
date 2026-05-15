import { NextResponse } from "next/server";
import {
  applyPaymentConfirmed,
  applyPaymentFailed,
} from "@/application/webhooks/apply-payment-webhook";
import {
  applySubscriptionActivated,
  applySubscriptionCancelled,
} from "@/application/webhooks/apply-subscription-webhook";
import { db } from "@/infrastructure/db/client";

export const runtime = "nodejs";

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function verifyAsaasWebhook(req: Request): boolean {
  const expected = process.env.ASAAS_WEBHOOK_ACCESS_TOKEN;
  if (!expected) return true;
  const token = req.headers.get("asaas-access-token");
  return token === expected;
}

const PAID_EVENTS = new Set([
  "PAYMENT_RECEIVED",
  "PAYMENT_CONFIRMED",
  "PAYMENT_RECEIVED_IN_CASH",
]);

const FAILED_EVENTS = new Set([
  "PAYMENT_OVERDUE",
  "PAYMENT_DELETED",
  "PAYMENT_REFUNDED",
]);

export async function POST(req: Request) {
  if (!verifyAsaasWebhook(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  if (!isRecord(body)) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const event = String(body.event ?? "");

  const subscription = body.subscription;
  if (isRecord(subscription) && typeof subscription.id === "string") {
    if (event === "SUBSCRIPTION_DELETED" || event === "SUBSCRIPTION_INACTIVATED") {
      const r = await applySubscriptionCancelled(db, {
        gatewayProvider: "asaas",
        gatewaySubscriptionId: subscription.id,
      });
      return NextResponse.json({ received: true, ...r });
    }
    if (
      event === "SUBSCRIPTION_CREATED" ||
      event === "SUBSCRIPTION_UPDATED"
    ) {
      const r = await applySubscriptionActivated(db, {
        gatewayProvider: "asaas",
        gatewaySubscriptionId: subscription.id,
        status: "active",
      });
      return NextResponse.json({ received: true, ...r });
    }
  }

  const payment = body.payment;
  if (!isRecord(payment) || typeof payment.id !== "string") {
    return NextResponse.json({ received: true, skipped: "no_payment_id" });
  }

  const chargeId = payment.id;

  if (PAID_EVENTS.has(event)) {
    const result = await applyPaymentConfirmed(db, {
      gatewayProvider: "asaas",
      gatewayChargeId: chargeId,
      gatewayMetadata: { event, payment },
    });
    return NextResponse.json({ received: true, ...result });
  }

  if (FAILED_EVENTS.has(event)) {
    const result = await applyPaymentFailed(db, {
      gatewayProvider: "asaas",
      gatewayChargeId: chargeId,
      failureReason: `Asaas event: ${event}`,
    });
    return NextResponse.json({ received: true, ...result });
  }

  return NextResponse.json({ received: true, skipped: event || "unknown" });
}
