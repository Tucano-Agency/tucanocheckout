/** Retorno seguro para JSON (sem stack trace). */
export function describePostgresFailure(e: unknown): {
  readonly postgresCode: string | null;
  readonly hint: string;
} {
  const err = e as Error & { code?: string };
  const code = typeof err.code === "string" ? err.code : null;
  const msg = err instanceof Error ? err.message : String(e);

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
      hint: "Porta/host incorretos — Transaction pooler: 6543; conexão direta: 5432.",
    };
  }

  if (/timeout|ETIMEDOUT|Timed out/i.test(msg)) {
    return {
      postgresCode: code,
      hint:
        "Timeout — projeto Supabase pausado (free), rede restrita em Database → Network, ou cold start lento. Aguarde e tente de novo.",
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
      "Copie postgresCode + esta mensagem. Nos Logs da Vercel (função Node do POST admin/session ou página checkout) aparece o erro completo.",
  };
}
