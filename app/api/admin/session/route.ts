import { NextResponse } from "next/server";
import {
  clearAdminSessionCookie,
  setAdminSessionCookie,
} from "@/lib/admin-session";
import { eq } from "drizzle-orm";
import { db } from "@/infrastructure/db/client";
import { tenants } from "@/infrastructure/db/schema";
import { withDbRetry } from "@/lib/db-retry";
import { describePostgresFailure } from "@/lib/postgres-connection-hint";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { ok: false, message: "JSON inválido." },
        { status: 400 },
      );
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

    let tenantRow:
      | {
          slug: string | null;
        }
      | undefined;
    try {
      const rows = await withDbRetry(() =>
        db
          .select({ slug: tenants.slug })
          .from(tenants)
          .where(eq(tenants.slug, tenantSlug))
          .limit(1),
      );
      tenantRow = rows[0];
    } catch (dbErr) {
      console.error("[admin/session] erro ao consultar tenant:", dbErr);
      const { postgresCode, hint, detail } = describePostgresFailure(dbErr);
      return NextResponse.json(
        {
          ok: false,
          message:
            "Erro ao conectar ao banco. O slug Production está certo — falha é rede/autenticação ou projeto pausado. Veja `postgresCode`, `hint` e `detail` abaixo.",
          postgresCode,
          hint,
          ...(detail ? { detail } : {}),
        },
        { status: 503 },
      );
    }

    if (!tenantRow) {
      return NextResponse.json(
        { ok: false, message: "Tenant não encontrado." },
        { status: 404 },
      );
    }

    try {
      await setAdminSessionCookie(tenantSlug);
    } catch (cookieErr) {
      console.error("[admin/session] erro ao definir cookie:", cookieErr);
      return NextResponse.json(
        {
          ok: false,
          message:
            "Não foi possível criar a sessão. Verifique TUCANO_ADMIN_SECRET (mín. 16 caracteres) e redeploy.",
        },
        { status: 503 },
      );
    }
    return NextResponse.json({ ok: true, tenantSlug });
  } catch (err) {
    console.error("[admin/session]", err);
    return NextResponse.json(
      {
        ok: false,
        message: "Erro interno ao processar login. Veja os logs na Vercel.",
      },
      { status: 500 },
    );
  }
}

export async function DELETE() {
  try {
    await clearAdminSessionCookie();
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[admin/session DELETE]", err);
    return NextResponse.json(
      { ok: false, message: "Não foi possível encerrar a sessão." },
      { status: 500 },
    );
  }
}
