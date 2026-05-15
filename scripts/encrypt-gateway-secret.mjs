/**
 * Gera `encrypted_credential_blob` para coluna tenant_gateways (envelope v1).
 *
 * Uso:
 *   TUCANO_GATEWAY_MASTER_KEY="$(node -e "console.log(require('crypto').randomBytes(32).toString('base64'))")" \
 *   node scripts/encrypt-gateway-secret.mjs pagarme '{"secretKey":"sk_test_..."}'
 *
 * Requer TUCANO_GATEWAY_MASTER_KEY (base64 32 bytes ou string longa para derivação SHA-256).
 */
import { createCipheriv, createHash, randomBytes } from "node:crypto";

const V1 = 1;
const IV_LEN = 12;
const KEY_LEN = 32;

function decodeKey() {
  const b64 = process.env.TUCANO_GATEWAY_MASTER_KEY;
  if (!b64) {
    console.error("Defina TUCANO_GATEWAY_MASTER_KEY");
    process.exit(1);
  }
  const raw = Buffer.from(b64, "base64");
  if (raw.length === KEY_LEN) return raw;
  if (b64.length >= 16) return createHash("sha256").update(b64, "utf8").digest();
  console.error("Chave inválida");
  process.exit(1);
}

const [, , provider, json] = process.argv;
if (!json || (provider !== "pagarme" && provider !== "asaas")) {
  console.error(
    "Uso: node scripts/encrypt-gateway-secret.mjs <pagarme|asaas> '<json credenciais>'",
  );
  process.exit(1);
}

const key = decodeKey();
const iv = randomBytes(IV_LEN);
const cipher = createCipheriv("aes-256-gcm", key, iv);
const enc = Buffer.concat([cipher.update(json, "utf8"), cipher.final()]);
const tag = cipher.getAuthTag();
const envelope = {
  v: V1,
  iv: iv.toString("base64"),
  tag: tag.toString("base64"),
  ciphertext: enc.toString("base64"),
};
console.log(JSON.stringify(envelope));
