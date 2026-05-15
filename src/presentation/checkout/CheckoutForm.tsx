"use client";

import { useMemo, useState } from "react";
import type { PublicOfferView } from "@/application/checkout/get-public-offer";
import { formatMoney } from "@/lib/format-money";

type PaymentTab = "card" | "pix";

type CheckoutFormProps = {
  readonly offer: PublicOfferView;
};

type FormState = {
  name: string;
  email: string;
  document: string;
  phone: string;
  holderName: string;
  cardNumber: string;
  expMonth: string;
  expYear: string;
  cvv: string;
  postalCode: string;
  line1: string;
  city: string;
  region: string;
};

type Step = "form" | "loading" | "pix" | "success" | "error";

type PixPayload = {
  copyPaste: string;
  qrCodeBase64?: string;
  expiresAt: string;
};

function digitsOnly(v: string): string {
  return v.replace(/\D/g, "");
}

function newIdempotencyKey(): string {
  return `chk_${crypto.randomUUID().replace(/-/g, "")}`;
}

const initialForm: FormState = {
  name: "",
  email: "",
  document: "",
  phone: "",
  holderName: "",
  cardNumber: "",
  expMonth: "",
  expYear: "",
  cvv: "",
  postalCode: "",
  line1: "",
  city: "",
  region: "SP",
};

export function CheckoutForm({ offer }: CheckoutFormProps) {
  const isSubscription = offer.pricingMode === "subscription";
  const pixAvailable =
    !isSubscription && offer.currency === "BRL";

  const [tab, setTab] = useState<PaymentTab>("card");
  const [form, setForm] = useState<FormState>(initialForm);
  const [step, setStep] = useState<Step>("form");
  const [error, setError] = useState<string | null>(null);
  const [pixData, setPixData] = useState<PixPayload | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const priceLabel = useMemo(
    () => formatMoney(offer.amountMinor, offer.currency),
    [offer.amountMinor, offer.currency],
  );

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function customerPayload() {
    return {
      email: form.email.trim(),
      name: form.name.trim(),
      document: digitsOnly(form.document),
      ...(form.phone.trim() ? { phone: digitsOnly(form.phone) } : {}),
    };
  }

  function cardPayload() {
    const year = Number.parseInt(form.expYear, 10);
    const month = Number.parseInt(form.expMonth, 10);
    const postal = digitsOnly(form.postalCode);
    return {
      holderName: form.holderName.trim() || form.name.trim(),
      number: digitsOnly(form.cardNumber),
      expMonth: month,
      expYear: year < 100 ? 2000 + year : year,
      cvv: form.cvv,
      billingAddress:
        postal.length >= 8
          ? {
              line1: form.line1.trim() || "Endereço",
              city: form.city.trim() || "São Paulo",
              region: form.region.trim().slice(0, 2).toUpperCase() || "SP",
              postalCode: postal,
              country: offer.currency === "BRL" ? "BR" : "US",
            }
          : undefined,
    };
  }

  async function submitCard() {
    setStep("loading");
    setError(null);
    const idempotencyKey = newIdempotencyKey();
    const endpoint = isSubscription
      ? "/api/checkout/subscribe"
      : "/api/checkout/charge-card";

    const body = {
      offerId: offer.offerId,
      idempotencyKey,
      customer: customerPayload(),
      card: cardPayload(),
    };

    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await res.json()) as {
      ok?: boolean;
      message?: string;
      status?: string;
    };

    if (!res.ok || !data.ok) {
      setStep("error");
      setError(data.message ?? "Não foi possível processar o pagamento.");
      return;
    }

    if (isSubscription) {
      setSuccessMessage(
        data.status === "trialing"
          ? "Assinatura iniciada. Seu período de teste está ativo."
          : "Assinatura confirmada. Obrigado!",
      );
    } else if (data.status === "pending_payment") {
      setSuccessMessage(
        "Pagamento em análise. Você receberá a confirmação em instantes.",
      );
    } else {
      setSuccessMessage("Pagamento aprovado. Obrigado pela compra!");
    }
    setStep("success");
  }

  async function submitPix() {
    setStep("loading");
    setError(null);
    const res = await fetch("/api/checkout/charge-pix", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        offerId: offer.offerId,
        idempotencyKey: newIdempotencyKey(),
        expiresInSeconds: 3600,
        customer: customerPayload(),
      }),
    });
    const data = (await res.json()) as {
      ok?: boolean;
      message?: string;
      pix?: PixPayload;
      status?: string;
    };

    if (!res.ok || !data.ok) {
      setStep("error");
      setError(data.message ?? "Não foi possível gerar o PIX.");
      return;
    }

    if (data.pix) {
      setPixData(data.pix);
      setStep("pix");
      return;
    }

    if (data.status === "paid") {
      setSuccessMessage("Pagamento PIX confirmado!");
      setStep("success");
      return;
    }

    setStep("error");
    setError("Resposta PIX incompleta. Tente novamente.");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (tab === "pix" && pixAvailable) {
      await submitPix();
    } else {
      await submitCard();
    }
  }

  async function copyPix() {
    if (!pixData?.copyPaste) return;
    await navigator.clipboard.writeText(pixData.copyPaste);
  }

  if (step === "success") {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-600 text-2xl text-white">
          ✓
        </div>
        <h2 className="text-xl font-semibold text-emerald-950">Tudo certo!</h2>
        <p className="mt-2 text-emerald-800">{successMessage}</p>
      </div>
    );
  }

  if (step === "pix" && pixData) {
    return (
      <div className="space-y-6">
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 text-center shadow-sm">
          <h2 className="text-lg font-semibold text-zinc-900">Pague com PIX</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Escaneie o QR Code ou copie o código abaixo
          </p>
          {pixData.qrCodeBase64 ? (
            <img
              src={`data:image/png;base64,${pixData.qrCodeBase64}`}
              alt="QR Code PIX"
              className="mx-auto mt-6 h-48 w-48 rounded-lg border border-zinc-100"
            />
          ) : null}
          <p className="mt-4 text-2xl font-bold text-zinc-900">{priceLabel}</p>
          <button
            type="button"
            onClick={() => void copyPix()}
            className="mt-6 w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700"
          >
            Copiar código PIX
          </button>
          <p className="mt-3 break-all rounded-lg bg-zinc-50 p-3 text-left text-xs text-zinc-600">
            {pixData.copyPaste}
          </p>
          <p className="mt-4 text-xs text-zinc-400">
            Válido até{" "}
            {new Date(pixData.expiresAt).toLocaleString("pt-BR")}
          </p>
        </div>
        <p className="text-center text-sm text-zinc-500">
          A confirmação é automática após o pagamento.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="space-y-6">
      {error ? (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          {error}
        </div>
      ) : null}

      {pixAvailable ? (
        <div className="flex gap-2 rounded-xl bg-zinc-100 p-1">
          <button
            type="button"
            onClick={() => setTab("card")}
            className={`flex-1 rounded-lg py-2.5 text-sm font-medium transition ${
              tab === "card"
                ? "bg-white text-zinc-900 shadow-sm"
                : "text-zinc-600 hover:text-zinc-900"
            }`}
          >
            Cartão
          </button>
          <button
            type="button"
            onClick={() => setTab("pix")}
            className={`flex-1 rounded-lg py-2.5 text-sm font-medium transition ${
              tab === "pix"
                ? "bg-white text-zinc-900 shadow-sm"
                : "text-zinc-600 hover:text-zinc-900"
            }`}
          >
            PIX
          </button>
        </div>
      ) : null}

      <section className="space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Seus dados
        </h3>
        <Field label="Nome completo">
          <input
            required
            value={form.name}
            onChange={(e) => update("name", e.target.value)}
            className={inputClass}
            autoComplete="name"
          />
        </Field>
        <Field label="E-mail">
          <input
            required
            type="email"
            value={form.email}
            onChange={(e) => update("email", e.target.value)}
            className={inputClass}
            autoComplete="email"
          />
        </Field>
        <Field label="CPF/CNPJ">
          <input
            required
            inputMode="numeric"
            value={form.document}
            onChange={(e) => update("document", e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Telefone (opcional)">
          <input
            inputMode="tel"
            value={form.phone}
            onChange={(e) => update("phone", e.target.value)}
            className={inputClass}
            autoComplete="tel"
          />
        </Field>
      </section>

      {tab === "card" ? (
        <section className="space-y-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
            {isSubscription ? "Cartão da assinatura" : "Cartão"}
          </h3>
          <Field label="Nome no cartão">
            <input
              required
              value={form.holderName}
              onChange={(e) => update("holderName", e.target.value)}
              className={inputClass}
              autoComplete="cc-name"
            />
          </Field>
          <Field label="Número do cartão">
            <input
              required
              inputMode="numeric"
              value={form.cardNumber}
              onChange={(e) => update("cardNumber", e.target.value)}
              className={inputClass}
              autoComplete="cc-number"
              placeholder="0000 0000 0000 0000"
            />
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Mês">
              <input
                required
                inputMode="numeric"
                maxLength={2}
                placeholder="MM"
                value={form.expMonth}
                onChange={(e) => update("expMonth", e.target.value)}
                className={inputClass}
                autoComplete="cc-exp-month"
              />
            </Field>
            <Field label="Ano">
              <input
                required
                inputMode="numeric"
                maxLength={4}
                placeholder="AAAA"
                value={form.expYear}
                onChange={(e) => update("expYear", e.target.value)}
                className={inputClass}
                autoComplete="cc-exp-year"
              />
            </Field>
            <Field label="CVV">
              <input
                required
                inputMode="numeric"
                maxLength={4}
                value={form.cvv}
                onChange={(e) => update("cvv", e.target.value)}
                className={inputClass}
                autoComplete="cc-csc"
              />
            </Field>
          </div>
          <Field label="CEP">
            <input
              inputMode="numeric"
              value={form.postalCode}
              onChange={(e) => update("postalCode", e.target.value)}
              className={inputClass}
            />
          </Field>
        </section>
      ) : null}

      <button
        type="submit"
        disabled={step === "loading"}
        className="w-full rounded-xl bg-emerald-600 px-4 py-4 text-base font-semibold text-white shadow-lg shadow-emerald-600/25 transition hover:bg-emerald-700 disabled:opacity-60"
      >
        {step === "loading"
          ? "Processando…"
          : tab === "pix"
            ? `Gerar PIX · ${priceLabel}`
            : isSubscription
              ? `Assinar · ${priceLabel}`
              : `Pagar · ${priceLabel}`}
      </button>

      <p className="text-center text-xs text-zinc-400">
        Pagamento processado com segurança. Seus dados de cartão não são
        armazenados por nós.
      </p>
    </form>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-zinc-700">
        {label}
      </span>
      {children}
    </label>
  );
}

const inputClass =
  "w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20";
