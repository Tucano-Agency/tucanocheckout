function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export type AsaasHttpResult =
  | { ok: true; status: number; json: unknown }
  | { ok: false; status: number; message: string; rawText?: string };

export async function readAsaasResponse(res: Response): Promise<AsaasHttpResult> {
  const text = await res.text();
  const trimmed = text.trim();

  if (!trimmed) {
    if (res.status === 409) {
      return {
        ok: false,
        status: res.status,
        message:
          "Asaas: conflito na requisição (409). Recarregue a página do checkout e tente de novo.",
      };
    }
    const hint =
      res.status === 400
        ? " Verifique CPF/CNPJ válido, e-mail e telefone (10–11 dígitos, com DDD)."
        : "";
    return {
      ok: false,
      status: res.status,
      message: `Asaas: resposta vazia (HTTP ${res.status}).${hint}`,
    };
  }

  if (trimmed.startsWith("<")) {
    return {
      ok: false,
      status: res.status,
      message:
        "Asaas retornou HTML em vez de JSON — confira se a chave é do sandbox (prefixo $aact_hmlg_) e se o gateway foi salvo após atualizar o app.",
      rawText: trimmed.slice(0, 200),
    };
  }

  try {
    return { ok: true, status: res.status, json: JSON.parse(trimmed) as unknown };
  } catch {
    return {
      ok: false,
      status: res.status,
      message: `Asaas: resposta inválida (HTTP ${res.status}).`,
      rawText: trimmed.slice(0, 200),
    };
  }
}

export function asaasErrorMessage(
  json: unknown,
  fallback: string,
): string {
  if (!isRecord(json)) return fallback;
  if (json.errors !== undefined) return JSON.stringify(json.errors);
  if (typeof json.message === "string") return json.message;
  return fallback;
}
