import type { TenantGatewayRoutingProfile } from "@/domain/payment/gateway-routing.types";
import type {
  GatewayProviderId,
  PaymentMethodKind,
  SupportedCurrency,
} from "@/domain/payment/payment.types";
import { tenantGateways } from "@/infrastructure/db/schema";

type TenantGatewayRow = typeof tenantGateways.$inferSelect;

function defaultCurrencies(row: TenantGatewayRow): SupportedCurrency[] {
  const list = row.supportedCurrencies ?? [];
  if (list.length > 0) return list;
  return ["BRL"];
}

function methodsForProvider(
  provider: GatewayProviderId,
  currency: SupportedCurrency,
): PaymentMethodKind[] {
  if (provider === "pagarme") {
    const m: PaymentMethodKind[] = ["card"];
    if (currency === "BRL") m.push("pix");
    return m;
  }
  const m: PaymentMethodKind[] = ["card"];
  if (currency === "BRL") {
    m.push("pix", "boleto");
  }
  return m;
}

function uniqueMethods(
  provider: GatewayProviderId,
  currencies: SupportedCurrency[],
): PaymentMethodKind[] {
  const set = new Set<PaymentMethodKind>();
  for (const c of currencies) {
    for (const m of methodsForProvider(provider, c)) {
      set.add(m);
    }
  }
  return [...set];
}

/**
 * Constrói regras de roteamento a partir das linhas `tenant_gateways`.
 * Prioridade: gateway default do tenant > ordem estável na lista.
 */
export function buildTenantGatewayRoutingProfile(
  tenantId: string,
  rows: readonly TenantGatewayRow[],
): TenantGatewayRoutingProfile {
  const sorted = [...rows].sort((a, b) => {
    if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
    return a.createdAt.getTime() - b.createdAt.getTime();
  });

  const rules = sorted.map((row, index) => {
    const currencies = defaultCurrencies(row);
    const methods = uniqueMethods(row.provider, currencies);
    const base = row.isDefault ? 200 : 100;
    const priority = base - index;
    return {
      provider: row.provider as GatewayProviderId,
      methods,
      currencies,
      priority,
    };
  });

  return { tenantId, rules };
}
