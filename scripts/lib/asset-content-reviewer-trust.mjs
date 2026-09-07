import { createHash, createPublicKey, verify } from 'node:crypto';
import { stableJson } from './asset-owner-trust.mjs';

export function parseContentReviewerTrust(bytesOrValue) {
  const trust = Buffer.isBuffer(bytesOrValue) || typeof bytesOrValue === 'string'
    ? JSON.parse(Buffer.from(bytesOrValue).toString('utf8'))
    : bytesOrValue;
  if (trust?.schema !== 'munjanggun.assetContentReviewerTrust.v1' || trust.version !== '1.0' || !Array.isArray(trust.keys)) {
    throw new Error('Content reviewer trust config is invalid');
  }
  const keyIds = new Set();
  const fingerprints = new Map();
  const principals = new Map();
  for (const item of trust.keys) {
    const principalId = normalizeReviewerPrincipal(item?.principalId);
    if (!principalId || !item?.keyId || keyIds.has(item.keyId) || !item.publicKeyPem || !['active', 'revoked'].includes(item.status)) {
      throw new Error('Content reviewer trust key is invalid or duplicated');
    }
    const fingerprint = createHash('sha256').update(item.publicKeyPem, 'utf8').digest('hex');
    if (fingerprint !== item.fingerprint) throw new Error(`Content reviewer trust key fingerprint mismatch: ${item.keyId}`);
    const priorPrincipal = fingerprints.get(fingerprint);
    if (priorPrincipal && priorPrincipal !== principalId) throw new Error('Content reviewer trust key fingerprint cannot represent multiple reviewer principals');
    fingerprints.set(fingerprint, principalId);
    keyIds.add(item.keyId);
    if (!principals.has(principalId)) principals.set(principalId, []);
    principals.get(principalId).push({ ...item, principalId });
  }
  return { document: trust, keys: [...principals.values()].flat(), principals };
}

export function verifyTrustedContentReviewerSignature(document, expectedPrincipalId, trust, label) {
  const principalId = normalizeReviewerPrincipal(expectedPrincipalId);
  const signature = document?.signature;
  if (!signature || signature.algorithm !== 'Ed25519') throw new Error(`${label} has no trusted reviewer signature`);
  const key = trust.keys.find((item) => item.keyId === signature.keyId && item.status === 'active' && item.principalId === principalId);
  if (!key) throw new Error(`${label} signing key is not trusted for the declared reviewer`);
  const payload = { ...document };
  delete payload.signature;
  const valid = verify(null, Buffer.from(stableJson(payload), 'utf8'), createPublicKey(key.publicKeyPem), Buffer.from(signature.valueBase64, 'base64'));
  if (!valid) throw new Error(`${label} reviewer signature is invalid`);
  return { principalId, keyId: key.keyId, fingerprint: key.fingerprint };
}

export function normalizeReviewerPrincipal(value) {
  return String(value ?? '').trim().normalize('NFKC').toLocaleLowerCase('en-US');
}
