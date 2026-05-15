import type {
  GatewayProviderId,
  PaymentMethodKind,
  SupportedCurrency,
} from "./payment.types";

export interface GatewayRoutingRule {
  readonly provider: GatewayProviderId;
  readonly methods: ReadonlyArray<PaymentMethodKind>;
  readonly currencies: ReadonlyArray<SupportedCurrency>;
  readonly priority: number;
}

export interface TenantGatewayRoutingProfile {
  readonly tenantId: string;
  readonly rules: ReadonlyArray<GatewayRoutingRule>;
}
