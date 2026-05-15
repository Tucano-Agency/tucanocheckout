import { and, eq } from "drizzle-orm";
import { PaymentOrchestrator } from "@/application/payment/PaymentOrchestrator";
import { db } from "@/infrastructure/db/client";
import { tenantGateways } from "@/infrastructure/db/schema";
import {
  fetchAsaasPaymentPixQrCode,
  type AsaasPixQrData,
} from "@/infrastructure/payment/asaas-pix-qr";
import { parseTenantGatewaySecrets } from "@/infrastructure/payment/parse-tenant-gateway-secrets";
import { AesGcmGatewayCredentialCrypt } from "@/infrastructure/security/aes-gcm-gateway-credential-crypt";
import { createTenantPaymentOrchestrator } from "@/infrastructure/payment/tenant-gateway-session";

let cryptSingleton: AesGcmGatewayCredentialCrypt | null = null;

function getGatewayCrypt(): AesGcmGatewayCredentialCrypt {
  if (!cryptSingleton) {
    cryptSingleton = new AesGcmGatewayCredentialCrypt();
  }
  return cryptSingleton;
}

/** Composition root para rotas/handlers server-side. */
export function getTenantPaymentOrchestrator(tenantId: string): PaymentOrchestrator {
  return createTenantPaymentOrchestrator(db, getGatewayCrypt(), tenantId);
}

/** Reobtém QR PIX no Asaas (ex.: replay de idempotência sem payload na resposta). */
export async function fetchTenantAsaasPixQr(
  tenantId: string,
  chargeId: string,
): Promise<{ ok: true; data: AsaasPixQrData } | { ok: false; message: string }> {
  const [asaasRow] = await db
    .select()
    .from(tenantGateways)
    .where(
      and(
        eq(tenantGateways.tenantId, tenantId),
        eq(tenantGateways.provider, "asaas"),
      ),
    )
    .limit(1);

  if (!asaasRow) {
    return { ok: false, message: "Gateway Asaas não configurado." };
  }

  const json = getGatewayCrypt().decryptCredentialBlob(
    asaasRow.encryptedCredentialBlob,
    asaasRow.encryptionKeyVersion,
  );
  const creds = parseTenantGatewaySecrets("asaas", JSON.parse(json) as unknown);
  if (creds.provider !== "asaas") {
    return { ok: false, message: "Credenciais Asaas inválidas." };
  }

  return fetchAsaasPaymentPixQrCode(creds.asaas, chargeId);
}
