import { NextResponse } from "next/server";
import {
  clearAdminSessionCookie,
  setAdminSessionCookie,
} from "@/lib/admin-session";
import { eq } from "drizzle-orm";
import { db } from "@/infrastructure/db/client";
import { tenants } from "@/infrastructure/db/schema";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, message: "JSON inválido." }, { status: 400 });
  }

  const tenantSlug =
    typeof body === "object" &&
    body !== null &&
    "tenantSlug" in body &&
    typeof (body as { tenantSlug: unknown }).tenantSlug === "string"
      ? (body as { tenantSlug: string }).tenantSlug
      : "";
  const secret =
    typeof body === "object" &&
    body !== null &&
    "secret" in body &&
    typeof (body as { secret: unknown }).secret === "string"
      ? (body as { secret: string }).secret
      : "";

  const expected = process.env.TUCANO_ADMIN_SECRET;
  if (!expected || expected.length < 16) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "TUCANO_ADMIN_SECRET ausente ou com menos de 16 caracteres no servidor. Em produção (Vercel), defina em Settings → Environment Variables e faça redeploy.",
      },
      { status: 503 },
    );
  }

  if (secret !== expected) {
    return NextResponse.json(
      { ok: false, message: "Credenciais inválidas." },
      { status: 401 },
    );
  }

  const [tenant] = await db
    .select({ slug: tenants.slug })
    .from(tenants)
    .where(eq(tenants.slug, tenantSlug))
    .limit(1);

  if (!tenant) {
    return NextResponse.json(
      { ok: false, message: "Tenant não encontrado." },
      { status: 404 },
    );
  }

  try {
    await setAdminSessionCookie(tenantSlug);
  } catch {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Não foi possível criar a sessão. Verifique TUCANO_ADMIN_SECRET (mín. 16 caracteres) e reinicie o servidor.",
      },
      { status: 503 },
    );
  }
  return NextResponse.json({ ok: true, tenantSlug });
}

export async function DELETE() {
  await clearAdminSessionCookie();
  return NextResponse.json({ ok: true });
}
