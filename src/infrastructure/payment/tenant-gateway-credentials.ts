/**
 * Credenciais descriptografadas em memória — ciclo de vida curto, nunca logar.
 * Populadas a partir de `tenant_gateways.encrypted_credential_blob` + KMS.
 */
export interface PagarMeGatewayCredentials {
  readonly secretKey: string;
  readonly publicKey?: string;
  readonly accountId?: string;
}

export interface AsaasGatewayCredentials {
  readonly apiKey: string;
  readonly walletId?: string;
  /** Ex.: `https://api-sandbox.asaas.com/v3` — padrão inferido pela chave se omitido. */
  readonly apiBaseUrl?: string;
}

export type TenantGatewayCredentials =
  | { readonly provider: "pagarme"; readonly pagarme: PagarMeGatewayCredentials }
  | { readonly provider: "asaas"; readonly asaas: AsaasGatewayCredentials };
