/**
 * Porta: descriptografar blob persistido em `tenant_gateways.encrypted_credential_blob`.
 * Implementações concretas ficam em Infrastructure (AES-GCM, KMS envelope, etc.).
 */
export interface IGatewayCredentialCrypt {
  /** Retorna JSON UTF-8 das chaves do gateway (nunca logar). */
  decryptCredentialBlob(
    encryptedCredentialBlob: string,
    encryptionKeyVersion: number,
  ): string;
}
