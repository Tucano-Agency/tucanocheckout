import type { AsaasGatewayCredentials } from "./tenant-gateway-credentials";

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function onlyDigits(s: string): string {
  return s.replace(/\D/g, "");
}

export const ASAAS_PRODUCTION = "https://api.asaas.com/v3";
export const ASAAS_SANDBOX = "https://sandbox.asaas.com/v3";

export function asaasBaseUrl(creds: AsaasGatewayCredentials): string {
  if (creds.apiBaseUrl) return creds.apiBaseUrl.replace(/\/$/, "");
  const k = creds.apiKey;
  if (k.includes("_hmlg_") || k.toLowerCase().includes("sandbox")) {
    return ASAAS_SANDBOX;
  }
  return ASAAS_PRODUCTION;
}

export function asaasHeaders(
  creds: AsaasGatewayCredentials,
  idempotencyKey?: string,
): HeadersInit {
  const h: Record<string, string> = {
    "Content-Type": "application/json",
    access_token: creds.apiKey,
  };
  if (idempotencyKey) h["Idempotency-Key"] = idempotencyKey;
  return h;
}

export type AsaasPayer = {
  readonly email: string;
  readonly name: string;
  readonly taxId: string;
  readonly phone?: string;
};

/** Garante cliente Asaas (busca por e-mail ou cria). */
export async function ensureAsaasCustomer(
  creds: AsaasGatewayCredentials,
  payer: AsaasPayer,
  externalReference: string,
  idempotencyKey: string,
): Promise<{ customerId: string } | { error: string; raw?: Record<string, unknown> }> {
  const base = asaasBaseUrl(creds);
  const taxId = onlyDigits(payer.taxId);

  const listRes = await fetch(
    `${base}/customers?email=${encodeURIComponent(payer.email)}`,
    { headers: asaasHeaders(creds), cache: "no-store" },
  );
  const listJson = (await listRes.json()) as unknown;

  if (isRecord(listJson) && Array.isArray(listJson.data)) {
    const first = listJson.data[0];
    if (isRecord(first) && typeof first.id === "string") {
      return { customerId: first.id };
    }
  }

  const payload: Record<string, unknown> = {
    name: payer.name,
    email: payer.email,
    cpfCnpj: taxId,
    externalReference,
  };
  if (payer.phone) payload.mobilePhone = onlyDigits(payer.phone);

  const cr = await fetch(`${base}/customers`, {
    method: "POST",
    headers: asaasHeaders(creds, `${idempotencyKey}:asaas-customer`),
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  const crJson = (await cr.json()) as unknown;
  if (!cr.ok || !isRecord(crJson) || typeof crJson.id !== "string") {
    const msg =
      isRecord(crJson) && crJson.errors !== undefined
        ? JSON.stringify(crJson.errors)
        : `HTTP ${cr.status}`;
    return {
      error: `Asaas: falha ao criar cliente (${msg}).`,
      raw: isRecord(crJson) ? crJson : undefined,
    };
  }
  return { customerId: crJson.id };
}
