import type {
  ChargeCardInput,
  ChargePixInput,
  CreateSubscriptionInput,
  ProcessRefundInput,
  TokenizeCardInput,
  ChargeResult,
  PixChargeResult,
  SubscriptionResult,
  TokenizeCardResult,
  RefundResult,
} from "./payment.types";

/**
 * Contrato estrito de gateway de pagamento (BYOG).
 * Implementações recebem credenciais do Tenant em tempo de construção (não via .env global).
 */
export interface IPaymentGateway {
  readonly providerId: "pagarme" | "asaas";

  chargeCard(input: ChargeCardInput): Promise<ChargeResult>;

  chargePix(input: ChargePixInput): Promise<PixChargeResult>;

  createSubscription(input: CreateSubscriptionInput): Promise<SubscriptionResult>;

  tokenizeCard(input: TokenizeCardInput): Promise<TokenizeCardResult>;

  processRefund(input: ProcessRefundInput): Promise<RefundResult>;
}

