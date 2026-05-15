import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/infrastructure/db/client";
import { withDbRetry } from "@/lib/db-retry";
import { describePostgresFailure } from "@/lib/postgres-connection-hint";

export const runtime = "nodejs";

/** Diagnóstico em produção: mesma stack que o checkout (Node + Drizzle + DATABASE_URL). */
export async function GET() {
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
