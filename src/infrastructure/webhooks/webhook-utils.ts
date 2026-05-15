export function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function readString(
  obj: Record<string, unknown>,
  key: string,
): string | undefined {
  const v = obj[key];
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

/** Asaas envia subscription como string ou objeto { id }. */
export function readAsaasSubscriptionId(
  payment: Record<string, unknown>,
): string | undefined {
  const sub = payment.subscription;
  if (typeof sub === "string" && sub.length > 0) return sub;
  if (isRecord(sub)) return readString(sub, "id");
  return undefined;
}

export function amountMinorFromDecimalString(
  value: unknown,
): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.round(value * 100);
  }
  if (typeof value === "string" && value.length > 0) {
    const n = Number.parseFloat(value);
    if (Number.isFinite(n)) return Math.round(n * 100);
  }
  return undefined;
}
