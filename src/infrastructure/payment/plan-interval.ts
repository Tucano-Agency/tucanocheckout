import type { plans } from "@/infrastructure/db/schema";

type PlanInterval = typeof plans.$inferSelect.interval;

/** Ciclo Asaas para assinatura. */
export function toAsaasBillingCycle(
  interval: PlanInterval,
  intervalCount: number,
): string {
  if (interval === "year") return "YEARLY";
  if (interval === "month" && intervalCount >= 6) return "SEMIANNUALLY";
  if (interval === "month" && intervalCount >= 3) return "QUARTERLY";
  if (interval === "month") return "MONTHLY";
  if (interval === "week") return "WEEKLY";
  return "MONTHLY";
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function formatDateYmd(d: Date): string {
  return d.toISOString().slice(0, 10);
}
