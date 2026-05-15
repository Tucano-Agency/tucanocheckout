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
import type { AsaasGatewayCredentials } from "./tenant-gateway-credentials";
import {
  addDays,
  formatDateYmd,
  toAsaasBillingCycle,
} from "./plan-interval";
import {
  asaasBaseUrl,
  asaasHeaders,
  ensureAsaasCustomer,
  onlyDigits,
} from "./asaas-customer";
import { asaasErrorMessage, readAsaasResponse } from "./asaas-http";
import { fetchAsaasPaymentPixQrCode } from "./asaas-pix-qr";
import { fetchAsaasSubscriptionFirstPaymentId } from "./asaas-subscription-payments";

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/**
 * Adapter Asaas — chaves dinâmicas do `TenantGateway` (BYOG).
 */
export class AsaasAdapter implements IPaymentGateway {
  readonly providerId = "asaas" as const;

  constructor(private readonly credentials: AsaasGatewayCredentials) {}

  async chargeCard(input: ChargeCardInput): Promise<ChargeResult> {
    const payer = input.payer;
    if (!payer?.email?.trim() || !payer.name?.trim()) {
      return {
        status: "failed",
        failureMessage:
          "Asaas: informe `payer.email` e `payer.name` em ChargeCardInput.",
      };
    }
    const taxId = payer.taxId ? onlyDigits(payer.taxId) : "";
    if (taxId.length !== 11 && taxId.length !== 14) {
      return {
        status: "failed",
        failureMessage:
          "Asaas: `payer.taxId` (CPF/CNPJ) é obrigatório para cobrança com cartão.",
      };
    }

    const ensured = await ensureAsaasCustomer(
      this.credentials,
      { email: payer.email, name: payer.name, taxId, phone: payer.phone },
      input.customerReference,
      input.idempotencyKey,
    );
    if ("error" in ensured) {
      return {
        status: "failed",
        failureMessage: ensured.error,
        raw: ensured.raw,
      };
    }

    const base = asaasBaseUrl(this.credentials);
    const addr = input.card.billingAddress;
    const valueReais = (input.amount.amountMinor / 100).toFixed(2);
    const dueDate = new Date().toISOString().slice(0, 10);
    const remoteIp = input.metadata?.remoteIp?.trim() || "127.0.0.1";

    const holderInfo: Record<string, unknown> = {
      name: payer.name,
      email: payer.email,
      cpfCnpj: taxId,
      postalCode: onlyDigits(addr?.postalCode ?? "01310100").slice(0, 8),
      address: addr?.line1 ?? "Rua",
      addressNumber: "1",
      phone: payer.phone ? onlyDigits(payer.phone).slice(0, 16) : "11999999999",
    };
    if (addr?.line2) holderInfo.complement = addr.line2;

    const paymentPayload: Record<string, unknown> = {
      customer: ensured.customerId,
      billingType: "CREDIT_CARD",
      value: Number.parseFloat(valueReais),
      dueDate,
      externalReference: input.idempotencyKey,
      creditCard: {
        holderName: input.card.holderName,
        number: onlyDigits(input.card.number),
        expiryMonth: pad2(input.card.expMonth),
        expiryYear: String(input.card.expYear),
        ccv: input.card.cvv,
      },
      creditCardHolderInfo: holderInfo,
      remoteIp,
    };

    const pr = await fetch(`${base}/payments`, {
      method: "POST",
      headers: asaasHeaders(this.credentials, input.idempotencyKey),
      body: JSON.stringify(paymentPayload),
      cache: "no-store",
    });
    const payParsed = await readAsaasResponse(pr);
    if (!payParsed.ok) {
      return { status: "failed", failureMessage: payParsed.message };
    }
    const payJson = payParsed.json;
    if (!isRecord(payJson)) {
      return {
        status: "failed",
        failureMessage: `Asaas: resposta inválida (HTTP ${pr.status}).`,
      };
    }
    if (!pr.ok) {
      return {
        status: "failed",
        failureMessage: asaasErrorMessage(payJson, `HTTP ${pr.status}`),
        raw: payJson,
      };
    }

    const st = String(payJson.status ?? "");
    const chargeId = String(payJson.id ?? "");
    if (
      st === "CONFIRMED" ||
      st === "RECEIVED" ||
      st === "RECEIVED_IN_CASH" ||
      st === "DUNNING_RECEIVED"
    ) {
      return { status: "succeeded", chargeId, raw: payJson };
    }
    if (st === "PENDING" || st === "AWAITING_RISK_ANALYSIS") {
      return { status: "pending", chargeId: chargeId || undefined, raw: payJson };
    }
    return {
      status: "failed",
      failureMessage:
        typeof payJson.refusalReason === "string"
          ? payJson.refusalReason
          : `Asaas: status "${st}"`,
      raw: payJson,
    };
  }

  async chargePix(input: ChargePixInput): Promise<PixChargeResult> {
    if (input.amount.currency !== "BRL") {
      return { status: "failed", failureMessage: "Asaas: PIX apenas em BRL." };
    }
    const payer = input.payer;
    if (!payer?.email?.trim() || !payer.name?.trim()) {
      return {
        status: "failed",
        failureMessage: "Asaas: informe `payer.email` e `payer.name`.",
      };
    }
    const taxId = payer.taxId ? onlyDigits(payer.taxId) : "";
    if (taxId.length !== 11 && taxId.length !== 14) {
      return {
        status: "failed",
        failureMessage: "Asaas: `payer.taxId` obrigatório para PIX.",
      };
    }

    const ensured = await ensureAsaasCustomer(
      this.credentials,
      { email: payer.email, name: payer.name, taxId, phone: payer.phone },
      input.customerReference,
      input.idempotencyKey,
    );
    if ("error" in ensured) {
      return {
        status: "failed",
        failureMessage: ensured.error,
        raw: ensured.raw,
      };
    }

    const base = asaasBaseUrl(this.credentials);
    const valueReais = (input.amount.amountMinor / 100).toFixed(2);
    const dueDate = new Date().toISOString().slice(0, 10);

    const pr = await fetch(`${base}/payments`, {
      method: "POST",
      headers: asaasHeaders(this.credentials, input.idempotencyKey),
      body: JSON.stringify({
        customer: ensured.customerId,
        billingType: "PIX",
        value: Number.parseFloat(valueReais),
        dueDate,
        externalReference: input.idempotencyKey,
      }),
      cache: "no-store",
    });
    const payParsed = await readAsaasResponse(pr);
    if (!payParsed.ok) {
      return { status: "failed", failureMessage: payParsed.message };
    }
    const payJson = payParsed.json;
    if (!isRecord(payJson) || !pr.ok) {
      return {
        status: "failed",
        failureMessage: asaasErrorMessage(payJson, `HTTP ${pr.status}`),
        raw: isRecord(payJson) ? payJson : undefined,
      };
    }

    const chargeId = String(payJson.id ?? "");
    if (!chargeId) {
      return {
        status: "failed",
        failureMessage: "Asaas: cobrança PIX sem ID.",
        raw: payJson,
      };
    }

    const qr = await fetchAsaasPaymentPixQrCode(this.credentials, chargeId);
    if (!qr.ok) {
      return {
        status: "failed",
        failureMessage: qr.message,
        chargeId,
        raw: payJson,
      };
    }

    return {
      status: "pending",
      chargeId,
      pix: {
        copyPaste: qr.data.payload,
        qrCodeBase64: qr.data.encodedImage,
        expiresAt: qr.data.expirationDate,
      },
      raw: payJson,
    };
  }

  async createSubscription(
    input: CreateSubscriptionInput,
  ): Promise<SubscriptionResult> {
    const payer = input.payer;
    const taxId = onlyDigits(payer.taxId);
    if (taxId.length !== 11 && taxId.length !== 14) {
      return {
        status: "failed",
        failureMessage: "Asaas: CPF/CNPJ obrigatório para assinatura.",
      };
    }

    const ensured = await ensureAsaasCustomer(
      this.credentials,
      { email: payer.email, name: payer.name, taxId, phone: payer.phone },
      input.customerReference,
      input.idempotencyKey,
    );
    if ("error" in ensured) {
      return {
        status: "failed",
        failureMessage: ensured.error,
        raw: ensured.raw,
      };
    }

    const base = asaasBaseUrl(this.credentials);
    const valueReais = (input.amountMinor / 100).toFixed(2);
    const trialDays = input.trialDays ?? 0;
    const nextDue = addDays(new Date(), trialDays > 0 ? trialDays : 0);
    const addr = input.payment.card.billingAddress;
    const remoteIp = input.metadata?.remoteIp?.trim() || "127.0.0.1";

    const holderInfo: Record<string, unknown> = {
      name: payer.name,
      email: payer.email,
      cpfCnpj: taxId,
      postalCode: onlyDigits(addr?.postalCode ?? "01310100").slice(0, 8),
      address: addr?.line1 ?? "Rua",
      addressNumber: "1",
      phone: payer.phone ? onlyDigits(payer.phone).slice(0, 16) : "11999999999",
    };
    if (addr?.line2) holderInfo.complement = addr.line2;

    const payload = {
      customer: ensured.customerId,
      billingType: "CREDIT_CARD",
      value: Number.parseFloat(valueReais),
      nextDueDate: formatDateYmd(nextDue),
      cycle: toAsaasBillingCycle(input.billingInterval, input.intervalCount),
      externalReference: input.idempotencyKey,
      description: input.metadata?.offerSlug ?? "Assinatura",
      creditCard: {
        holderName: input.payment.card.holderName,
        number: onlyDigits(input.payment.card.number),
        expiryMonth: pad2(input.payment.card.expMonth),
        expiryYear: String(input.payment.card.expYear),
        ccv: input.payment.card.cvv,
      },
      creditCardHolderInfo: holderInfo,
      remoteIp,
    };

    const res = await fetch(`${base}/subscriptions`, {
      method: "POST",
      headers: asaasHeaders(this.credentials, input.idempotencyKey),
      body: JSON.stringify(payload),
      cache: "no-store",
    });
    const parsed = await readAsaasResponse(res);
    if (!parsed.ok) {
      return { status: "failed", failureMessage: parsed.message };
    }
    const data = parsed.json;

    if (!isRecord(data) || !res.ok) {
      return {
        status: "failed",
        failureMessage: asaasErrorMessage(data, `HTTP ${res.status}`),
        raw: isRecord(data) ? data : undefined,
      };
    }

    const subId = String(data.id ?? "");
    const st = String(data.status ?? "");
    const firstPaymentId = subId
      ? await fetchAsaasSubscriptionFirstPaymentId(this.credentials, subId)
      : undefined;

    if (trialDays > 0 && subId) {
      return {
        status: "trialing",
        subscriptionId: subId,
        firstPaymentId,
        raw: data,
      };
    }
    if (st === "ACTIVE" || st === "CONFIRMED") {
      return {
        status: "active",
        subscriptionId: subId,
        firstPaymentId,
        raw: data,
      };
    }
    if (subId) {
      return {
        status: "incomplete",
        subscriptionId: subId,
        firstPaymentId,
        raw: data,
      };
    }
    return {
      status: "failed",
      failureMessage: `Asaas: status "${st}"`,
      raw: data,
    };
  }

  async tokenizeCard(_input: TokenizeCardInput): Promise<TokenizeCardResult> {
    void _input;
    throw new Error("AsaasAdapter.tokenizeCard: não implementado.");
  }

  async processRefund(_input: ProcessRefundInput): Promise<RefundResult> {
    void _input;
    throw new Error("AsaasAdapter.processRefund: não implementado.");
  }
}
