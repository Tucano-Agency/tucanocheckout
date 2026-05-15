import { NextResponse } from "next/server";
import { createTenantOffer } from "@/application/admin/create-offer";
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
  const amountReais = Number(b.amountReais);
  if (!Number.isFinite(amountReais) || amountReais <= 0) {
    return NextResponse.json({ ok: false, message: "Valor inválido." }, { status: 400 });
  }

  const pricingMode = b.pricingMode === "subscription" ? "subscription" : "one_time";
  const currency =
    b.currency === "USD" || b.currency === "EUR" ? b.currency : "BRL";

  const result = await createTenantOffer(db, tenantSlug, {
    productName: String(b.productName ?? "").slice(0, 255),
    productDescription: b.productDescription
      ? String(b.productDescription)
      : undefined,
    publicSlug: String(b.publicSlug ?? "")
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "-")
      .slice(0, 160),
    pricingMode,
    amountMinor: Math.round(amountReais * 100),
    currency,
    planInterval: b.planInterval === "year" ? "year" : "month",
    planIntervalCount: Number(b.planIntervalCount) || 1,
    trialDays: Number(b.trialDays) || 0,
    pagarmePlanId: b.pagarmePlanId ? String(b.pagarmePlanId) : undefined,
  });

  if (!result.ok) {
    return NextResponse.json({ ok: false, message: result.message }, { status: 400 });
  }

  return NextResponse.json(result);
}
