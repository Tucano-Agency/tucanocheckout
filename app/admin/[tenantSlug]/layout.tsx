import Link from "next/link";
import { requireAdminForTenant } from "@/lib/require-admin";
import { eq } from "drizzle-orm";
import { db } from "@/infrastructure/db/client";
import { tenants } from "@/infrastructure/db/schema";

type Props = {
  children: React.ReactNode;
  params: Promise<{ tenantSlug: string }>;
};

export default async function AdminTenantLayout({ children, params }: Props) {
  const { tenantSlug } = await params;
  await requireAdminForTenant(tenantSlug);

  const [tenant] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.slug, tenantSlug))
    .limit(1);

  return (
    <div className="min-h-dvh bg-zinc-50">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
              Tucano · Admin
            </p>
            <p className="font-semibold text-zinc-900">{tenant?.name ?? tenantSlug}</p>
          </div>
          <nav className="flex gap-4 text-sm font-medium text-zinc-600">
            <Link href={`/admin/${tenantSlug}`} className="hover:text-zinc-900">
              Início
            </Link>
            <Link
              href={`/admin/${tenantSlug}/gateways`}
              className="hover:text-zinc-900"
            >
              Gateways
            </Link>
            <Link
              href={`/admin/${tenantSlug}/offers`}
              className="hover:text-zinc-900"
            >
              Ofertas
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-8">{children}</main>
    </div>
  );
}
