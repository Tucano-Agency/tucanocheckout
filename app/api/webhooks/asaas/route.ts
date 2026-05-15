import { handleGatewayWebhook } from "@/infrastructure/webhooks/handle-gateway-webhook";

export const runtime = "nodejs";

/** @deprecated Prefer POST /api/webhooks/asaas via [provider] — mantido por compatibilidade. */
export async function POST(req: Request) {
  return handleGatewayWebhook("asaas", req);
}
