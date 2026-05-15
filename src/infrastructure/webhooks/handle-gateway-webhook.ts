import { NextResponse } from "next/server";
import { dispatchCanonicalWebhook } from "@/application/webhooks/dispatch-canonical-webhook";
import { db } from "@/infrastructure/db/client";
import { parseAsaasWebhookBody } from "@/infrastructure/webhooks/parse-asaas-webhook";
import { parsePagarmeWebhookBody } from "@/infrastructure/webhooks/parse-pagarme-webhook";
import {
  verifyGatewayWebhook,
  type WebhookProvider,
} from "@/infrastructure/webhooks/verify-gateway-webhook";
import { isRecord } from "@/infrastructure/webhooks/webhook-utils";

export async function handleGatewayWebhook(
  provider: WebhookProvider,
  req: Request,
): Promise<Response> {
  if (!verifyGatewayWebhook(provider, req)) {
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

  const canonical =
    provider === "asaas"
      ? parseAsaasWebhookBody(body)
      : parsePagarmeWebhookBody(body);

  const result = await dispatchCanonicalWebhook(db, canonical);
  return NextResponse.json(result);
}
