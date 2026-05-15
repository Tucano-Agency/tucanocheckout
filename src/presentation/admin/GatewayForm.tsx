"use client";

import { useState } from "react";

type Props = {
  readonly tenantSlug: string;
};

export function GatewayForm({ tenantSlug }: Props) {
  const [provider, setProvider] = useState<"pagarme" | "asaas">("pagarme");
  const [secretKey, setSecretKey] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [isDefault, setIsDefault] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    const credentials =
      provider === "pagarme"
        ? { secretKey: secretKey.trim() }
        : {
            apiKey: apiKey.trim(),
            ...(apiKey.trim().includes("hmlg")
              ? { apiBaseUrl: "https://api-sandbox.asaas.com/v3" }
              : {}),
          };

    const res = await fetch(`/api/admin/${tenantSlug}/gateways`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider,
        credentials,
        supportedCurrencies: ["BRL"],
        isDefault,
      }),
    });
    const data = (await res.json()) as { ok?: boolean; message?: string };
    setLoading(false);
    setMessage(
      data.ok
        ? "Gateway salvo. Credenciais criptografadas no banco."
        : (data.message ?? "Erro ao salvar."),
    );
    if (data.ok) {
      setSecretKey("");
      setApiKey("");
    }
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="max-w-lg space-y-5">
      <label className="block text-sm font-medium text-zinc-700">
        Provedor
        <select
          value={provider}
          onChange={(e) => setProvider(e.target.value as "pagarme" | "asaas")}
          className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2.5"
        >
          <option value="pagarme">Pagar.me</option>
          <option value="asaas">Asaas</option>
        </select>
      </label>

      {provider === "pagarme" ? (
        <label className="block text-sm font-medium text-zinc-700">
          Secret Key (sk_…)
          <input
            type="password"
            value={secretKey}
            onChange={(e) => setSecretKey(e.target.value)}
            className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2.5 font-mono text-sm"
            required
          />
        </label>
      ) : (
        <label className="block text-sm font-medium text-zinc-700">
          API Key Asaas
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2.5 font-mono text-sm"
            required
          />
        </label>
      )}

      <label className="flex items-center gap-2 text-sm text-zinc-700">
        <input
          type="checkbox"
          checked={isDefault}
          onChange={(e) => setIsDefault(e.target.checked)}
        />
        Gateway padrão para roteamento
      </label>

      {message ? (
        <p
          className={`rounded-lg px-3 py-2 text-sm ${
            message.includes("salvo")
              ? "bg-emerald-50 text-emerald-800"
              : "bg-red-50 text-red-800"
          }`}
        >
          {message}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={loading}
        className="rounded-xl bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
      >
        {loading ? "Salvando…" : "Salvar gateway"}
      </button>
    </form>
  );
}
