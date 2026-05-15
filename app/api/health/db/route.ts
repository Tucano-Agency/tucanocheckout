import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/infrastructure/db/client";
import { withDbRetry } from "@/lib/db-retry";
import { describePostgresFailure } from "@/lib/postgres-connection-hint";

export const runtime = "nodejs";

/** Diagnóstico em produção: mesma stack que o checkout (Node + Drizzle + DATABASE_URL). */
export async function GET(req: Request) {
  const secret = process.env.HEALTH_CHECK_SECRET?.trim();
  if (secret) {
    const auth = req.headers.get("authorization");
    const url = new URL(req.url);
    const qp = url.searchParams.get("secret");
    const authorized =
      auth === `Bearer ${secret}` || qp === secret;
    if (!authorized) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  try {
    await withDbRetry(() => db.execute(sql`SELECT 1`));
    const hasUrl = Boolean(process.env.DATABASE_URL?.trim());
    return NextResponse.json({
      ok: true,
      databaseUrlConfigured: hasUrl,
      vercelEnv: process.env.VERCEL_ENV ?? null,
    });
  } catch (e) {
    console.error("[health/db]", e);
    const { postgresCode, hint, detail } = describePostgresFailure(e);

    return NextResponse.json(
      {
        ok: false,
        postgresCode,
        hint,
        ...(detail ? { detail } : {}),
      },
      { status: 503 },
    );
  }
}
