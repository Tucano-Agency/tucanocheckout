import { and, eq } from "drizzle-orm";
import type { Database } from "@/infrastructure/db/client";
import { orders, transactions } from "@/infrastructure/db/schema";

export type WebhookApplyResult =
  | { readonly applied: true; readonly orderId: string; readonly transactionId: string }
  | { readonly applied: false; readonly reason: string };

/**
 * Atualiza transação/pedido quando o gateway confirma pagamento (PIX/cartão assíncrono).
 */
export async function applyPaymentConfirmed(
  db: Database,
  input: {
    gatewayProvider: "pagarme" | "asaas";
    gatewayChargeId: string;
    gatewayMetadata?: Record<string, unknown>;
  },
): Promise<WebhookApplyResult> {
  const [tx] = await db
    .select()
    .from(transactions)
    .where(
      and(
        eq(transactions.gatewayProvider, input.gatewayProvider),
        eq(transactions.gatewayChargeId, input.gatewayChargeId),
      ),
    )
    .limit(1);

  if (!tx) {
    return { applied: false, reason: "transaction_not_found" };
  }

  if (tx.status === "succeeded") {
    return {
      applied: true,
      orderId: tx.orderId ?? "",
      transactionId: tx.id,
    };
  }

  await db
    .update(transactions)
    .set({
      status: "succeeded",
      updatedAt: new Date(),
      ...(input.gatewayMetadata
        ? {
            gatewayMetadata: {
              ...(tx.gatewayMetadata as Record<string, unknown>),
              webhook: input.gatewayMetadata,
            },
          }
        : {}),
    })
    .where(eq(transactions.id, tx.id));

  if (tx.orderId) {
    await db
      .update(orders)
      .set({ status: "paid", updatedAt: new Date() })
      .where(eq(orders.id, tx.orderId));
  }

  return {
    applied: true,
    orderId: tx.orderId ?? "",
    transactionId: tx.id,
  };
}

export async function applyPaymentFailed(
  db: Database,
  input: {
    gatewayProvider: "pagarme" | "asaas";
    gatewayChargeId: string;
    failureReason?: string;
  },
): Promise<WebhookApplyResult> {
  const [tx] = await db
    .select()
    .from(transactions)
    .where(
      and(
        eq(transactions.gatewayProvider, input.gatewayProvider),
        eq(transactions.gatewayChargeId, input.gatewayChargeId),
      ),
    )
    .limit(1);

  if (!tx) {
    return { applied: false, reason: "transaction_not_found" };
  }

  await db
    .update(transactions)
    .set({
      status: "failed",
      failureReason: input.failureReason ?? "Pagamento recusado pelo gateway.",
      updatedAt: new Date(),
    })
    .where(eq(transactions.id, tx.id));

  if (tx.orderId) {
    await db
      .update(orders)
      .set({ status: "failed", updatedAt: new Date() })
      .where(eq(orders.id, tx.orderId));
  }

  return {
    applied: true,
    orderId: tx.orderId ?? "",
    transactionId: tx.id,
  };
}
