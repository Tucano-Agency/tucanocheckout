import Link from "next/link";

export default function CheckoutNotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 text-center">
      <h1 className="text-2xl font-bold text-zinc-900">Oferta não encontrada</h1>
      <p className="mt-2 max-w-sm text-zinc-600">
        Este link de checkout pode estar inativo ou o endereço está incorreto.
      </p>
      <Link
        href="/"
        className="mt-8 text-sm font-medium text-emerald-700 hover:text-emerald-800"
      >
        Voltar ao início
      </Link>
    </div>
  );
}
