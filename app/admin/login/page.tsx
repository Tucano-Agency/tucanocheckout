"use client";

import Link from "next/link";
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
    type SessionJson = {
      ok?: boolean;
      message?: string;
      postgresCode?: string | null;
      hint?: string;
      detail?: string;
    };
    let data: SessionJson = {};
    if (raw.trim()) {
      try {
        data = JSON.parse(raw) as SessionJson;
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
    <div className="flex min-h-dvh flex-col lg:flex-row">
      <aside className="relative hidden shrink-0 flex-col justify-between overflow-hidden bg-zinc-950 px-10 py-12 text-white lg:flex lg:w-[42%] xl:w-[40%]">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' stroke='%23fff' stroke-width='0.5'%3E%3Cpath d='M0 30h60M30 0v60'/%3E%3C/g%3E%3C/svg%3E")`,
          }}
        />
        <div className="relative">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-400/90">
            Tucano Checkout
          </p>
          <h1 className="mt-6 max-w-sm text-3xl font-semibold leading-tight tracking-tight text-white">
            Painel do produtor
          </h1>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-zinc-400">
            Gateways BYOG, ofertas e pedidos num só lugar — checkout transparente
            para o seu infoproduto.
          </p>
        </div>
        <p className="relative text-xs text-zinc-600">
          © {new Date().getFullYear()} · Ambiente seguro com segredo de servidor
        </p>
      </aside>

      <main className="flex flex-1 flex-col items-center justify-center bg-gradient-to-br from-zinc-50 via-white to-emerald-50/50 px-4 py-12 sm:px-8">
        <div className="mb-8 text-center lg:hidden">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
            Tucano Checkout
          </p>
          <p className="mt-2 text-lg font-semibold text-zinc-900">
            Painel do produtor
          </p>
        </div>

        <form
          onSubmit={(e) => void onSubmit(e)}
          className="w-full max-w-[420px] rounded-2xl border border-zinc-200/90 bg-white/90 p-8 shadow-xl shadow-zinc-300/40 ring-1 ring-zinc-100 backdrop-blur-md sm:p-10"
        >
          <h2 className="text-lg font-semibold tracking-tight text-zinc-900">
            Entrar
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-zinc-500">
            Use o valor exato de{" "}
            <code className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-[11px] text-zinc-700">
              TUCANO_ADMIN_SECRET
            </code>{" "}
            nas variáveis do servidor (Vercel ou .env local). Mínimo 16 caracteres.
          </p>

          <div className="mt-4 rounded-xl border border-amber-200/80 bg-amber-50/90 px-4 py-3 text-xs leading-relaxed text-amber-950">
            O slug do tenant precisa existir no banco (ex.:{" "}
            <strong>demo</strong> após seed).
          </div>

          {error ? (
            <div className="mt-6 whitespace-pre-wrap rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-relaxed text-red-900">
              {error}
            </div>
          ) : null}

          <label className="mt-8 block text-sm font-medium text-zinc-700">
            Slug do tenant
            <input
              value={tenantSlug}
              onChange={(e) => setTenantSlug(e.target.value)}
              className="mt-2 w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm outline-none ring-emerald-500/20 transition-shadow placeholder:text-zinc-400 focus:border-emerald-500/60 focus:ring-4"
              placeholder="demo"
              autoComplete="off"
              required
            />
          </label>
          <label className="mt-5 block text-sm font-medium text-zinc-700">
            Segredo admin
            <input
              type="password"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              className="mt-2 w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm outline-none ring-emerald-500/20 transition-shadow focus:border-emerald-500/60 focus:ring-4"
              required
            />
          </label>
          <button
            type="submit"
            disabled={loading}
            className="mt-8 w-full rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-700 py-3.5 text-sm font-semibold text-white shadow-lg shadow-emerald-900/15 outline-none transition hover:from-emerald-500 hover:to-emerald-600 focus-visible:ring-4 focus-visible:ring-emerald-500/35 disabled:cursor-not-allowed disabled:opacity-55"
          >
            {loading ? "Entrando…" : "Continuar"}
          </button>

          <p className="mt-8 text-center text-xs text-zinc-400">
            <Link href="/" className="font-medium text-emerald-700 hover:underline">
              Voltar ao site
            </Link>
          </p>
        </form>
      </main>
    </div>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-dvh bg-gradient-to-br from-zinc-50 via-white to-emerald-50/50" />
      }
    >
      <LoginForm />
    </Suspense>
  );
}
