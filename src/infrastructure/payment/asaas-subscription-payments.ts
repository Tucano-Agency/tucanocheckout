import { asaasBaseUrl, asaasHeaders } from "@/infrastructure/payment/asaas-customer";
import type { AsaasGatewayCredentials } from "@/infrastructure/payment/tenant-gateway-credentials";
import { readAsaasResponse } from "@/infrastructure/payment/asaas-http";

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Primeira cobrança gerada pela assinatura (para correlacionar webhooks). */
export async function fetchAsaasSubscriptionFirstPaymentId(
  credentials: AsaasGatewayCredentials,
  subscriptionId: string,
): Promise<string | undefined> {
  const base = asaasBaseUrl(credentials);
  const res = await fetch(
    `${base}/subscriptions/${encodeURIComponent(subscriptionId)}/payments?limit=1&offset=0`,
    {
      method: "GET",
      headers: asaasHeaders(credentials),
      cache: "no-store",
    },
  );
  const parsed = await readAsaasResponse(res);
  if (!parsed.ok || !isRecord(parsed.json)) return undefined;

  const data = parsed.json.data;
  if (!Array.isArray(data) || data.length === 0) return undefined;
  const first = data[0];
  if (!isRecord(first) || typeof first.id !== "string") return undefined;
  return first.id;
}
