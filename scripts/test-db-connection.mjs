/**
 * Testa a mesma DATABASE_URL que você usa na Vercel.
 *
 * Uso (cole a URI inteira entre aspas simples):
 *   DATABASE_URL='postgresql://...' npm run db:test
 */
import postgres from "postgres";

const url = process.env.DATABASE_URL?.trim();
if (!url) {
  console.error("Defina DATABASE_URL (copie da Vercel → Settings → Environment Variables).");
  process.exit(1);
}

const pooler =
  url.includes(":6543") || url.includes("pooler.supabase");
const supabase =
  url.includes("supabase.co") || url.includes("pooler.supabase");

const sql = postgres(url, {
  max: 1,
  connect_timeout: 25,
  ...(pooler ? { prepare: false } : {}),
  ...(supabase ? { ssl: "require" } : {}),
});

try {
  const rows = await sql`SELECT 1 AS ok`;
  console.log("Conexão OK:", rows[0]);
} catch (e) {
  const msg = e instanceof Error ? e.message : String(e);
  console.error("Falha:", msg);
  if (supabase && pooler) {
    console.error(
      "\nVerifique no Supabase (Database → Connect): URI do modo Transaction, usuário no formato postgres.SEU_PROJECT_REF e porta 6543.",
    );
  }
  process.exit(1);
} finally {
  await sql.end({ timeout: 5 });
}
