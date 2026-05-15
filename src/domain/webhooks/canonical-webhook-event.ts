/**
 * Contrato canônico de webhooks — consumível pelo Checkout e pelo restante da plataforma Tucano.
 */

export type CanonicalWebhookProvider = "asaas" | "pagarme";

export type CanonicalWebhookEvent =
  | {
      readonly type: "payment.confirmed";
      readonly provider: CanonicalWebhookProvider;
      readonly chargeId: string;
      readonly subscriptionId?: string;
      readonly amountMinor?: number;
      readonly currency?: "BRL" | "USD" | "EUR";
      readonly raw: Readonly<Record<string, unknown>>;
    }
  | {
      readonly type: "payment.failed";
      readonly provider: CanonicalWebhookProvider;
      readonly chargeId: string;
      readonly subscriptionId?: string;
      readonly failureReason?: string;
      readonly raw: Readonly<Record<string, unknown>>;
    }
  | {
      readonly type: "subscription.activated";
      readonly provider: CanonicalWebhookProvider;
      readonly subscriptionId: string;
      readonly status?: "active" | "trialing";
    }
  | {
      readonly type: "subscription.cancelled";
      readonly provider: CanonicalWebhookProvider;
      readonly subscriptionId: string;
    }
  | {
      readonly type: "subscription.past_due";
      readonly provider: CanonicalWebhookProvider;
      readonly subscriptionId: string;
      readonly chargeId?: string;
    }
  | {
      readonly type: "ignored";
      readonly provider: CanonicalWebhookProvider;
      readonly reason: string;
    };

export type CanonicalWebhookDispatchResult = {
  readonly received: true;
  readonly eventType: CanonicalWebhookEvent["type"];
  readonly applied: boolean;
  readonly detail?: string;
  readonly orderId?: string;
  readonly transactionId?: string;
  readonly subscriptionId?: string;
};
