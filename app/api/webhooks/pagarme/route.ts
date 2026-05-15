import { handleGatewayWebhook } from "@/infrastructure/webhooks/handle-gateway-webhook";

export const runtime = "nodejs";

/** @deprecated Prefer POST /api/webhooks/pagarme via [provider] — mantido por compatibilidade. */
export async function POST(req: Request) {
  return handleGatewayWebhook("pagarme", req);
}
