import { createHash, createPublicKey, verify } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

export async function verifyTrustedOwnerSignature(document, label, configPath = fileURLToPath(new URL('../../config/asset-owner-trust.json', import.meta.url))) {
  const trust = JSON.parse(await readFile(configPath, 'utf8'));
  if (trust.schema !== 'munjanggun.assetOwnerTrust.v1' || trust.version !== '1.0' || !Array.isArray(trust.keys)) throw new Error('Owner trust config is invalid');
  if (new Set(trust.keys.map((item) => item.keyId)).size !== trust.keys.length) throw new Error('Owner trust config has duplicate key IDs');
  for (const item of trust.keys) {
    const fingerprint = createHash('sha256').update(item.publicKeyPem, 'utf8').digest('hex');
    if (item.fingerprint !== fingerprint) throw new Error(`Owner trust key fingerprint mismatch: ${item.keyId}`);
  }
  const signature = document.signature;
  if (!signature) throw new Error(`${label} has no trusted owner signature`);
  if (signature.algorithm !== 'Ed25519') throw new Error(`${label} signature algorithm is not allowed`);
  const key = trust.keys?.find((item) => item.keyId === signature.keyId && item.status === 'active');
  if (!key) throw new Error(`${label} signing key is not trusted`);
  const payload = { ...document };
  delete payload.signature;
  const valid = verify(null, Buffer.from(stableJson(payload), 'utf8'), createPublicKey(key.publicKeyPem), Buffer.from(signature.valueBase64, 'base64'));
  if (!valid) throw new Error(`${label} owner signature is invalid`);
  return { keyId: key.keyId, fingerprint: key.fingerprint };
}

export function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}
