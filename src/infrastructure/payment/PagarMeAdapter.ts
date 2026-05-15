import type { IPaymentGateway } from "@/domain/payment/IPaymentGateway";
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
} from "@/domain/payment/payment.types";
import type { PagarMeGatewayCredentials } from "./tenant-gateway-credentials";

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function onlyDigits(s: string): string {
  return s.replace(/\D/g, "");
}

const DEFAULT_BASE = "https://api.pagar.me/core/v5";

/**
 * Adapter Pagar.me — chaves dinâmicas do `TenantGateway` (BYOG).
 * @see https://docs.pagar.me/reference/criar-pedido-2
 */
export class PagarMeAdapter implements IPaymentGateway {
  readonly providerId = "pagarme" as const;

  constructor(private readonly credentials: PagarMeGatewayCredentials) {}

  async chargeCard(input: ChargeCardInput): Promise<ChargeResult> {
    const currency = input.amount.currency;
    if (currency !== "BRL") {
      return {
        status: "failed",
        failureMessage:
          "Pagar.me: neste adapter apenas BRL é suportado para pedidos `core/v5`.",
      };
    }
    const payer = input.payer;
    if (!payer?.email?.trim() || !payer.name?.trim()) {
      return {
        status: "failed",
        failureMessage:
          "Pagar.me: informe `payer.email` e `payer.name` em ChargeCardInput.",
      };
    }

    const addr = input.card.billingAddress;
    const expYearShort =
      input.card.expYear >= 2000
        ? input.card.expYear % 100
        : input.card.expYear;

    const payment: Record<string, unknown> = {
      payment_method: "credit_card",
      credit_card: {
        installments: 1,
        statement_descriptor: (
          input.metadata?.statementDescriptor ?? "TUCANO"
        ).slice(0, 22),
        card: {
          number: input.card.number.replace(/\s/g, ""),
          holder_name: input.card.holderName,
          exp_month: input.card.expMonth,
          exp_year: expYearShort,
          cvv: input.card.cvv,
          ...(addr
            ? {
                billing_address: {
                  line_1: addr.line1,
                  line_2: addr.line2,
                  zip_code: addr.postalCode,
                  city: addr.city,
                  state: addr.region,
                  country: addr.country,
                },
              }
            : {}),
        },
      },
    };

    if (input.split?.length) {
      payment.split = input.split.map((s) => ({
        type: "percentage",
        amount: Math.round(s.percentageBps / 100),
        recipient_id: s.recipientId,
        options: {
          liable: false,
          charge_processing_fee: false,
          charge_remainder_fee: false,
        },
      }));
    }

    const body = {
      code: input.idempotencyKey.slice(0, 52),
      currency: "BRL",
      closed: true,
      customer: {
        name: payer.name.slice(0, 64),
        email: payer.email.slice(0, 64),
      },
      items: [
        {
          amount: input.amount.amountMinor,
          description: (input.metadata?.itemDescription ?? "Checkout").slice(
            0,
            256,
          ),
          quantity: 1,
          code: (input.metadata?.itemCode ?? "checkout").slice(0, 52),
        },
      ],
      payments: [payment],
      metadata: input.metadata ?? {},
    };

    const base = (
      process.env.PAGARME_API_BASE_URL ?? DEFAULT_BASE
    ).replace(/\/$/, "");
    const res = await fetch(`${base}/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${Buffer.from(`${this.credentials.secretKey}:`).toString("base64")}`,
        "Idempotency-Key": input.idempotencyKey,
      },
      body: JSON.stringify(body),
    });

    let data: unknown;
    try {
      data = (await res.json()) as unknown;
    } catch {
      return {
        status: "failed",
        failureMessage: `Pagar.me: resposta não-JSON (HTTP ${res.status}).`,
      };
    }

    if (!isRecord(data)) {
      return { status: "failed", failureMessage: "Pagar.me: resposta inválida." };
    }

    if (!res.ok) {
      const errs = data.errors;
      let msg = `HTTP ${res.status}`;
      if (Array.isArray(errs) && errs[0] && isRecord(errs[0])) {
        const m = errs[0].message;
        if (typeof m === "string") msg = m;
      } else if (typeof data.message === "string") {
        msg = data.message;
      }
      return {
        status: "failed",
        failureMessage: msg,
        failureCode: typeof data.code === "string" ? data.code : undefined,
        raw: data,
      };
    }

    const charges = data.charges;
    const ch0 =
      Array.isArray(charges) && charges[0] && isRecord(charges[0])
        ? (charges[0] as Record<string, unknown>)
        : null;
    const status = String(ch0?.status ?? "");
    const chargeId = String(ch0?.id ?? data.id ?? "");

    if (status === "paid" || status === "captured") {
      return { status: "succeeded", chargeId, raw: data };
    }
    if (status === "pending" || status === "processing" || status === "authorized") {
      return { status: "pending", chargeId: chargeId || undefined, raw: data };
    }
    return {
      status: "failed",
      failureMessage: status ? `Pagar.me: status "${status}"` : "Pagar.me: cobrança não aprovada.",
      raw: data,
    };
  }

  async chargePix(input: ChargePixInput): Promise<PixChargeResult> {
    if (input.amount.currency !== "BRL") {
      return {
        status: "failed",
        failureMessage: "Pagar.me: PIX apenas em BRL.",
      };
    }
    const payer = input.payer;
    if (!payer?.email?.trim() || !payer.name?.trim()) {
      return {
        status: "failed",
        failureMessage:
          "Pagar.me: informe `payer.email` e `payer.name` em ChargePixInput.",
      };
    }
    const document = (payer.taxId ?? "").replace(/\D/g, "");
    if (document.length !== 11 && document.length !== 14) {
      return {
        status: "failed",
        failureMessage: "Pagar.me: `payer.taxId` (CPF/CNPJ) obrigatório para PIX.",
      };
    }

    const expiresIn = input.expiresInSeconds ?? 3600;
    const phoneDigits = (payer.phone ?? "11999999999").replace(/\D/g, "");
    const areaCode = phoneDigits.slice(0, 2) || "11";
    const number = phoneDigits.slice(2) || "999999999";

    const payment: Record<string, unknown> = {
      payment_method: "pix",
      pix: { expires_in: expiresIn },
    };
    if (input.split?.length) {
      payment.split = input.split.map((s) => ({
        type: "percentage",
        amount: Math.round(s.percentageBps / 100),
        recipient_id: s.recipientId,
        options: {
          liable: false,
          charge_processing_fee: false,
          charge_remainder_fee: false,
        },
      }));
    }

    const body = {
      code: input.idempotencyKey.slice(0, 52),
      currency: "BRL",
      closed: true,
      customer: {
        name: payer.name.slice(0, 64),
        email: payer.email.slice(0, 64),
        type: document.length === 14 ? "company" : "individual",
        document,
        phones: {
          mobile_phone: {
            country_code: "55",
            area_code: areaCode,
            number,
          },
        },
      },
      items: [
        {
          amount: input.amount.amountMinor,
          description: (input.metadata?.itemDescription ?? "Checkout").slice(
            0,
            256,
          ),
          quantity: 1,
          code: (input.metadata?.itemCode ?? "checkout").slice(0, 52),
        },
      ],
      payments: [payment],
      metadata: input.metadata ?? {},
    };

    const base = (
      process.env.PAGARME_API_BASE_URL ?? DEFAULT_BASE
    ).replace(/\/$/, "");
    const res = await fetch(`${base}/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${Buffer.from(`${this.credentials.secretKey}:`).toString("base64")}`,
        "Idempotency-Key": input.idempotencyKey,
      },
      body: JSON.stringify(body),
    });

    let data: unknown;
    try {
      data = (await res.json()) as unknown;
    } catch {
      return {
        status: "failed",
        failureMessage: `Pagar.me: resposta não-JSON (HTTP ${res.status}).`,
      };
    }
    if (!isRecord(data)) {
      return { status: "failed", failureMessage: "Pagar.me: resposta inválida." };
    }
    if (!res.ok) {
      return {
        status: "failed",
        failureMessage:
          typeof data.message === "string" ? data.message : `HTTP ${res.status}`,
        raw: data,
      };
    }

    const charges = data.charges;
    const ch0 =
      Array.isArray(charges) && charges[0] && isRecord(charges[0])
        ? charges[0]
        : null;
    const chargeId = String(ch0?.id ?? data.id ?? "");
    const lastTx =
      ch0 && isRecord(ch0.last_transaction) ? ch0.last_transaction : null;
    const qrCode =
      lastTx && typeof lastTx.qr_code === "string" ? lastTx.qr_code : "";
    const expiresRaw =
      lastTx && typeof lastTx.expires_at === "string"
        ? lastTx.expires_at
        : null;

    if (!qrCode) {
      return {
        status: "failed",
        failureMessage: "Pagar.me: QR Code PIX não retornado.",
        chargeId: chargeId || undefined,
        raw: data,
      };
    }

    return {
      status: "pending",
      chargeId: chargeId || undefined,
      pix: {
        copyPaste: qrCode,
        qrCodeBase64:
          lastTx && typeof lastTx.qr_code_url === "string"
            ? undefined
            : undefined,
        expiresAt: expiresRaw
          ? new Date(expiresRaw)
          : new Date(Date.now() + expiresIn * 1000),
      },
      raw: data,
    };
  }

  async createSubscription(input: CreateSubscriptionInput): Promise<SubscriptionResult> {
    if (input.currency !== "BRL") {
      return {
        status: "failed",
        failureMessage: "Pagar.me: assinaturas neste adapter apenas em BRL.",
      };
    }
    const payer = input.payer;
    const document = onlyDigits(payer.taxId);
    if (document.length !== 11 && document.length !== 14) {
      return {
        status: "failed",
        failureMessage: "Pagar.me: CPF/CNPJ obrigatório para assinatura.",
      };
    }

    const expYearShort =
      input.payment.card.expYear >= 2000
        ? input.payment.card.expYear % 100
        : input.payment.card.expYear;
    const phoneDigits = (payer.phone ?? "11999999999").replace(/\D/g, "");
    const areaCode = phoneDigits.slice(0, 2) || "11";
    const number = phoneDigits.slice(2) || "999999999";
    const addr = input.payment.card.billingAddress;

    const body: Record<string, unknown> = {
      code: input.idempotencyKey.slice(0, 52),
      plan_id: input.planReference,
      payment_method: "credit_card",
      customer: {
        name: payer.name.slice(0, 64),
        email: payer.email.slice(0, 64),
        code: input.customerReference.slice(0, 52),
        type: document.length === 14 ? "company" : "individual",
        document,
        document_type: document.length === 14 ? "CNPJ" : "CPF",
        phones: {
          mobile_phone: {
            country_code: "55",
            area_code: areaCode,
            number,
          },
        },
      },
      card: {
        number: input.payment.card.number.replace(/\s/g, ""),
        holder_name: input.payment.card.holderName,
        exp_month: input.payment.card.expMonth,
        exp_year: expYearShort,
        cvv: input.payment.card.cvv,
        ...(addr
          ? {
              billing_address: {
                line_1: addr.line1,
                line_2: addr.line2,
                zip_code: addr.postalCode,
                city: addr.city,
                state: addr.region,
                country: addr.country,
              },
            }
          : {}),
      },
      metadata: input.metadata ?? {},
    };

    if (input.trialDays && input.trialDays > 0) {
      const start = new Date();
      start.setDate(start.getDate() + input.trialDays);
      body.start_at = start.toISOString().slice(0, 10);
    }

    const base = (
      process.env.PAGARME_API_BASE_URL ?? DEFAULT_BASE
    ).replace(/\/$/, "");
    const res = await fetch(`${base}/subscriptions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${Buffer.from(`${this.credentials.secretKey}:`).toString("base64")}`,
        "Idempotency-Key": input.idempotencyKey,
      },
      body: JSON.stringify(body),
    });

    let data: unknown;
    try {
      data = (await res.json()) as unknown;
    } catch {
      return {
        status: "failed",
        failureMessage: `Pagar.me: resposta não-JSON (HTTP ${res.status}).`,
      };
    }
    if (!isRecord(data)) {
      return { status: "failed", failureMessage: "Pagar.me: resposta inválida." };
    }
    if (!res.ok) {
      return {
        status: "failed",
        failureMessage:
          typeof data.message === "string" ? data.message : `HTTP ${res.status}`,
        raw: data,
      };
    }

    const subId = String(data.id ?? "");
    const status = String(data.status ?? "").toLowerCase();

    if (status === "active" || status === "paid") {
      return { status: "active", subscriptionId: subId, raw: data };
    }
    if (status === "trialing" || status === "trial") {
      return { status: "trialing", subscriptionId: subId, raw: data };
    }
    if (subId) {
      return { status: "incomplete", subscriptionId: subId, raw: data };
    }
    return {
      status: "failed",
      failureMessage: status ? `Pagar.me: status "${status}"` : "Assinatura não criada.",
      raw: data,
    };
  }

  async tokenizeCard(_input: TokenizeCardInput): Promise<TokenizeCardResult> {
    void _input;
    void this.credentials;
    throw new Error(
      "PagarMeAdapter.tokenizeCard: integração HTTP não implementada — propagar idempotencyKey ao API client.",
    );
  }

  async processRefund(_input: ProcessRefundInput): Promise<RefundResult> {
    void _input;
    void this.credentials;
    throw new Error(
      "PagarMeAdapter.processRefund: integração HTTP não implementada — propagar idempotencyKey ao API client.",
    );
  }
}
