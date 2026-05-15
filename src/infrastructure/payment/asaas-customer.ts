import type { AsaasGatewayCredentials } from "./tenant-gateway-credentials";
import { asaasErrorMessage, readAsaasResponse } from "./asaas-http";

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function onlyDigits(s: string): string {
  return s.replace(/\D/g, "");
}

/** Celular BR: 10 ou 11 dígitos (DDD + número). */
function isValidBrazilMobile(digits: string): boolean {
  return /^\d{10,11}$/.test(digits);
}

export const ASAAS_PRODUCTION = "https://api.asaas.com/v3";
/** @see https://docs.asaas.com/docs/autenticacao */
export const ASAAS_SANDBOX = "https://api-sandbox.asaas.com/v3";

export function asaasBaseUrl(creds: AsaasGatewayCredentials): string {
  if (creds.apiBaseUrl) return creds.apiBaseUrl.replace(/\/$/, "");
  const k = creds.apiKey;
  if (
    k.includes("_hmlg_") ||
    k.includes("$aact_hmlg") ||
    k.toLowerCase().includes("sandbox")
  ) {
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
  _idempotencyKey: string,
): Promise<{ customerId: string } | { error: string; raw?: Record<string, unknown> }> {
  const base = asaasBaseUrl(creds);
  const taxId = onlyDigits(payer.taxId);

  const listRes = await fetch(
    `${base}/customers?email=${encodeURIComponent(payer.email)}`,
    { headers: asaasHeaders(creds), cache: "no-store" },
  );
  const listParsed = await readAsaasResponse(listRes);
  if (listParsed.ok) {
    const listJson = listParsed.json;
    if (isRecord(listJson) && Array.isArray(listJson.data)) {
      const first = listJson.data[0];
      if (isRecord(first) && typeof first.id === "string") {
        return { customerId: first.id };
      }
    }
  }

  const payload: Record<string, unknown> = {
    name: payer.name,
    email: payer.email,
    cpfCnpj: taxId,
    externalReference,
  };
  if (payer.phone) {
    const mobile = onlyDigits(payer.phone);
    if (isValidBrazilMobile(mobile)) {
      payload.mobilePhone = mobile;
    }
  }

  const cr = await fetch(`${base}/customers`, {
    method: "POST",
    headers: asaasHeaders(creds),
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  const crParsed = await readAsaasResponse(cr);
  if (!crParsed.ok) {
    return { error: `Asaas: falha ao criar cliente (${crParsed.message}).` };
  }
  const crJson = crParsed.json;
  if (!cr.ok || !isRecord(crJson) || typeof crJson.id !== "string") {
    const msg = asaasErrorMessage(crJson, `HTTP ${cr.status}`);
    return {
      error: `Asaas: falha ao criar cliente (${msg}).`,
      raw: isRecord(crJson) ? crJson : undefined,
    };
  }
  return { customerId: crJson.id };
}
