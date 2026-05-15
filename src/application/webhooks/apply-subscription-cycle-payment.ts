import { and, eq } from "drizzle-orm";
import type { CanonicalWebhookProvider } from "@/domain/webhooks/canonical-webhook-event";
import type { Database } from "@/infrastructure/db/client";
import { subscriptions, transactions } from "@/infrastructure/db/schema";
import type { WebhookApplyResult } from "@/application/webhooks/apply-payment-webhook";

/**
 * Confirma pagamento de assinatura quando não há transação com o chargeId
 * (ciclo recorrente ou primeira cobrança cujo ID só chega via webhook).
 */
export async function applySubscriptionCyclePayment(
  db: Database,
  input: {
    gatewayProvider: CanonicalWebhookProvider;
    gatewayChargeId: string;
    gatewaySubscriptionId: string;
    amountMinor?: number;
    gatewayMetadata?: Record<string, unknown>;
  },
): Promise<WebhookApplyResult> {
  const [existingByCharge] = await db
    .select()
    .from(transactions)
    .where(
      and(
        eq(transactions.gatewayProvider, input.gatewayProvider),
        eq(transactions.gatewayChargeId, input.gatewayChargeId),
      ),
    )
    .limit(1);

  if (existingByCharge?.status === "succeeded") {
    return {
      applied: true,
      orderId: existingByCharge.orderId ?? "",
      transactionId: existingByCharge.id,
    };
  }

  const [sub] = await db
    .select()
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.gatewayProvider, input.gatewayProvider),
        eq(
          subscriptions.gatewaySubscriptionId,
          input.gatewaySubscriptionId,
        ),
      ),
    )
    .limit(1);

  if (!sub) {
    return { applied: false, reason: "subscription_not_found" };
  }

  const [createTx] = await db
    .select()
    .from(transactions)
    .where(
      and(
        eq(transactions.subscriptionId, sub.id),
        eq(transactions.type, "subscription_create"),
      ),
    )
    .limit(1);

  if (
    createTx &&
    (!createTx.gatewayChargeId ||
      createTx.gatewayChargeId === input.gatewaySubscriptionId)
  ) {
    await db
      .update(transactions)
      .set({
        status: "succeeded",
        gatewayChargeId: input.gatewayChargeId,
        updatedAt: new Date(),
        ...(input.gatewayMetadata
          ? {
              gatewayMetadata: {
                ...(createTx.gatewayMetadata as Record<string, unknown>),
                webhook: input.gatewayMetadata,
              },
            }
          : {}),
      })
      .where(eq(transactions.id, createTx.id));

    if (sub.status === "incomplete" || sub.status === "past_due") {
      await db
        .update(subscriptions)
        .set({ status: "active", updatedAt: new Date() })
        .where(eq(subscriptions.id, sub.id));
    }

    return {
      applied: true,
      orderId: "",
      transactionId: createTx.id,
    };
  }

  const idempotencyKey = `webhook:${input.gatewayProvider}:${input.gatewayChargeId}`;
  const amountMinor = input.amountMinor ?? createTx?.amountMinor ?? 0;

  try {
    const [inserted] = await db
      .insert(transactions)
      .values({
        tenantId: sub.tenantId,
        subscriptionId: sub.id,
        type: "subscription_cycle",
        status: "succeeded",
        paymentMethod: createTx?.paymentMethod ?? "card",
        amountMinor,
        currency: createTx?.currency ?? "BRL",
        gatewayProvider: input.gatewayProvider,
        gatewayChargeId: input.gatewayChargeId,
        idempotencyKey,
        gatewayMetadata: input.gatewayMetadata ?? {},
      })
      .returning();

    if (sub.status === "incomplete" || sub.status === "past_due") {
      await db
        .update(subscriptions)
        .set({ status: "active", updatedAt: new Date() })
        .where(eq(subscriptions.id, sub.id));
    }

    return {
      applied: true,
      orderId: "",
      transactionId: inserted.id,
    };
  } catch {
    const [again] = await db
      .select()
      .from(transactions)
      .where(eq(transactions.idempotencyKey, idempotencyKey))
      .limit(1);
    if (again) {
      return {
        applied: true,
        orderId: "",
        transactionId: again.id,
      };
    }
    return { applied: false, reason: "cycle_insert_failed" };
  }
}
