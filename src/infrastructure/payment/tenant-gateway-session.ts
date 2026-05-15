import { eq } from "drizzle-orm";
import {
  PaymentOrchestrationError,
  PaymentOrchestrator,
  type ResolveGateway,
  type LoadRoutingProfile,
} from "@/application/payment/PaymentOrchestrator";
import type { IGatewayCredentialCrypt } from "@/domain/ports/IGatewayCredentialCrypt";
import type { GatewayProviderId } from "@/domain/payment/payment.types";
import type { Database } from "@/infrastructure/db/client";
import { tenantGateways } from "@/infrastructure/db/schema";
import { buildTenantGatewayRoutingProfile } from "./build-tenant-gateway-routing-profile";
import { createPaymentGatewayFromCredentials } from "./payment-gateway-factory";
import { parseTenantGatewaySecrets } from "./parse-tenant-gateway-secrets";

/**
 * Escopo por request: carrega `tenant_gateways` uma vez e resolve adapters com credenciais descriptografadas.
 */
export class TenantGatewaySession {
  private cacheRows: Promise<typeof tenantGateways.$inferSelect[]> | null = null;

  private readonly credentialsByProvider = new Map<
    GatewayProviderId,
    ReturnType<typeof parseTenantGatewaySecrets>
  >();

  constructor(
    private readonly db: Database,
    private readonly crypt: IGatewayCredentialCrypt,
    private readonly tenantId: string,
  ) {}

  private async getRows() {
    if (!this.cacheRows) {
      this.cacheRows = this.db
        .select()
        .from(tenantGateways)
        .where(eq(tenantGateways.tenantId, this.tenantId));
    }
    return this.cacheRows;
  }

  assertTenant(tenantId: string): void {
    if (tenantId !== this.tenantId) {
      throw new PaymentOrchestrationError(
        `Sessão de gateway fixada ao tenant ${this.tenantId}; recebido ${tenantId}.`,
      );
    }
  }

  loadRoutingProfile: LoadRoutingProfile = async (tenantId: string) => {
    this.assertTenant(tenantId);
    const rows = await this.getRows();
    if (rows.length === 0) {
      throw new PaymentOrchestrationError(
        `Nenhum gateway BYOG cadastrado para o tenant ${tenantId}.`,
      );
    }
    return buildTenantGatewayRoutingProfile(tenantId, rows);
  };

  resolveGateway: ResolveGateway = async (input) => {
    this.assertTenant(input.tenantId);
    const rows = await this.getRows();
    const row = rows.find((r) => r.provider === input.provider);
    if (!row) {
      throw new PaymentOrchestrationError(
        `Gateway "${input.provider}" não configurado para o tenant ${input.tenantId}.`,
      );
    }
    let creds = this.credentialsByProvider.get(input.provider);
    if (!creds) {
      const json = this.crypt.decryptCredentialBlob(
        row.encryptedCredentialBlob,
        row.encryptionKeyVersion,
      );
      let parsed: unknown;
      try {
        parsed = JSON.parse(json) as unknown;
      } catch (e) {
        throw new PaymentOrchestrationError(
          "Falha ao interpretar JSON de credenciais do gateway.",
          e,
        );
      }
      try {
        creds = parseTenantGatewaySecrets(input.provider, parsed);
      } catch (e) {
        throw new PaymentOrchestrationError(
          "Credenciais do gateway inválidas após descriptografia.",
          e,
        );
      }
      this.credentialsByProvider.set(input.provider, creds);
    }
    return createPaymentGatewayFromCredentials(input.tenantId, creds, {
      useCache: false,
    });
  };
}

export function createTenantPaymentOrchestrator(
  db: Database,
  crypt: IGatewayCredentialCrypt,
  tenantId: string,
): PaymentOrchestrator {
  const session = new TenantGatewaySession(db, crypt, tenantId);
  return new PaymentOrchestrator(session.resolveGateway, session.loadRoutingProfile);
}
