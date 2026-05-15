import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString =
  process.env.DATABASE_URL ??
  "postgresql://localhost:5432/tucano_checkout";

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
  idle_timeout: Number(process.env.DATABASE_IDLE_TIMEOUT ?? "20"),
  ...(looksLikePooler ? { prepare: false } : {}),
  ...(looksLikeSupabaseRemote ? { ssl: "require" as const } : {}),
});

export const db = drizzle(client, { schema });

export type Database = typeof db;
