import { createHash } from 'node:crypto';
import { readFile, realpath, stat } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveContainedPath } from './asset-paths.mjs';
import { sha256File } from './asset-inventory.mjs';
import { formatSchemaErrors, validateAgainstSchema } from './schema-validation.mjs';
import { verifyTrustedOwnerSignature } from './asset-owner-trust.mjs';

export async function verifyUseEvidenceAuthority({
  catalog,
  catalogPath,
  registryPath,
  receiptPath,
  entry,
  purpose,
  channel,
  now = Date.now(),
  ownerSignatureVerifier = verifyTrustedOwnerSignature,
}) {
  const [registry, receipt, registrySchema, receiptSchema, artifactSchema, attestationSchema, mappingSchema] = await Promise.all([
    readJson(registryPath), readJson(receiptPath),
    readJson(fileURLToPath(new URL('../../schemas/asset-use-evidence-registry.schema.json', import.meta.url))),
    readJson(fileURLToPath(new URL('../../schemas/asset-use-evidence-receipt.schema.json', import.meta.url))),
    readJson(fileURLToPath(new URL('../../schemas/asset-use-evidence-artifact.schema.json', import.meta.url))),
    readJson(fileURLToPath(new URL('../../schemas/asset-owner-attestation.schema.json', import.meta.url))),
    readJson(fileURLToPath(new URL('../../schemas/asset-owner-attestation-mapping.schema.json', import.meta.url))),
  ]);
  assertSchema(registry, registrySchema, 'use evidence registry');
  assertSchema(receipt, receiptSchema, 'use evidence receipt');
  await ownerSignatureVerifier(receipt, 'Use evidence receipt');
  const catalogSha256 = await sha256File(catalogPath);
  if (registry.catalogSha256 !== catalogSha256 || receipt.catalogSha256 !== catalogSha256) throw new Error('Use evidence catalog SHA mismatch');
  if (registry.intakeId !== catalog.intakeId || receipt.intakeId !== catalog.intakeId) throw new Error('Use evidence intakeId mismatch');
  if (resolveContainedPath(dirname(receiptPath), receipt.registryRef, 'use evidence registry') !== registryPath) throw new Error('Use evidence registry path mismatch');
  if (receipt.registrySha256 !== await sha256File(registryPath)) throw new Error('Use evidence registry SHA mismatch');
  if (registry.entryCount !== registry.entries.length) throw new Error('Use evidence registry entryCount mismatch');
  if (receipt.fileCount !== receipt.entries.length) throw new Error('Use evidence receipt fileCount mismatch');
  if (receipt.treeHash !== treeHash(receipt.entries)) throw new Error('Use evidence receipt treeHash mismatch');
  const receiptById = uniqueMap(receipt.entries, 'evidenceId', 'receipt');
  const registryById = uniqueMap(registry.entries, 'evidenceId', 'registry');
  const provenanceCache = new Map();
  if (receiptById.size !== registryById.size) throw new Error('Use evidence registry/receipt coverage mismatch');
  for (const evidence of registry.entries) {
    const sealed = receiptById.get(evidence.evidenceId);
    if (!sealed || sealed.relativePath !== evidence.artifactRef || sealed.byteSize !== evidence.artifactByteSize || sealed.sha256 !== evidence.artifactSha256) throw new Error(`Use evidence receipt binding mismatch: ${evidence.evidenceId}`);
    const artifactPath = resolveContainedPath(dirname(receiptPath), sealed.relativePath, 'use evidence artifact');
    const authorityRootReal = await realpath(dirname(receiptPath));
    const artifactReal = await realpath(artifactPath);
    if (!isContained(authorityRootReal, artifactReal)) throw new Error(`Use evidence artifact escapes authority root: ${evidence.evidenceId}`);
    const info = await stat(artifactReal);
    if (!info.isFile() || info.size !== sealed.byteSize || await sha256File(artifactReal) !== sealed.sha256) throw new Error(`Use evidence artifact integrity mismatch: ${evidence.evidenceId}`);
    const artifact = await readJson(artifactReal);
    assertSchema(artifact, artifactSchema, `use evidence artifact ${evidence.evidenceId}`);
    if (artifact.evidenceOrigin === 'owner_attestation_worker_mapping') await verifyAttestationProvenance(artifact, evidence);
    for (const field of ['evidenceId', 'kind', 'decisionRef', 'subjectSha256', 'contentId', 'validFrom', 'validUntil']) {
      if (artifact[field] !== evidence[field]) throw new Error(`Use evidence artifact ${field} mismatch: ${evidence.evidenceId}`);
    }
    if (artifact.assertedBy !== evidence.issuer || JSON.stringify([...artifact.scopes].sort()) !== JSON.stringify([...evidence.scopes].sort()) || JSON.stringify([...artifact.channels].sort()) !== JSON.stringify([...evidence.channels].sort())) {
      throw new Error(`Use evidence artifact authority/scope mismatch: ${evidence.evidenceId}`);
    }
  }
  const requiredScope = purpose === 'public-repository' ? 'public_git_storage' : 'external_reuse';
  const requiredChannel = purpose === 'public-repository' ? 'public_git' : channel;
  if (!requiredChannel) throw new Error('External publication requires --channel');
  const rights = verifyRefs(entry.rightsEvidenceRef, 'rights');
  const claimRefs = entry.claimEvidenceRef ?? [];
  const claims = entry.claimReviewStatus === 'verified' || entry.claimSignals.length > 0 ? verifyRefs(claimRefs, 'claim') : [];
  return { registryPath, receiptPath, registrySha256: await sha256File(registryPath), receiptSha256: await sha256File(receiptPath), resolvedEvidence: [...rights, ...claims] };

  function verifyRefs(refs, kind) {
    if (!Array.isArray(refs) || refs.length === 0) throw new Error(`${kind} evidence reference is required`);
    return refs.map((id) => {
      const evidence = registryById.get(id);
      if (!evidence) throw new Error(`Use evidence ID is not registered: ${id}`);
      if (evidence.kind !== kind) throw new Error(`Use evidence kind mismatch: ${id}`);
      if ((kind === 'rights' && !id.startsWith('RIGHTS-EV-')) || (kind === 'claim' && !id.startsWith('CLAIM-EV-'))) throw new Error(`Use evidence ID/kind mismatch: ${id}`);
      if (evidence.status !== 'verified') throw new Error(`Use evidence is not verified: ${id}`);
      if (evidence.subjectSha256 !== entry.sha256 || evidence.contentId !== entry.contentId) throw new Error(`Use evidence target mismatch: ${id}`);
      if (!evidence.scopes.includes(requiredScope) || !evidence.channels.includes(requiredChannel)) throw new Error(`Use evidence scope/channel mismatch: ${id}`);
      const from = Date.parse(evidence.validFrom); const until = evidence.validUntil ? Date.parse(evidence.validUntil) : Infinity;
      if (from > now || until < now) throw new Error(`Use evidence is outside validity window: ${id}`);
      return { evidenceId: id, kind, artifactRef: evidence.artifactRef, artifactSha256: evidence.artifactSha256, decisionRef: evidence.decisionRef };
    });
  }

  async function verifyAttestationProvenance(artifact, evidence) {
    const cacheKey = `${artifact.ownerAttestationRef}\0${artifact.workerMappingRef}`;
    let cached = provenanceCache.get(cacheKey);
    if (!cached) {
      cached = (async () => {
        const authorityRoot = dirname(receiptPath);
        const attestationPath = resolveContainedPath(authorityRoot, artifact.ownerAttestationRef, 'owner attestation');
        const mappingPath = resolveContainedPath(authorityRoot, artifact.workerMappingRef, 'owner attestation worker mapping');
        if (await sha256File(attestationPath) !== artifact.ownerAttestationSha256) throw new Error('Owner attestation SHA mismatch');
        if (await sha256File(mappingPath) !== artifact.workerMappingSha256) throw new Error('Owner attestation worker mapping SHA mismatch');
        const [attestation, mapping] = await Promise.all([readJson(attestationPath), readJson(mappingPath)]);
        assertSchema(attestation, attestationSchema, 'owner attestation');
        assertSchema(mapping, mappingSchema, 'owner attestation worker mapping');
        await ownerSignatureVerifier(attestation, 'Owner attestation');
        if (attestation.intakeId !== catalog.intakeId || mapping.intakeId !== catalog.intakeId) throw new Error('Owner attestation intakeId mismatch');
        if (mapping.catalogSha256 !== catalogSha256) throw new Error('Owner attestation mapping catalog SHA mismatch');
        if (mapping.ownerAttestationSha256 !== artifact.ownerAttestationSha256 || mapping.ownerAttestationRef !== artifact.ownerAttestationRef) throw new Error('Owner attestation mapping binding mismatch');
        if (attestation.statements.publicGitStorage !== 'pending') throw new Error('Owner attestation unexpectedly authorizes public Git');
        return { attestation, mapping, mappingByEvidenceId: uniqueMap(mapping.entries, 'evidenceId', 'attestation mapping') };
      })();
      provenanceCache.set(cacheKey, cached);
    }
    const { attestation, mappingByEvidenceId } = await cached;
    const mapped = mappingByEvidenceId.get(evidence.evidenceId);
    if (!mapped || mapped.sha256 !== evidence.subjectSha256 || mapped.contentId !== evidence.contentId || mapped.artifactRef !== evidence.artifactRef) throw new Error(`Owner attestation mapping target mismatch: ${evidence.evidenceId}`);
    if (!mapped.sourceGroupIds.every((sourceId) => attestation.sourceGroupIds.includes(sourceId))) throw new Error(`Owner attestation source group mismatch: ${evidence.evidenceId}`);
    if (evidence.channels.includes('blog') && !attestation.statements.externalReuse.channels.includes('blog')) throw new Error(`Owner attestation blog scope mismatch: ${evidence.evidenceId}`);
    if (evidence.channels.includes('sns') && !attestation.statements.externalReuse.channels.includes('sns')) throw new Error(`Owner attestation SNS scope mismatch: ${evidence.evidenceId}`);
    const allowedChannels = new Set(['private_codex', ...attestation.statements.externalReuse.channels]);
    const allowedScopes = new Set(['internal_preservation', 'external_reuse']);
    if (evidence.channels.some((value) => !allowedChannels.has(value)) || evidence.scopes.some((value) => !allowedScopes.has(value))) {
      throw new Error(`Owner attestation scope/channel expansion is forbidden: ${evidence.evidenceId}`);
    }
  }
}

function uniqueMap(entries, key, label) {
  const map = new Map();
  for (const entry of entries) { if (map.has(entry[key])) throw new Error(`Duplicate use evidence ${label} ID: ${entry[key]}`); map.set(entry[key], entry); }
  return map;
}
function isContained(root, child) { const relation = relative(resolve(root), resolve(child)); return relation === '' || (!relation.startsWith(`..${sep}`) && relation !== '..' && !isAbsolute(relation)); }
function treeHash(entries) { const hash = createHash('sha256'); for (const entry of entries) hash.update(`${entry.evidenceId}\0${entry.relativePath}\0${entry.byteSize}\0${entry.sha256}\n`, 'utf8'); return hash.digest('hex'); }
function assertSchema(value, schema, label) { const result = validateAgainstSchema(value, schema); if (!result.valid) throw new Error(`${label} schema failed:\n${formatSchemaErrors(result.errors).join('\n')}`); }
async function readJson(path) { return JSON.parse(await readFile(path, 'utf8')); }
