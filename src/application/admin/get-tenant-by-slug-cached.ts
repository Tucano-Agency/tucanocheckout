import { cache } from "react";
import { eq } from "drizzle-orm";
import { db } from "@/infrastructure/db/client";
import { tenants } from "@/infrastructure/db/schema";

/** Uma query por request de navegação (layout + página compartilham o mesmo resultado). */
export const getTenantBySlugCached = cache(async (slug: string) => {
  const [row] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.slug, slug))
    .limit(1);
  return row ?? null;
});
