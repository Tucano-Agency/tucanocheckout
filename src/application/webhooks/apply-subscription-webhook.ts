import { and, eq } from "drizzle-orm";
import type { Database } from "@/infrastructure/db/client";
import { subscriptions } from "@/infrastructure/db/schema";

export async function applySubscriptionActivated(
  db: Database,
  input: {
    gatewayProvider: "pagarme" | "asaas";
    gatewaySubscriptionId: string;
    status?: "active" | "trialing" | "past_due" | "cancelled";
  },
): Promise<{ applied: boolean; subscriptionId?: string }> {
  const [sub] = await db
    .select()
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.gatewayProvider, input.gatewayProvider),
        eq(subscriptions.gatewaySubscriptionId, input.gatewaySubscriptionId),
      ),
    )
    .limit(1);

  if (!sub) return { applied: false };

  const nextStatus = input.status ?? "active";
  await db
    .update(subscriptions)
    .set({ status: nextStatus, updatedAt: new Date() })
    .where(eq(subscriptions.id, sub.id));

  return { applied: true, subscriptionId: sub.id };
}

export async function applySubscriptionCancelled(
  db: Database,
  input: {
    gatewayProvider: "pagarme" | "asaas";
    gatewaySubscriptionId: string;
  },
): Promise<{ applied: boolean; subscriptionId?: string }> {
  const [sub] = await db
    .select()
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.gatewayProvider, input.gatewayProvider),
        eq(subscriptions.gatewaySubscriptionId, input.gatewaySubscriptionId),
      ),
    )
    .limit(1);

  if (!sub) return { applied: false };

  await db
    .update(subscriptions)
    .set({
      status: "cancelled",
      cancelledAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(subscriptions.id, sub.id));

  return { applied: true, subscriptionId: sub.id };
}
