import type { GatewayProviderId } from "@/domain/payment/payment.types";
import type { TenantGatewayCredentials } from "./tenant-gateway-credentials";

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function reqStr(obj: Record<string, unknown>, key: string): string {
  const v = obj[key];
  if (typeof v !== "string" || v.length === 0) {
    throw new Error(
      `Credencial BYOG inválida: campo obrigatório "${key}" ausente ou vazio.`,
    );
  }
  return v;
}

export function parseTenantGatewaySecrets(
  provider: GatewayProviderId,
  parsed: unknown,
): TenantGatewayCredentials {
  if (!isRecord(parsed)) {
    throw new Error("JSON de credenciais do gateway inválido.");
  }
  if (provider === "pagarme") {
    return {
      provider: "pagarme",
      pagarme: {
        secretKey: reqStr(parsed, "secretKey"),
        publicKey:
          typeof parsed.publicKey === "string" ? parsed.publicKey : undefined,
        accountId:
          typeof parsed.accountId === "string" ? parsed.accountId : undefined,
      },
    };
  }
  return {
    provider: "asaas",
    asaas: {
      apiKey: reqStr(parsed, "apiKey"),
      walletId:
        typeof parsed.walletId === "string" ? parsed.walletId : undefined,
      apiBaseUrl:
        typeof parsed.apiBaseUrl === "string" ? parsed.apiBaseUrl : undefined,
    },
  };
}
