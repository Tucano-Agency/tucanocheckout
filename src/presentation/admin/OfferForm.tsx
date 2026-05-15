"use client";

import { useState } from "react";

type Props = {
  readonly tenantSlug: string;
};

export function OfferForm({ tenantSlug }: Props) {
  const [productName, setProductName] = useState("");
  const [publicSlug, setPublicSlug] = useState("");
  const [amountReais, setAmountReais] = useState("");
  const [pricingMode, setPricingMode] = useState<"one_time" | "subscription">(
    "one_time",
  );
  const [pagarmePlanId, setPagarmePlanId] = useState("");
  const [trialDays, setTrialDays] = useState("0");
  const [message, setMessage] = useState<string | null>(null);
  const [checkoutPath, setCheckoutPath] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    setCheckoutPath(null);

    const res = await fetch(`/api/admin/${tenantSlug}/offers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productName,
        publicSlug,
        amountReais: Number.parseFloat(amountReais.replace(",", ".")),
        pricingMode,
        currency: "BRL",
        trialDays: Number.parseInt(trialDays, 10) || 0,
        pagarmePlanId: pagarmePlanId || undefined,
      }),
    });
    const data = (await res.json()) as {
      ok?: boolean;
      message?: string;
      checkoutPath?: string;
    };
    setLoading(false);
    if (!data.ok) {
      setMessage(data.message ?? "Erro ao criar oferta.");
      return;
    }
    setMessage("Oferta criada.");
    setCheckoutPath(data.checkoutPath ?? null);
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="max-w-lg space-y-4">
      <label className="block text-sm font-medium text-zinc-700">
        Nome do produto
        <input
          value={productName}
          onChange={(e) => setProductName(e.target.value)}
          className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2.5"
          required
        />
      </label>
      <label className="block text-sm font-medium text-zinc-700">
        Slug da URL (ex: meu-curso)
        <input
          value={publicSlug}
          onChange={(e) => setPublicSlug(e.target.value)}
          className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2.5"
          required
        />
      </label>
      <label className="block text-sm font-medium text-zinc-700">
        Preço (R$)
        <input
          inputMode="decimal"
          value={amountReais}
          onChange={(e) => setAmountReais(e.target.value)}
          className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2.5"
          required
        />
      </label>
      <label className="block text-sm font-medium text-zinc-700">
        Tipo
        <select
          value={pricingMode}
          onChange={(e) =>
            setPricingMode(e.target.value as "one_time" | "subscription")
          }
          className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2.5"
        >
          <option value="one_time">Pagamento único</option>
          <option value="subscription">Assinatura</option>
        </select>
      </label>
      {pricingMode === "subscription" ? (
        <>
          <label className="block text-sm font-medium text-zinc-700">
            ID do plano Pagar.me (plan_…)
            <input
              value={pagarmePlanId}
              onChange={(e) => setPagarmePlanId(e.target.value)}
              className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2.5 font-mono text-sm"
              placeholder="Obrigatório se usar Pagar.me"
            />
          </label>
          <label className="block text-sm font-medium text-zinc-700">
            Dias de trial
            <input
              type="number"
              min={0}
              value={trialDays}
              onChange={(e) => setTrialDays(e.target.value)}
              className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2.5"
            />
          </label>
        </>
      ) : null}

      {message ? (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {message}
          {checkoutPath ? (
            <>
              {" "}
              <a href={checkoutPath} className="font-semibold underline">
                Abrir checkout
              </a>
            </>
          ) : null}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={loading}
        className="rounded-xl bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
      >
        {loading ? "Criando…" : "Criar oferta"}
      </button>
    </form>
  );
}
