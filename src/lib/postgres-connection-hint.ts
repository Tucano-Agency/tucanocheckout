/** Retorno seguro para JSON (sem stack trace). */

function extractDeepMessage(e: unknown): string {
  if (e instanceof AggregateError && Array.isArray(e.errors)) {
    return e.errors.map(extractDeepMessage).filter(Boolean).join(" | ");
  }
  if (e instanceof Error) {
    const parts = [e.message];
    if (e.cause) parts.push(extractDeepMessage(e.cause));
    return parts.filter(Boolean).join(" | ");
  }
  if (typeof e === "string") return e;
  if (e && typeof e === "object" && "message" in e) {
    return String((e as { message: unknown }).message);
  }
  return String(e);
}

function extractPostgresCode(e: unknown): string | null {
  const direct = (e as { code?: unknown }).code;
  if (typeof direct === "string" && direct.length > 0) return direct;
  if (e instanceof Error && e.cause) return extractPostgresCode(e.cause);
  return null;
}

/** Remove possíveis credenciais acidentais na mensagem. */
function sanitizeDetail(msg: string): string {
  return msg
    .replace(/postgresql:\/\/[^\s'"`]+/gi, "postgresql://***")
    .replace(/\$aact_[^\s'"`]+/gi, "$aact_***")
    .slice(0, 220);
}

export function describePostgresFailure(e: unknown): {
  readonly postgresCode: string | null;
  readonly hint: string;
  readonly detail?: string;
} {
  const code = extractPostgresCode(e);
  const msg = extractDeepMessage(e);

  if (code === "28P01" || /password authentication failed/i.test(msg)) {
    return {
      postgresCode: code,
      hint:
        "Autenticação recusada: senha incorreta, usuário sem projeto no pooler (Supabase Transaction usa postgres.PROJECT_REF na URI), ou caracteres na senha sem codificar (%40 para @, etc.).",
    };
  }

  if (/ENOTFOUND|getaddrinfo ENOTFOUND/i.test(msg)) {
    return {
      postgresCode: code,
      hint: "Hostname não resolve (DNS). Copie de novo a URI completa no painel Supabase.",
    };
  }

  if (/ECONNREFUSED/i.test(msg)) {
    return {
      postgresCode: code,
      hint: "Porta/host incorretos — Transaction pooler (shared): 6543; conexão direta: 5432.",
    };
  }

  if (/timeout|ETIMEDOUT|Timed out/i.test(msg)) {
    return {
      postgresCode: code,
      hint:
        "Timeout — projeto Supabase pausado (free), rede restrita em Database → Network, ou cold start lento. Aguarde e tente de novo.",
    };
  }

  if (/certificate|unable to verify|SELF_SIGNED|SSL|TLS/i.test(msg)) {
    return {
      postgresCode: code,
      hint:
        "Falha de TLS/SSL. Confira ?sslmode=require na URI ou parâmetros ssl conflitantes; veja detail.",
      detail: sanitizeDetail(msg),
    };
  }

  if (/invalid URI|Invalid URL|parse.*connection/i.test(msg)) {
    return {
      postgresCode: code,
      hint: "DATABASE_URL inválida ou truncada na Vercel (aspas, quebra de linha, caracteres não codificados).",
      detail: sanitizeDetail(msg),
    };
  }

  if (/Tenant.*not found|MaxClients/i.test(msg)) {
    return {
      postgresCode: code,
      hint:
        "Limite de conexões do Supabase ou configuração do pooler — use modo Transaction e max conexões baixo.",
    };
  }

  return {
    postgresCode: code,
    hint:
      "Erro não classificado — veja detail e os Logs da função na Vercel (filtrar /api/health/db). Garanta redeploy com o último código do repositório.",
    detail: msg.trim().length > 0 ? sanitizeDetail(msg) : undefined,
  };
}
