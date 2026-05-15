import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-gradient-to-b from-zinc-50 to-emerald-50/30 px-6">
      <div className="max-w-md text-center">
        <p className="text-sm font-semibold uppercase tracking-widest text-emerald-700">
          Tucano Checkout
        </p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-zinc-900">
          Checkout transparente para infoprodutores
        </h1>
        <p className="mt-4 text-zinc-600">
          Plataforma em desenvolvimento. Acesse uma oferta pelo link do produtor:
        </p>
        <code className="mt-6 block rounded-xl bg-zinc-900 px-4 py-3 text-sm text-emerald-300">
          /checkout/[tenant]/[oferta]
        </code>
        <p className="mt-6 text-xs text-zinc-500">
          Ex.:{" "}
          <Link
            href="/checkout/demo/produto-lancamento"
            className="font-medium text-emerald-700 underline-offset-2 hover:underline"
          >
            /checkout/demo/produto-lancamento
          </Link>{" "}
          (após seed no banco)
        </p>
      </div>
    </main>
  );
}
