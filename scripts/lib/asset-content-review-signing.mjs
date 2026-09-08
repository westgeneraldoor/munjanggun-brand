import {
  createHash,
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
  sign,
} from 'node:crypto';
import {
  chmod,
  lstat,
  mkdir,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises';
import { dirname, isAbsolute, parse, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  contentReviewerKeyFingerprint,
  normalizeReviewerPrincipal,
} from './asset-content-reviewer-trust.mjs';
import { stableJson } from './asset-owner-trust.mjs';
import { formatSchemaErrors, validateAgainstSchema } from './schema-validation.mjs';

const DEFAULT_REPO_ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const KEY_ID = /^[a-z0-9](?:[a-z0-9._-]{0,126}[a-z0-9])?$/u;
const PRIVATE_KEY_FILE = 'private-key.pem';
const PUBLIC_KEY_FILE = 'public-key.pem';
const METADATA_FILE = 'reviewer-key.json';

export async function createContentReviewerKeyPair({
  outputDir,
  principalId,
  keyId,
  createdAt = new Date().toISOString(),
  repoRoot = DEFAULT_REPO_ROOT,
} = {}) {
  const destination = requirePrivateAbsolutePath(outputDir, repoRoot, 'Reviewer key output directory');
  const principal = requirePrincipal(principalId);
  const normalizedKeyId = requireKeyId(keyId);
  const timestamp = normalizeDate(createdAt, 'Reviewer key createdAt');
  await mkdir(destination, { recursive: true });
  await assertPathHasNoSymlink(destination, 'Reviewer key output directory');

  const privateKeyPath = resolve(destination, PRIVATE_KEY_FILE);
  const publicKeyPath = resolve(destination, PUBLIC_KEY_FILE);
  const metadataPath = resolve(destination, METADATA_FILE);
  await assertAllMissing([privateKeyPath, publicKeyPath, metadataPath], 'Reviewer key output');

  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  const privateKeyPem = privateKey.export({ type: 'pkcs8', format: 'pem' });
  const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' });
  const fingerprint = contentReviewerKeyFingerprint(publicKeyPem);
  const metadata = {
    schema: 'munjanggun.assetContentReviewerKeyPair.v1',
    version: '1.0',
    algorithm: 'Ed25519',
    principalId: principal,
    keyId: normalizedKeyId,
    status: 'active',
    createdAt: timestamp,
    fingerprint,
    publicKeyPem,
    publicKeyPath,
    privateKeyPath,
  };

  const created = [];
  try {
    await writeFile(privateKeyPath, privateKeyPem, { encoding: 'utf8', flag: 'wx', mode: 0o600 });
    created.push(privateKeyPath);
    await chmod(privateKeyPath, 0o600);
    await writeFile(publicKeyPath, publicKeyPem, { encoding: 'utf8', flag: 'wx', mode: 0o644 });
    created.push(publicKeyPath);
    await writeFile(metadataPath, jsonBytes(metadata), { flag: 'wx', mode: 0o600 });
    created.push(metadataPath);
    return {
      outputDir: destination,
      metadataPath,
      publicKeyPath,
      privateKeyPath,
      principalId: principal,
      keyId: normalizedKeyId,
      fingerprint,
    };
  } catch (error) {
    await Promise.all(created.map((path) => rm(path, { force: true })));
    throw error;
  }
}

export async function buildContentReviewerTrust({
  entryPaths,
  outputPath,
  repoRoot = DEFAULT_REPO_ROOT,
} = {}) {
  if (!Array.isArray(entryPaths) || entryPaths.length < 1) {
    throw new Error('Provide at least one reviewer public key entry');
  }
  const destination = requirePrivateAbsolutePath(outputPath, repoRoot, 'Reviewer trust output');
  await assertMissing(destination, 'Reviewer trust output');
  await mkdir(dirname(destination), { recursive: true });
  await assertPathHasNoSymlink(dirname(destination), 'Reviewer trust output parent');

  const keys = [];
  const principals = new Set();
  const keyIds = new Set();
  const fingerprints = new Set();
  for (const entryPath of entryPaths) {
    const entryFile = resolveRequiredAbsolute(entryPath, 'Reviewer public key entry');
    await assertRegularFile(entryFile, 'Reviewer public key entry');
    const source = JSON.parse(await readFile(entryFile, 'utf8'));
    const principalId = requirePrincipal(source.principalId);
    const principalKey = normalizeReviewerPrincipal(principalId);
    const keyId = requireKeyId(source.keyId);
    const status = source.status ?? 'active';
    if (!['active', 'revoked'].includes(status)) throw new Error(`Reviewer key status is invalid: ${keyId}`);
    if (typeof source.publicKeyPem !== 'string' || !source.publicKeyPem.trim()) {
      throw new Error(`Reviewer public key is missing: ${keyId}`);
    }
    const fingerprint = contentReviewerKeyFingerprint(source.publicKeyPem);
    if (source.fingerprint && source.fingerprint !== fingerprint) {
      throw new Error(`Reviewer public key fingerprint mismatch: ${keyId}`);
    }
    if (principals.has(principalKey)) throw new Error(`Duplicate reviewer principal: ${principalId}`);
    if (keyIds.has(keyId)) throw new Error(`Duplicate reviewer keyId: ${keyId}`);
    if (fingerprints.has(fingerprint)) throw new Error(`Duplicate reviewer key fingerprint: ${fingerprint}`);
    principals.add(principalKey);
    keyIds.add(keyId);
    fingerprints.add(fingerprint);
    keys.push({
      principalId,
      keyId,
      status,
      publicKeyPem: canonicalPublicKeyPem(source.publicKeyPem),
      fingerprint,
    });
  }

  const trust = {
    schema: 'munjanggun.assetContentReviewerTrust.v1',
    version: '1.0',
    keys,
  };
  await writeFile(destination, jsonBytes(trust), { flag: 'wx', mode: 0o600 });
  return {
    outputPath: destination,
    entryCount: keys.length,
    sha256: digest(jsonBytes(trust)),
    keys: keys.map(({ principalId, keyId, status, fingerprint }) => ({ principalId, keyId, status, fingerprint })),
  };
}

export async function signContentReviewDocument({
  inputPath,
  privateKeyPath,
  keyId,
  outputPath,
  repoRoot = DEFAULT_REPO_ROOT,
} = {}) {
  const input = resolveRequiredAbsolute(inputPath, 'Signing input');
  const privateKeyFile = requirePrivateAbsolutePath(privateKeyPath, repoRoot, 'Reviewer private key');
  const destination = requirePrivateAbsolutePath(outputPath, repoRoot, 'Signed review output');
  const normalizedKeyId = requireKeyId(keyId);
  await Promise.all([
    assertRegularFile(input, 'Signing input'),
    assertRegularFile(privateKeyFile, 'Reviewer private key'),
    assertMissing(destination, 'Signed review output'),
  ]);
  await assertPathHasNoSymlink(dirname(privateKeyFile), 'Reviewer private key parent');
  await mkdir(dirname(destination), { recursive: true });
  await assertPathHasNoSymlink(dirname(destination), 'Signed review output parent');

  const document = JSON.parse(await readFile(input, 'utf8'));
  if (!document || typeof document !== 'object' || Array.isArray(document)) {
    throw new Error('Signing input must be a JSON object');
  }
  const payload = { ...document };
  delete payload.signature;
  const schemaPath = schemaForDocument(payload);
  const privateKey = createPrivateKey(await readFile(privateKeyFile, 'utf8'));
  if (privateKey.asymmetricKeyType !== 'ed25519') {
    throw new Error('Reviewer private key must be Ed25519');
  }
  const signed = {
    ...payload,
    signature: {
      algorithm: 'Ed25519',
      keyId: normalizedKeyId,
      valueBase64: sign(null, Buffer.from(stableJson(payload), 'utf8'), privateKey).toString('base64'),
    },
  };
  if (schemaPath) {
    const schema = JSON.parse(await readFile(schemaPath, 'utf8'));
    const validation = validateAgainstSchema(signed, schema);
    if (!validation.valid) {
      throw new Error(`Signed review document schema failed:\n${formatSchemaErrors(validation.errors).join('\n')}`);
    }
  }
  const bytes = jsonBytes(signed);
  await writeFile(destination, bytes, { flag: 'wx', mode: 0o600 });
  return {
    outputPath: destination,
    schema: signed.schema,
    keyId: normalizedKeyId,
    sha256: digest(bytes),
  };
}

function schemaForDocument(document) {
  if (document?.schema === 'munjanggun.assetContentReviewInput.v1' && document.version === '1.0') {
    return fileURLToPath(new URL('../../schemas/asset-content-review-input.schema.json', import.meta.url));
  }
  if (document?.schema === 'munjanggun.visibleTextSecondReview.v1' && document.version === '1.0') {
    return fileURLToPath(new URL('../../schemas/visible-text-second-review-receipt.schema.json', import.meta.url));
  }
  if (document?.schema === 'munjanggun.assetContentSecondarySemanticVerdict.v1' && document.version === '1.0') {
    return fileURLToPath(new URL('../../schemas/asset-content-secondary-semantic-verdict.schema.json', import.meta.url));
  }
  return null;
}

function canonicalPublicKeyPem(value) {
  contentReviewerKeyFingerprint(value);
  return createPublicKey(value).export({ type: 'spki', format: 'pem' });
}

function requirePrivateAbsolutePath(value, repoRoot, label) {
  const path = resolveRequiredAbsolute(value, label);
  if (isContained(resolve(repoRoot), path)) throw new Error(`${label} must be outside the public repository`);
  return path;
}

function resolveRequiredAbsolute(value, label) {
  if (typeof value !== 'string' || !value.trim() || !isAbsolute(value)) throw new Error(`${label} must be an absolute path`);
  if (value.includes('\0') || value.split(/[\\/]/u).includes('..')) throw new Error(`${label} contains path traversal`);
  return resolve(value);
}

function requirePrincipal(value) {
  const principal = String(value ?? '').trim();
  if (!normalizeReviewerPrincipal(principal)) throw new Error('Reviewer principalId is required');
  return principal;
}

function requireKeyId(value) {
  const keyId = String(value ?? '').trim();
  if (!KEY_ID.test(keyId)) throw new Error('Reviewer keyId must use lowercase letters, digits, dot, underscore, or hyphen');
  return keyId;
}

function normalizeDate(value, label) {
  const time = new Date(value);
  if (Number.isNaN(time.valueOf())) throw new Error(`${label} is invalid`);
  return time.toISOString();
}

async function assertAllMissing(paths, label) {
  for (const path of paths) await assertMissing(path, label);
}

async function assertMissing(path, label) {
  try {
    await lstat(path);
    throw new Error(`${label} already exists`);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

async function assertRegularFile(path, label) {
  const info = await lstat(path);
  if (!info.isFile() || info.isSymbolicLink()) throw new Error(`${label} must be a regular non-symlink file`);
}

async function assertPathHasNoSymlink(path, label) {
  let cursor = parse(resolve(path)).root;
  const relation = relative(cursor, resolve(path));
  for (const segment of relation.split(sep).filter(Boolean)) {
    cursor = resolve(cursor, segment);
    const info = await lstat(cursor);
    if (info.isSymbolicLink()) throw new Error(`${label} path must not contain symbolic links`);
  }
}

function isContained(root, child) {
  const relation = relative(resolve(root), resolve(child));
  return relation === '' || (!relation.startsWith(`..${sep}`) && relation !== '..' && !isAbsolute(relation));
}

function jsonBytes(value) {
  return Buffer.from(`${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function digest(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}
