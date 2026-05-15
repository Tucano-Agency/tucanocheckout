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

function verifyPagarmeWebhook(req: Request): boolean {
  const user = process.env.PAGARME_WEBHOOK_USER;
  const pass = process.env.PAGARME_WEBHOOK_PASSWORD;
  if (!user || !pass) return true;

  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Basic ")) return false;
  const decoded = Buffer.from(auth.slice(6), "base64").toString("utf8");
  const [u, p] = decoded.split(":");
  return u === user && p === pass;
}

export async function POST(req: Request) {
  if (!verifyPagarmeWebhook(req)) {
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

  const type = String(body.type ?? body.event ?? "");
  const normalized = type.toLowerCase();
  const data = body.data;
  if (!isRecord(data)) {
    return NextResponse.json({ received: true, skipped: "no_data" });
  }

  const subscriptionId =
    typeof data.id === "string" && normalized.includes("subscription")
      ? data.id
      : typeof data.subscription_id === "string"
        ? data.subscription_id
        : null;

  if (subscriptionId && normalized.includes("subscription")) {
    if (normalized.includes("canceled") || normalized.includes("cancelled")) {
      const r = await applySubscriptionCancelled(db, {
        gatewayProvider: "pagarme",
        gatewaySubscriptionId: subscriptionId,
      });
      return NextResponse.json({ received: true, ...r });
    }
    if (normalized.includes("active") || normalized.includes("created")) {
      const r = await applySubscriptionActivated(db, {
        gatewayProvider: "pagarme",
        gatewaySubscriptionId: subscriptionId,
        status: "active",
      });
      return NextResponse.json({ received: true, ...r });
    }
  }

  const chargeId =
    typeof data.id === "string" && !normalized.includes("subscription")
      ? data.id
      : typeof data.charge_id === "string"
        ? data.charge_id
        : null;

  if (!chargeId) {
    return NextResponse.json({ received: true, skipped: "no_charge_id" });
  }

  if (
    normalized.includes("paid") ||
    normalized === "charge.paid" ||
    normalized === "order.paid"
  ) {
    const result = await applyPaymentConfirmed(db, {
      gatewayProvider: "pagarme",
      gatewayChargeId: chargeId,
      gatewayMetadata: { type, data },
    });
    return NextResponse.json({ received: true, ...result });
  }

  if (
    normalized.includes("failed") ||
    normalized.includes("canceled") ||
    normalized === "charge.payment_failed"
  ) {
    const result = await applyPaymentFailed(db, {
      gatewayProvider: "pagarme",
      gatewayChargeId: chargeId,
      failureReason: `Pagar.me event: ${type}`,
    });
    return NextResponse.json({ received: true, ...result });
  }

  return NextResponse.json({ received: true, skipped: type || "unknown" });
}
