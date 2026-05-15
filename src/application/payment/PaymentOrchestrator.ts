import type { IPaymentGateway } from "@/domain/payment/IPaymentGateway";
import type { TenantGatewayRoutingProfile } from "@/domain/payment/gateway-routing.types";
import type {
  ChargeCardInput,
  ChargePixInput,
  CreateSubscriptionInput,
  ProcessRefundInput,
  TokenizeCardInput,
  PaymentMethodKind,
  SupportedCurrency,
} from "@/domain/payment/payment.types";
import type { GatewayProviderId } from "@/domain/payment/payment.types";

export class PaymentOrchestrationError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "PaymentOrchestrationError";
  }
}

export interface ResolveGateway {
  (input: {
    readonly tenantId: string;
    readonly provider: GatewayProviderId;
  }): Promise<IPaymentGateway>;
}

export interface LoadRoutingProfile {
  (tenantId: string): TenantGatewayRoutingProfile | Promise<TenantGatewayRoutingProfile>;
}

/**
 * Seleciona o adapter BYOG com base em método de pagamento, moeda e perfil de roteamento do tenant.
 */
export class PaymentOrchestrator {
  constructor(
    private readonly resolveGateway: ResolveGateway,
    private readonly loadRoutingProfile: LoadRoutingProfile,
  ) {}

  private async pickProvider(
    tenantId: string,
    method: PaymentMethodKind,
    currency: SupportedCurrency,
  ): Promise<GatewayProviderId> {
    const profile = await this.loadRoutingProfile(tenantId);
    const sorted = [...profile.rules].sort((a, b) => b.priority - a.priority);
    for (const rule of sorted) {
      if (rule.methods.includes(method) && rule.currencies.includes(currency)) {
        return rule.provider;
      }
    }
    throw new PaymentOrchestrationError(
      `Nenhum gateway BYOG atende método "${method}" e moeda "${currency}" para o tenant ${tenantId}.`,
    );
  }

  /** Exposto para composição de casos de uso (ex.: persistir `gateway_provider` na transação). */
  pickProviderForPayment(
    tenantId: string,
    method: PaymentMethodKind,
    currency: SupportedCurrency,
  ): Promise<GatewayProviderId> {
    return this.pickProvider(tenantId, method, currency);
  }

  private async gatewayFor(
    tenantId: string,
    method: PaymentMethodKind,
    currency: SupportedCurrency,
  ): Promise<IPaymentGateway> {
    const provider = await this.pickProvider(tenantId, method, currency);
    return await this.resolveGateway({ tenantId, provider });
  }

  chargeCard(tenantId: string, input: ChargeCardInput) {
    return this.gatewayFor(tenantId, "card", input.amount.currency).then((gw) =>
      gw.chargeCard(input),
    );
  }

  chargePix(tenantId: string, input: ChargePixInput) {
    return this.gatewayFor(tenantId, "pix", input.amount.currency).then((gw) =>
      gw.chargePix(input),
    );
  }

  createSubscription(tenantId: string, input: CreateSubscriptionInput) {
    return this.gatewayFor(tenantId, "card", input.currency).then((gw) =>
      gw.createSubscription(input),
    );
  }

  tokenizeCard(
    tenantId: string,
    currency: SupportedCurrency,
    method: PaymentMethodKind,
    input: TokenizeCardInput,
  ) {
    return this.gatewayFor(tenantId, method, currency).then((gw) =>
      gw.tokenizeCard(input),
    );
  }

  processRefund(tenantId: string, input: ProcessRefundInput) {
    const currency = input.amount?.currency ?? input.currency;
    return this.gatewayFor(
      tenantId,
      input.originalPaymentMethod,
      currency,
    ).then((gw) => gw.processRefund(input));
  }
}
