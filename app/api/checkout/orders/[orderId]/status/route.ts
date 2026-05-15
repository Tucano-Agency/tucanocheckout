import { NextResponse } from "next/server";
import { getPublicOrderStatus } from "@/application/checkout/get-order-status";
import { db } from "@/infrastructure/db/client";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ orderId: string }> };

export async function GET(_req: Request, context: RouteContext) {
  const { orderId } = await context.params;
  const uuidRe =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidRe.test(orderId)) {
    return NextResponse.json(
      { ok: false, code: "invalid_id", message: "ID de pedido inválido." },
      { status: 400 },
    );
  }

  const status = await getPublicOrderStatus(db, orderId);
  if (!status) {
    return NextResponse.json(
      { ok: false, code: "not_found", message: "Pedido não encontrado." },
      { status: 404 },
    );
  }

  return NextResponse.json({ ok: true, ...status });
}
