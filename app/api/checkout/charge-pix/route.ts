import { NextResponse } from "next/server";
import { chargeOfferPix } from "@/application/checkout/charge-offer-pix";
import { chargePixBodySchema } from "@/application/checkout/charge-pix.schema";
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

  const parsed = chargePixBodySchema.safeParse(body);
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
    result = await chargeOfferPix(
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
    throw e;
  }

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, code: result.code, message: result.message },
      { status: result.httpStatus },
    );
  }

  const statusHttp =
    result.status === "paid"
      ? 200
      : result.status === "pending_payment"
        ? 201
        : 402;

  return NextResponse.json(
    {
      ok: true,
      orderId: result.orderId,
      status: result.status,
      chargeId: result.chargeId,
      gatewayProvider: result.gatewayProvider,
      replay: result.replay,
      pix: result.pix,
    },
    { status: statusHttp },
  );
}
