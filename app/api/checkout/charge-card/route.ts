import { NextResponse } from "next/server";
import { chargeOfferCard } from "@/application/checkout/charge-offer-card";
import { chargeCardBodySchema } from "@/application/checkout/charge-card.schema";
import { PaymentOrchestrationError } from "@/application/payment/PaymentOrchestrator";
import { db } from "@/infrastructure/db/client";
import { getTenantPaymentOrchestrator } from "@/server/payment-bootstrap";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, code: "invalid_json", message: "Corpo JSON inválido." },
      { status: 400 },
    );
  }

  const parsed = chargeCardBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        code: "validation_error",
        message: "Dados inválidos.",
        details: parsed.error.flatten(),
      },
      { status: 422 },
    );
  }

  const remoteIp =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    undefined;

  let result;
  try {
    result = await chargeOfferCard(
      db,
      getTenantPaymentOrchestrator,
      parsed.data,
      remoteIp,
    );
  } catch (e) {
    if (e instanceof PaymentOrchestrationError) {
      return NextResponse.json(
        { ok: false, code: "gateway_config", message: e.message },
        { status: 503 },
      );
    }
    console.error("[charge-card]", e);
    return NextResponse.json(
      {
        ok: false,
        code: "internal_error",
        message: "Erro interno ao processar pagamento. Tente novamente.",
      },
      { status: 500 },
    );
  }

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, code: result.code, message: result.message },
      { status: result.httpStatus },
    );
  }

  if (result.status === "failed") {
    return NextResponse.json(
      {
        ok: false,
        code: "payment_failed",
        message:
          result.failureMessage ??
          "Pagamento recusado pelo gateway. Verifique os dados e tente de novo.",
        orderId: result.orderId,
        status: result.status,
        gatewayProvider: result.gatewayProvider,
      },
      { status: 402 },
    );
  }

  const statusHttp = result.status === "paid" ? 200 : 202;

  return NextResponse.json(
    {
      ok: true,
      orderId: result.orderId,
      status: result.status,
      chargeId: result.chargeId,
      gatewayProvider: result.gatewayProvider,
      replay: result.replay,
    },
    { status: statusHttp },
  );
}
