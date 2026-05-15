import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const rawUrl = process.env.DATABASE_URL?.trim();
const connectionString =
  rawUrl && rawUrl.length > 0
    ? rawUrl
    : "postgresql://localhost:5432/tucano_checkout";

/** Pooler Supabase/PgBouncer em modo transaction não aceita prepared statements. */
const looksLikePooler =
  connectionString.includes(":6543") ||
  connectionString.includes("pooler.supabase");

const looksLikeSupabaseRemote =
  connectionString.includes("supabase.co") ||
  connectionString.includes("pooler.supabase");

const client = postgres(connectionString, {
  max: Number(process.env.DATABASE_POOL_MAX ?? "1"),
  connect_timeout: Number(process.env.DATABASE_CONNECT_TIMEOUT ?? "25"),
  /** Não fechar conexão idle cedo — em Vercel isso quebrava queries após poucos segundos (default postgres.js é 0 = sem timeout). */
  ...(process.env.DATABASE_IDLE_TIMEOUT
    ? { idle_timeout: Number(process.env.DATABASE_IDLE_TIMEOUT) }
    : {}),
  ...(looksLikePooler ? { prepare: false } : {}),
  ...(looksLikeSupabaseRemote ? { ssl: "require" as const } : {}),
});

export const db = drizzle(client, { schema });

export type Database = typeof db;
