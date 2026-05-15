/**
 * Tipos de domínio compartilhados para pagamentos (sem dependência de infraestrutura).
 */

export type SupportedCurrency = "BRL" | "USD" | "EUR";

export type GatewayProviderId = "pagarme" | "asaas";

export type PaymentMethodKind = "card" | "pix" | "boleto";

/** Chave de idempotência: única por operação financeira mutável (UUID v4 ou ULID recomendado). */
export type IdempotencyKey = string & { readonly __brand: "IdempotencyKey" };

export function asIdempotencyKey(value: string): IdempotencyKey {
  return value as IdempotencyKey;
}

export interface Money {
  readonly amountMinor: number;
  readonly currency: SupportedCurrency;
}

export interface CardPaymentDetails {
  readonly holderName: string;
  readonly number: string;
  readonly expMonth: number;
  readonly expYear: number;
  readonly cvv: string;
  readonly billingAddress?: {
    readonly line1: string;
    readonly line2?: string;
    readonly city: string;
    readonly region: string;
    readonly postalCode: string;
    readonly country: string;
  };
}

export interface ChargeCardInput {
  readonly idempotencyKey: IdempotencyKey;
  readonly amount: Money;
  readonly customerReference: string;
  /** Dados de contato / KYC mínimos para gateways (Asaas exige CPF/CNPJ no holder). */
  readonly payer?: {
    readonly email: string;
    readonly name: string;
    readonly taxId?: string;
    readonly phone?: string;
  };
  readonly card: CardPaymentDetails;
  readonly metadata?: Readonly<Record<string, string>>;
  /** Split apenas afiliado/co-produtor — nunca taxa da plataforma. */
  readonly split?: ReadonlyArray<{
    readonly recipientId: string;
    readonly percentageBps: number;
  }>;
}

export interface ChargePixInput {
  readonly idempotencyKey: IdempotencyKey;
  readonly amount: Money;
  readonly customerReference: string;
  readonly payer?: {
    readonly email: string;
    readonly name: string;
    readonly taxId?: string;
    readonly phone?: string;
  };
  readonly expiresInSeconds?: number;
  readonly metadata?: Readonly<Record<string, string>>;
  readonly split?: ReadonlyArray<{
    readonly recipientId: string;
    readonly percentageBps: number;
  }>;
}

export interface CreateSubscriptionInput {
  readonly idempotencyKey: IdempotencyKey;
  readonly currency: SupportedCurrency;
  readonly planReference: string;
  readonly customerReference: string;
  readonly payer: {
    readonly email: string;
    readonly name: string;
    readonly taxId: string;
    readonly phone?: string;
  };
  readonly payment: { readonly kind: "card"; readonly card: CardPaymentDetails };
  /** Valor da assinatura em minor units (Asaas e fallback). */
  readonly amountMinor: number;
  readonly billingInterval: "day" | "week" | "month" | "year";
  readonly intervalCount: number;
  readonly trialDays?: number;
  readonly metadata?: Readonly<Record<string, string>>;
  readonly split?: ReadonlyArray<{
    readonly recipientId: string;
    readonly percentageBps: number;
  }>;
}

export interface TokenizeCardInput {
  readonly idempotencyKey: IdempotencyKey;
  readonly card: CardPaymentDetails;
  readonly customerReference?: string;
}

export interface ProcessRefundInput {
  readonly idempotencyKey: IdempotencyKey;
  readonly currency: SupportedCurrency;
  /** Método usado na cobrança original (roteamento BYOG). */
  readonly originalPaymentMethod: PaymentMethodKind;
  readonly chargeReference: string;
  readonly amount?: Money;
  readonly reason?: string;
}

export type ChargeResult =
  | {
      readonly status: "succeeded";
      readonly chargeId: string;
      readonly raw?: Readonly<Record<string, unknown>>;
    }
  | {
      readonly status: "pending";
      readonly chargeId?: string;
      readonly raw?: Readonly<Record<string, unknown>>;
    }
  | {
      readonly status: "failed";
      readonly failureCode?: string;
      readonly failureMessage: string;
      readonly raw?: Readonly<Record<string, unknown>>;
    };

export interface PixChargeResult {
  readonly status: "pending" | "failed";
  readonly chargeId?: string;
  readonly pix?: {
    readonly copyPaste: string;
    readonly qrCodeBase64?: string;
    readonly expiresAt: Date;
  };
  readonly failureMessage?: string;
  readonly raw?: Readonly<Record<string, unknown>>;
}

export interface SubscriptionResult {
  readonly status: "active" | "trialing" | "incomplete" | "failed";
  readonly subscriptionId?: string;
  /** ID da primeira cobrança no gateway (quando disponível). */
  readonly firstPaymentId?: string;
  readonly failureMessage?: string;
  readonly raw?: Readonly<Record<string, unknown>>;
}

export interface TokenizeCardResult {
  readonly status: "succeeded" | "failed";
  readonly token?: string;
  readonly failureMessage?: string;
  readonly raw?: Readonly<Record<string, unknown>>;
}

export interface RefundResult {
  readonly status: "succeeded" | "pending" | "failed";
  readonly refundId?: string;
  readonly failureMessage?: string;
  readonly raw?: Readonly<Record<string, unknown>>;
}
