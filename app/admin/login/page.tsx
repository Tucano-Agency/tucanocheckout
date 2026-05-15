"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { Suspense, useState } from "react";

function LoginForm() {
  const params = useSearchParams();
  const router = useRouter();
  const defaultTenant = params.get("tenant") ?? "demo";

  const [tenantSlug, setTenantSlug] = useState(defaultTenant);
  const [secret, setSecret] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/admin/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tenantSlug, secret }),
    });
    const raw = await res.text();
    let data: {
      ok?: boolean;
      message?: string;
      postgresCode?: string | null;
      hint?: string;
      detail?: string;
    } = {};
    if (raw.trim()) {
      try {
        data = JSON.parse(raw) as { ok?: boolean; message?: string };
      } catch {
        setLoading(false);
        setError(
          `Resposta inválida do servidor (HTTP ${res.status}). Veja os logs na Vercel ou se DATABASE_URL está correta.`,
        );
        return;
      }
    } else {
      setLoading(false);
      setError(
        `Servidor retornou HTTP ${res.status} sem corpo. Confira logs na Vercel e variáveis de ambiente.`,
      );
      return;
    }
    setLoading(false);
    if (!res.ok || !data.ok) {
      const parts = [data.message ?? "Falha ao entrar."];
      if (data.postgresCode)
        parts.push(`Postgres: ${data.postgresCode}`);
      if (data.hint) parts.push(data.hint);
      if (data.detail) parts.push(`Detalhe: ${data.detail}`);
      setError(parts.join("\n\n"));
      return;
    }
    router.push(`/admin/${tenantSlug}`);
    router.refresh();
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-zinc-50 px-4">
      <form
        onSubmit={(e) => void onSubmit(e)}
        className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-8 shadow-lg"
      >
        <h1 className="text-xl font-bold text-zinc-900">Painel do produtor</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Não é login de usuário no banco. Copie o valor exato de{" "}
          <code className="text-xs">TUCANO_ADMIN_SECRET</code> do seu{" "}
          <code className="text-xs">.env</code> (mín. 16 caracteres).
        </p>
        <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
          Em produção use as variáveis da Vercel (não só o .env local). Slug do
          tenant precisa existir no banco (ex.: <strong>demo</strong> após seed).
        </p>

        {error ? (
          <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </p>
        ) : null}

        <label className="mt-6 block text-sm font-medium text-zinc-700">
          Slug do tenant
          <input
            value={tenantSlug}
            onChange={(e) => setTenantSlug(e.target.value)}
            className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2.5"
            required
          />
        </label>
        <label className="mt-4 block text-sm font-medium text-zinc-700">
          Segredo admin
          <input
            type="password"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2.5"
            required
          />
        </label>
        <button
          type="submit"
          disabled={loading}
          className="mt-6 w-full rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
        >
          {loading ? "Entrando…" : "Entrar"}
        </button>
      </form>
    </main>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense fallback={<main className="min-h-dvh bg-zinc-50" />}>
      <LoginForm />
    </Suspense>
  );
}
