import type { AsaasGatewayCredentials } from "./tenant-gateway-credentials";
import { asaasBaseUrl, asaasHeaders } from "./asaas-customer";
import { asaasErrorMessage, readAsaasResponse } from "./asaas-http";

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export type AsaasPixQrData = {
  readonly payload: string;
  readonly encodedImage?: string;
  readonly expirationDate: Date;
};

const RETRY_DELAYS_MS = [0, 600, 1500];

/**
 * O QR dinâmico pode demorar alguns ms após criar o payment — retentamos antes de falhar.
 */
export async function fetchAsaasPaymentPixQrCode(
  creds: AsaasGatewayCredentials,
  chargeId: string,
): Promise<{ ok: true; data: AsaasPixQrData } | { ok: false; message: string }> {
  const base = asaasBaseUrl(creds);
  let lastMessage = "Asaas: falha ao obter QR Code PIX.";

  for (const waitMs of RETRY_DELAYS_MS) {
    if (waitMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }

    const qrRes = await fetch(`${base}/payments/${chargeId}/pixQrCode`, {
      headers: asaasHeaders(creds),
      cache: "no-store",
    });
    const qrParsed = await readAsaasResponse(qrRes);

    if (!qrParsed.ok) {
      lastMessage = qrParsed.message;
      if (qrRes.status === 404 || qrRes.status >= 500) continue;
      return { ok: false, message: lastMessage };
    }

    const qrJson = qrParsed.json;
    if (!isRecord(qrJson)) {
      lastMessage = `Asaas: resposta do QR PIX inválida (HTTP ${qrRes.status}).`;
      continue;
    }

    if (qrJson.success === false) {
      lastMessage = asaasErrorMessage(
        qrJson,
        "Asaas: QR PIX indisponível. Cadastre uma chave PIX na conta Asaas (sandbox.asaas.com → Pix).",
      );
      continue;
    }

    if (!qrRes.ok) {
      lastMessage = asaasErrorMessage(
        qrJson,
        `Asaas: falha ao obter QR Code PIX (HTTP ${qrRes.status}).`,
      );
      if (qrRes.status === 404 || qrRes.status >= 500) continue;
      return { ok: false, message: lastMessage };
    }

    const payload = typeof qrJson.payload === "string" ? qrJson.payload : "";
    if (!payload) {
      lastMessage = "Asaas: código copia-e-cola PIX vazio.";
      continue;
    }

    const expirationDate =
      typeof qrJson.expirationDate === "string"
        ? new Date(qrJson.expirationDate)
        : new Date(Date.now() + 3600 * 1000);

    return {
      ok: true,
      data: {
        payload,
        encodedImage:
          typeof qrJson.encodedImage === "string"
            ? qrJson.encodedImage
            : undefined,
        expirationDate,
      },
    };
  }

  return {
    ok: false,
    message: `${lastMessage} Se persistir, cadastre uma chave PIX em sandbox.asaas.com e salve o gateway de novo no admin.`,
  };
}
