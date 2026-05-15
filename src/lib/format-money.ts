const localeByCurrency: Record<string, string> = {
  BRL: "pt-BR",
  USD: "en-US",
  EUR: "de-DE",
};

export function formatMoney(amountMinor: number, currency: string): string {
  const locale = localeByCurrency[currency] ?? "pt-BR";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
  }).format(amountMinor / 100);
}

export function planIntervalLabel(
  interval: "day" | "week" | "month" | "year",
  count: number,
): string {
  const labels: Record<string, [string, string]> = {
    day: ["dia", "dias"],
    week: ["semana", "semanas"],
    month: ["mês", "meses"],
    year: ["ano", "anos"],
  };
  const [one, many] = labels[interval] ?? ["período", "períodos"];
  return count === 1 ? `a cada ${one}` : `a cada ${count} ${many}`;
}
