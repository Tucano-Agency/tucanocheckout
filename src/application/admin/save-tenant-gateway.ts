import { eq } from "drizzle-orm";
import type { Database } from "@/infrastructure/db/client";
import { tenantGateways, tenants } from "@/infrastructure/db/schema";
import { encryptGatewayCredentialJsonV1 } from "@/infrastructure/security/aes-gcm-gateway-credential-crypt";

export type SaveGatewayInput = {
  readonly provider: "pagarme" | "asaas";
  readonly credentials: Record<string, string>;
  readonly supportedCurrencies: ("BRL" | "USD" | "EUR")[];
  readonly isDefault: boolean;
};

export async function saveTenantGateway(
  db: Database,
  tenantSlug: string,
  input: SaveGatewayInput,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const [tenant] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.slug, tenantSlug))
    .limit(1);

  if (!tenant) {
    return { ok: false, message: "Tenant não encontrado." };
  }

  const blob = encryptGatewayCredentialJsonV1(JSON.stringify(input.credentials));

  if (input.isDefault) {
    await db
      .update(tenantGateways)
      .set({ isDefault: false, updatedAt: new Date() })
      .where(eq(tenantGateways.tenantId, tenant.id));
  }

  await db
    .insert(tenantGateways)
    .values({
      tenantId: tenant.id,
      provider: input.provider,
      encryptedCredentialBlob: blob,
      supportedCurrencies: input.supportedCurrencies,
      isDefault: input.isDefault,
    })
    .onConflictDoUpdate({
      target: [tenantGateways.tenantId, tenantGateways.provider],
      set: {
        encryptedCredentialBlob: blob,
        supportedCurrencies: input.supportedCurrencies,
        isDefault: input.isDefault,
        lastRotatedAt: new Date(),
        updatedAt: new Date(),
      },
    });

  return { ok: true };
}
