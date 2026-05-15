const LABELS: Record<string, string> = {
  draft: "Rascunho",
  pending_payment: "Pagamento pendente",
  paid: "Pago",
  failed: "Falhou",
  refunded: "Reembolsado",
  partially_refunded: "Parcialmente reembolsado",
};

export function orderStatusLabelPt(status: string): string {
  return LABELS[status] ?? status;
}
