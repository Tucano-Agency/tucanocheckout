/** Erros comuns de rede / pool em serverless (repetir uma vez). */
export function isTransientDbError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  const code = (e as { code?: string }).code;

  if (
    code === "57P01" ||
    code === "57P02" ||
    code === "57P03" ||
    code === "ECONNRESET"
  ) {
    return true;
  }

  return (
    /ECONNRESET/i.test(msg) ||
    /ETIMEDOUT/i.test(msg) ||
    /EPIPE/i.test(msg) ||
    /ENOTFOUND/i.test(msg) ||
    /Connection terminated/i.test(msg) ||
    /connection closed/i.test(msg) ||
    (/ssl/i.test(msg) && /closed|reset|eof/i.test(msg)) ||
    /Socket closed/i.test(msg) ||
    /UND_ERR_SOCKET/i.test(msg)
  );
}

export async function withDbRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (!isTransientDbError(e)) throw e;
    await new Promise((r) => setTimeout(r, 400));
    return await fn();
  }
}
