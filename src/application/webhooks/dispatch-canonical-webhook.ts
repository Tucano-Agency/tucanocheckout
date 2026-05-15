import type {
  CanonicalWebhookDispatchResult,
  CanonicalWebhookEvent,
} from "@/domain/webhooks/canonical-webhook-event";
import {
  applyPaymentConfirmed,
  applyPaymentFailed,
} from "@/application/webhooks/apply-payment-webhook";
import { applySubscriptionCyclePayment } from "@/application/webhooks/apply-subscription-cycle-payment";
import {
  applySubscriptionActivated,
  applySubscriptionCancelled,
} from "@/application/webhooks/apply-subscription-webhook";
import type { Database } from "@/infrastructure/db/client";
import { subscriptions } from "@/infrastructure/db/schema";
import { and, eq } from "drizzle-orm";
import { forwardCanonicalWebhook } from "@/infrastructure/webhooks/forward-canonical-webhook";

export async function dispatchCanonicalWebhook(
  db: Database,
  event: CanonicalWebhookEvent,
): Promise<CanonicalWebhookDispatchResult> {
  void forwardCanonicalWebhook(event);

  if (event.type === "ignored") {
    return {
      received: true,
      eventType: "ignored",
      applied: false,
      detail: event.reason,
    };
  }

  switch (event.type) {
    case "payment.confirmed": {
      let result = await applyPaymentConfirmed(db, {
        gatewayProvider: event.provider,
        gatewayChargeId: event.chargeId,
        gatewayMetadata: event.raw,
      });

      if (!result.applied && event.subscriptionId) {
        const cycle = await applySubscriptionCyclePayment(db, {
          gatewayProvider: event.provider,
          gatewayChargeId: event.chargeId,
          gatewaySubscriptionId: event.subscriptionId,
          amountMinor: event.amountMinor,
          gatewayMetadata: event.raw,
        });
        result = cycle;
      }

      return {
        received: true,
        eventType: event.type,
        applied: result.applied,
        detail: result.applied ? undefined : result.reason,
        orderId: result.applied ? result.orderId || undefined : undefined,
        transactionId: result.applied ? result.transactionId : undefined,
      };
    }

    case "payment.failed": {
      let result = await applyPaymentFailed(db, {
        gatewayProvider: event.provider,
        gatewayChargeId: event.chargeId,
        failureReason: event.failureReason,
      });

      if (!result.applied && event.subscriptionId) {
        const [sub] = await db
          .select({ id: subscriptions.id })
          .from(subscriptions)
          .where(
            and(
              eq(subscriptions.gatewayProvider, event.provider),
              eq(
                subscriptions.gatewaySubscriptionId,
                event.subscriptionId,
              ),
            ),
          )
          .limit(1);
        if (sub) {
          await db
            .update(subscriptions)
            .set({ status: "past_due", updatedAt: new Date() })
            .where(eq(subscriptions.id, sub.id));
          result = {
            applied: true,
            orderId: "",
            transactionId: "",
          };
        }
      }

      return {
        received: true,
        eventType: event.type,
        applied: result.applied,
        detail: result.applied ? undefined : result.reason,
        orderId: result.applied ? result.orderId || undefined : undefined,
        transactionId: result.applied ? result.transactionId : undefined,
        subscriptionId: event.subscriptionId,
      };
    }

    case "subscription.activated": {
      const r = await applySubscriptionActivated(db, {
        gatewayProvider: event.provider,
        gatewaySubscriptionId: event.subscriptionId,
        status: event.status ?? "active",
      });
      return {
        received: true,
        eventType: event.type,
        applied: r.applied,
        subscriptionId: r.subscriptionId,
      };
    }

    case "subscription.cancelled": {
      const r = await applySubscriptionCancelled(db, {
        gatewayProvider: event.provider,
        gatewaySubscriptionId: event.subscriptionId,
      });
      return {
        received: true,
        eventType: event.type,
        applied: r.applied,
        subscriptionId: r.subscriptionId,
      };
    }

    case "subscription.past_due": {
      const [sub] = await db
        .select()
        .from(subscriptions)
        .where(
          and(
            eq(subscriptions.gatewayProvider, event.provider),
            eq(
              subscriptions.gatewaySubscriptionId,
              event.subscriptionId,
            ),
          ),
        )
        .limit(1);

      if (!sub) {
        return {
          received: true,
          eventType: event.type,
          applied: false,
          detail: "subscription_not_found",
        };
      }

      await db
        .update(subscriptions)
        .set({ status: "past_due", updatedAt: new Date() })
        .where(eq(subscriptions.id, sub.id));

      return {
        received: true,
        eventType: event.type,
        applied: true,
        subscriptionId: sub.id,
      };
    }
  }
}
