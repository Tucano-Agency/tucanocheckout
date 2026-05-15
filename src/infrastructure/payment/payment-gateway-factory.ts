import type { IPaymentGateway } from "@/domain/payment/IPaymentGateway";
import type { GatewayProviderId } from "@/domain/payment/payment.types";
import { AsaasAdapter } from "./AsaasAdapter";
import { PagarMeAdapter } from "./PagarMeAdapter";
import type { TenantGatewayCredentials } from "./tenant-gateway-credentials";

/** Cache opcional por request — evitar reinstanciar adapters no mesmo ciclo. */
const adapterCache = new Map<string, IPaymentGateway>();

function cacheKey(tenantId: string, provider: GatewayProviderId): string {
  return `${tenantId}:${provider}`;
}

export function createPaymentGatewayFromCredentials(
  tenantId: string,
  creds: TenantGatewayCredentials,
  options?: { useCache?: boolean },
): IPaymentGateway {
  const useCache = options?.useCache ?? false;
  const key = cacheKey(tenantId, creds.provider);
  if (useCache) {
    const hit = adapterCache.get(key);
    if (hit) return hit;
  }
  let adapter: IPaymentGateway;
  if (creds.provider === "pagarme") {
    adapter = new PagarMeAdapter(creds.pagarme);
  } else {
    adapter = new AsaasAdapter(creds.asaas);
  }
  if (useCache) adapterCache.set(key, adapter);
  return adapter;
}

export function clearGatewayAdapterCacheForTenant(tenantId: string): void {
  for (const k of adapterCache.keys()) {
    if (k.startsWith(`${tenantId}:`)) adapterCache.delete(k);
  }
}
