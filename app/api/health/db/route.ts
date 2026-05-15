import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/infrastructure/db/client";

export const runtime = "nodejs";

/** Diagnóstico em produção: mesma stack que o checkout (Node + Drizzle + DATABASE_URL). */
export async function GET() {
  try {
    await db.execute(sql`SELECT 1`);
    const hasUrl = Boolean(process.env.DATABASE_URL?.trim());
    return NextResponse.json({
      ok: true,
      databaseUrlConfigured: hasUrl,
      vercelEnv: process.env.VERCEL_ENV ?? null,
    });
  } catch (e) {
    const err = e as Error & { code?: string };
    console.error("[health/db]", e);
    const msg = err.message ?? String(e);
    let hint = "see_vercel_logs";
    if (/password authentication failed/i.test(msg)) {
      hint = "wrong_password_or_role_check_supabase_uri";
    } else if (/timeout|ETIMEDOUT/i.test(msg)) {
      hint = "timeout_network_or_supabase_pause";
    } else if (/ECONNREFUSED/i.test(msg)) {
      hint = "connection_refused_check_host_port";
    } else if (/ENOTFOUND/i.test(msg)) {
      hint = "dns_check_hostname";
    } else if (/SSL|certificate/i.test(msg)) {
      hint = "ssl_try_sslmode_require_in_uri";
    }

    return NextResponse.json(
      {
        ok: false,
        postgresCode: err.code ?? null,
        hint,
      },
      { status: 503 },
    );
  }
}
