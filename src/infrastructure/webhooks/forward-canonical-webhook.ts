import type { CanonicalWebhookEvent } from "@/domain/webhooks/canonical-webhook-event";

/**
 * Encaminha evento canônico para o núcleo Tucano (opcional).
 * Falhas de rede não bloqueiam o processamento do gateway.
 */
export function forwardCanonicalWebhook(event: CanonicalWebhookEvent): void {
  const url = process.env.TUCANO_PLATFORM_WEBHOOK_URL?.trim();
  if (!url || event.type === "ignored") return;

  const secret = process.env.TUCANO_PLATFORM_WEBHOOK_SECRET?.trim();

  void fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(secret ? { "x-tucano-webhook-secret": secret } : {}),
    },
    body: JSON.stringify({
      source: "tucano-checkout",
      emittedAt: new Date().toISOString(),
      event,
    }),
    cache: "no-store",
  }).catch(() => {
    /* best-effort */
  });
}
