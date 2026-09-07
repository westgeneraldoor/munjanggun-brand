#!/usr/bin/env node
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildOwnerOrderDocuments, validateOwnerOrderDocuments } from './lib/asset-owner-order.mjs';
import { sha256File } from './lib/asset-inventory.mjs';
import { formatSchemaErrors, validateAgainstSchema } from './lib/schema-validation.mjs';

const catalogPath = resolve(requiredArg('--catalog'));
const attestationInputPath = resolve(requiredArg('--attestation-input'));
const outputRoot = resolve(requiredArg('--output-root'));
const [sourceCatalog, attestationInput] = await Promise.all([readJson(catalogPath), readJson(attestationInputPath)]);
const reviewEvidenceReceiptPath = resolve(dirname(catalogPath), sourceCatalog.reviewEvidenceReceiptRef);
if (await sha256File(reviewEvidenceReceiptPath) !== sourceCatalog.reviewEvidenceReceiptSha256) {
  throw new Error('Source catalog review evidence receipt SHA mismatch');
}
const reviewEvidenceReceiptRef = relative(outputRoot, reviewEvidenceReceiptPath).replaceAll('\\', '/');
const documents = buildOwnerOrderDocuments(sourceCatalog, {
  attestationInput,
  sourceCatalogSha256: await sha256File(catalogPath),
  reviewEvidenceReceiptRef,
});
const errors = validateOwnerOrderDocuments(documents);
if (errors.length > 0) throw new Error(`Owner rights order invariant failure:\n${errors.join('\n')}`);
await validateSchemas(documents);

const parent = dirname(outputRoot);
const partialRoot = resolve(parent, `.${basename(outputRoot)}.partial-${randomUUID()}`);
if (dirname(partialRoot) !== parent) throw new Error('Partial output escaped the requested parent');
await mkdir(partialRoot, { recursive: false });
try {
  await writeDocument('reviewed-content-catalog.json', documents.catalog.text);
  await writeDocument('owner-rights-attestation.json', documents.attestation.text);
  await writeDocument('owner-attestation-mapping.json', documents.mapping.text);
  for (const artifact of documents.artifacts) await writeDocument(artifact.relativePath, artifact.text);
  await writeDocument('use-evidence-registry.json', documents.registry.text);
  await writeDocument('use-evidence-receipt.json', documents.useEvidenceReceipt.text);
  await writeDocument('owner-decisions.json', documents.ledger.text);
  await writeDocument('owner-decisions-receipt.json', documents.ownerDecisionReceipt.text);
  await writeDocument('rights-state.json', documents.rightsState.text);
  await writeDocument('OWNER_RIGHTS_SUMMARY.md', ownerSummary(documents));
  await rename(partialRoot, outputRoot);
} catch (error) {
  await rm(partialRoot, { recursive: true, force: true });
  throw error;
}

console.log(JSON.stringify({
  result: 'recorded_unsigned',
  outputRoot,
  ownerAttestation: { signature: null, sha256: documents.attestation.sha256 },
  workerMapping: { assets: documents.mapping.document.assetCount, sourcePaths: documents.mapping.document.sourcePathCount, sha256: documents.mapping.sha256 },
  rights: { internalPreservation: 'approved_recorded', privateCodexSource: 'approved_recorded', blogSnsReuse: 'approved_recorded_unsealed' },
  blocked: {
    publicGit: true,
    externalPublication: true,
    trustedOwnerSignature: documents.rightsState.document.remainingGates.trustedOwnerSignature,
    claimAssets: documents.rightsState.document.remainingGates.claimAssetCount,
    privacyAssets: documents.rightsState.document.remainingGates.privacyAssetCount,
    escalationAssets: documents.rightsState.document.remainingGates.escalationAssetCount,
  },
}, null, 2));

async function validateSchemas(value) {
  const schemaNames = {
    catalog: 'asset-content-catalog.schema.json',
    attestation: 'asset-owner-attestation.schema.json',
    mapping: 'asset-owner-attestation-mapping.schema.json',
    artifact: 'asset-use-evidence-artifact.schema.json',
    registry: 'asset-use-evidence-registry.schema.json',
    useEvidenceReceipt: 'asset-use-evidence-receipt.schema.json',
    ledger: 'asset-owner-decisions.schema.json',
    ownerDecisionReceipt: 'asset-owner-decision-receipt.schema.json',
    rightsState: 'asset-rights-state.schema.json',
  };
  const schemas = Object.fromEntries(await Promise.all(Object.entries(schemaNames).map(async ([key, name]) => [key, await readJson(fileURLToPath(new URL(`../schemas/${name}`, import.meta.url)))])));
  for (const key of ['catalog', 'attestation', 'mapping', 'registry', 'useEvidenceReceipt', 'ledger', 'ownerDecisionReceipt', 'rightsState']) {
    assertSchema(value[key].document, schemas[key], key);
  }
  for (const artifact of value.artifacts) assertSchema(artifact.document, schemas.artifact, `artifact ${artifact.evidenceId}`);
}

function assertSchema(value, schema, label) {
  const result = validateAgainstSchema(value, schema);
  if (!result.valid) throw new Error(`${label} schema failed:\n${formatSchemaErrors(result.errors).join('\n')}`);
}

async function writeDocument(relativePath, text) {
  const destination = resolve(partialRoot, ...relativePath.split('/'));
  if (!destination.startsWith(`${partialRoot}\\`)) throw new Error(`Output path escaped partial root: ${relativePath}`);
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, text, { encoding: 'utf8', flag: 'wx' });
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

function requiredArg(name) {
  const index = process.argv.indexOf(name);
  const value = index === -1 ? undefined : process.argv[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`Missing required argument ${name}`);
  return value;
}

function ownerSummary(documents) {
  const recordedAt = documents.attestation.document.recordedAt;
  const assetCount = documents.mapping.document.assetCount;
  const sourcePathCount = documents.mapping.document.sourcePathCount;
  const { claimAssetCount, privacyAssetCount, escalationAssetCount } = documents.rightsState.document.remainingGates;
  return `# 문장군 신규 상품 자산 사용 결정\n\n` +
    `> 기록 시각: ${recordedAt}\n` +
    `> 대상: ${documents.catalog.document.intakeId}, 고유 자산 ${assetCount}개, 원래 경로 ${sourcePathCount}개\n\n` +
    `## 사장님 결정\n\n` +
    `- 자료 출처: 문장군 내부 자체제작\n` +
    `- 비공개 보존: 승인\n` +
    `- 문장군의 모든 비공개 Codex 프로젝트에서 소스로 사용: 승인\n` +
    `- 블로그 및 SNS 재사용 권리: 승인\n` +
    `- 인물·후기 등에 대한 사장님 차원의 추가 제한: 없음\n` +
    `- 공개 Git에 이미지 원본 저장: 보류\n\n` +
    `## 작업자가 계속 확인할 사항\n\n` +
    `- 가격·행사·혜택처럼 바뀔 수 있는 문구 신호 ${claimAssetCount}개는 게시 시점의 최신 사실을 확인하거나 문구를 빼고 사용한다.\n` +
    `- 개인정보 가능성 ${privacyAssetCount}개와 추가 판독 ${escalationAssetCount}개는 작업자가 검수한다. 이는 사용권을 다시 묻는 절차가 아니다.\n` +
    `- 공개 Git 저장과 자동 외부 추출은 신뢰 서명 및 나머지 안전 검토가 끝날 때까지 차단한다.\n\n` +
    `## 기록 방식\n\n` +
    `사장님은 위 사업 결정을 내렸고, Codex 작업자가 그 결정을 자산 ${assetCount}개와 경로 ${sourcePathCount}개에 연결했다. ` +
    `해시·근거 ID는 작업자가 관리하며 사장님에게 기술값 입력을 요구하지 않는다. 현재 전자서명은 임의 생성하지 않아 미서명으로 명시했다.\n`;
}
