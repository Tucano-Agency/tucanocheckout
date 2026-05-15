import { createCipheriv, createDecipheriv, randomBytes, createHash } from "node:crypto";
import type { IGatewayCredentialCrypt } from "@/domain/ports/IGatewayCredentialCrypt";

const V1 = 1 as const;
const IV_LEN = 12;
const KEY_LEN = 32;

export interface EnvelopeV1 {
  readonly v: typeof V1;
  readonly iv: string;
  readonly tag: string;
  readonly ciphertext: string;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Deriva chave AES-256 a partir do segredo mestre (32 bytes após hash SHA-256). */
function deriveAesKey(masterSecretUtf8: string): Buffer {
  return createHash("sha256").update(masterSecretUtf8, "utf8").digest();
}

function decodeKeyFromEnv(): Buffer {
  const b64 = process.env.TUCANO_GATEWAY_MASTER_KEY;
  if (!b64) {
    throw new Error(
      "TUCANO_GATEWAY_MASTER_KEY ausente: defina uma chave base64 com 32 bytes aleatórios para criptografar credenciais BYOG.",
    );
  }
  const raw = Buffer.from(b64, "base64");
  if (raw.length === KEY_LEN) return raw;
  if (b64.length >= 16) return deriveAesKey(b64);
  throw new Error(
    "TUCANO_GATEWAY_MASTER_KEY inválida: use base64 de 32 bytes ou uma string longa o suficiente para derivação.",
  );
}

/**
 * Criptografia local (dev/staging). Produção: substituir por KMS/HSM mantendo a mesma porta `IGatewayCredentialCrypt`.
 */
export class AesGcmGatewayCredentialCrypt implements IGatewayCredentialCrypt {
  private readonly key: Buffer;

  constructor(masterKey?: Buffer) {
    this.key = masterKey ?? decodeKeyFromEnv();
    if (this.key.length !== KEY_LEN) {
      throw new Error("Chave AES deve ter 32 bytes.");
    }
  }

  decryptCredentialBlob(
    encryptedCredentialBlob: string,
    _encryptionKeyVersion: number,
  ): string {
    void _encryptionKeyVersion;
    let outer: unknown;
    try {
      outer = JSON.parse(encryptedCredentialBlob) as unknown;
    } catch {
      throw new Error("encrypted_credential_blob não é JSON válido.");
    }
    if (!isRecord(outer)) throw new Error("Envelope de credencial inválido.");
    if (outer.v !== V1) throw new Error(`Versão de envelope não suportada: ${String(outer.v)}`);
    const iv = outer.iv;
    const tag = outer.tag;
    const ciphertext = outer.ciphertext;
    if (
      typeof iv !== "string" ||
      typeof tag !== "string" ||
      typeof ciphertext !== "string"
    ) {
      throw new Error("Envelope v1 incompleto (iv/tag/ciphertext).");
    }
    const ivBuf = Buffer.from(iv, "base64");
    const tagBuf = Buffer.from(tag, "base64");
    const ctBuf = Buffer.from(ciphertext, "base64");
    const decipher = createDecipheriv("aes-256-gcm", this.key, ivBuf);
    decipher.setAuthTag(tagBuf);
    const plain = Buffer.concat([decipher.update(ctBuf), decipher.final()]);
    return plain.toString("utf8");
  }
}

/** Utilitário para persistir credenciais (scripts de seed / painel interno). */
export function encryptGatewayCredentialJsonV1(
  plaintextJsonUtf8: string,
  masterKey?: Buffer,
): string {
  const key = masterKey ?? decodeKeyFromEnv();
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([
    cipher.update(plaintextJsonUtf8, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  const envelope: EnvelopeV1 = {
    v: V1,
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    ciphertext: enc.toString("base64"),
  };
  return JSON.stringify(envelope);
}
