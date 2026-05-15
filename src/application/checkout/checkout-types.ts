export type CheckoutFailure = {
  readonly ok: false;
  readonly httpStatus: number;
  readonly code: string;
  readonly message: string;
};

export type CheckoutPaymentSuccess = {
  readonly ok: true;
  readonly orderId: string;
  readonly status: "paid" | "pending_payment" | "failed";
  readonly chargeId?: string;
  readonly gatewayProvider: "pagarme" | "asaas";
  readonly replay: boolean;
};

export function checkoutFail(
  httpStatus: number,
  code: string,
  message: string,
): CheckoutFailure {
  return { ok: false, httpStatus, code, message };
}
