export type WebhookProvider = "asaas" | "pagarme";

export function verifyGatewayWebhook(
  provider: WebhookProvider,
  req: Request,
): boolean {
  if (provider === "asaas") {
    const expected = process.env.ASAAS_WEBHOOK_ACCESS_TOKEN;
    if (!expected) return true;
    return req.headers.get("asaas-access-token") === expected;
  }

  const user = process.env.PAGARME_WEBHOOK_USER;
  const pass = process.env.PAGARME_WEBHOOK_PASSWORD;
  if (!user || !pass) return true;

  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Basic ")) return false;
  const decoded = Buffer.from(auth.slice(6), "base64").toString("utf8");
  const [u, p] = decoded.split(":");
  return u === user && p === pass;
}
