import { handleGatewayWebhook } from "@/infrastructure/webhooks/handle-gateway-webhook";
import type { WebhookProvider } from "@/infrastructure/webhooks/verify-gateway-webhook";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const PROVIDERS = new Set<WebhookProvider>(["asaas", "pagarme"]);

type RouteContext = { params: Promise<{ provider: string }> };

export async function POST(req: Request, context: RouteContext) {
  const { provider } = await context.params;
  if (!PROVIDERS.has(provider as WebhookProvider)) {
    return NextResponse.json({ error: "unknown_provider" }, { status: 404 });
  }
  return handleGatewayWebhook(provider as WebhookProvider, req);
}
