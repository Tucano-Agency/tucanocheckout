import { NextResponse } from "next/server";
import { saveTenantGateway } from "@/application/admin/save-tenant-gateway";
import { getAdminSession } from "@/lib/admin-session";
import { db } from "@/infrastructure/db/client";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ tenantSlug: string }> };

export async function POST(req: Request, context: Ctx) {
  const { tenantSlug } = await context.params;
  const session = await getAdminSession();
  if (!session || session.tenantSlug !== tenantSlug) {
    return NextResponse.json({ ok: false, message: "Não autorizado." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, message: "JSON inválido." }, { status: 400 });
  }

  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ ok: false, message: "Payload inválido." }, { status: 400 });
  }

  const b = body as Record<string, unknown>;
  const provider = b.provider;
  if (provider !== "pagarme" && provider !== "asaas") {
    return NextResponse.json({ ok: false, message: "Provider inválido." }, { status: 400 });
  }

  const credentials = b.credentials;
  if (typeof credentials !== "object" || credentials === null) {
    return NextResponse.json({ ok: false, message: "Credenciais inválidas." }, { status: 400 });
  }

  const rawCurrencies = Array.isArray(b.supportedCurrencies)
    ? b.supportedCurrencies
    : ["BRL"];
  const supportedCurrencies: ("BRL" | "USD" | "EUR")[] = [];
  for (const c of rawCurrencies) {
    if (c === "BRL" || c === "USD" || c === "EUR") supportedCurrencies.push(c);
  }
  if (supportedCurrencies.length === 0) supportedCurrencies.push("BRL");

  const result = await saveTenantGateway(db, tenantSlug, {
    provider,
    credentials: credentials as Record<string, string>,
    supportedCurrencies,
    isDefault: Boolean(b.isDefault),
  });

  if (!result.ok) {
    return NextResponse.json({ ok: false, message: result.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
