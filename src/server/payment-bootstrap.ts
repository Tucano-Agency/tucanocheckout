import { PaymentOrchestrator } from "@/application/payment/PaymentOrchestrator";
import { db } from "@/infrastructure/db/client";
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
