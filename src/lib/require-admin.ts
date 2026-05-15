import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/admin-session";

export async function requireAdminForTenant(tenantSlug: string) {
  const session = await getAdminSession();
  if (!session || session.tenantSlug !== tenantSlug) {
    redirect(`/admin/login?tenant=${encodeURIComponent(tenantSlug)}`);
  }
  return session;
}
