#!/usr/bin/env node
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sha256File } from './lib/asset-inventory.mjs';
import { buildOwnerApprovalInput } from './lib/asset-owner-approval-input.mjs';
import { formatSchemaErrors, validateAgainstSchema } from './lib/schema-validation.mjs';

const catalogPath = resolve(requiredArg('--catalog'));
const catalog = await readJson(catalogPath);
const comparison = await readJson(resolve(requiredArg('--comparison')));
const completion = await readJson(resolve(requiredArg('--completion')));
const urlReview = await readJson(resolve(requiredArg('--url-review')));
const outputPath = resolve(requiredArg('--output'));
const approvalInputOutputPath = getArg('--approval-input-output') ? resolve(getArg('--approval-input-output')) : null;
const decisionsOutputPath = getArg('--decisions-output') ? resolve(getArg('--decisions-output')) : null;
const decisionsReceiptOutputPath = getArg('--decisions-receipt-output') ? resolve(getArg('--decisions-receipt-output')) : null;
const useEvidenceReceiptPath = resolve(requiredArg('--use-evidence-receipt'));
if (Boolean(decisionsOutputPath) !== Boolean(decisionsReceiptOutputPath)) throw new Error('--decisions-output and --decisions-receipt-output must be provided together');

const escalations = catalog.entries.filter((entry) => entry.humanReviewStatus === 'needs_escalation');
const privacy = catalog.entries.filter((entry) => entry.privacySignals.length > 0);
const claimSignals = countSignals(catalog.entries.flatMap((entry) => entry.claimSignals));
const catalogSha256 = await sha256File(catalogPath);
const approvalInput = buildOwnerApprovalInput(catalog, catalogSha256);
const specialRestrictions = approvalInput.reviewQueues.specialRestrictions.assets;
const sourceGroupCount = approvalInput.sourceGroups.length;
const approvalInputRef = approvalInputOutputPath ? relative(dirname(outputPath), approvalInputOutputPath).replaceAll('\\', '/') : null;
const lines = [
  `# ${catalog.intakeId} 사장 판단표`,
  '',
  `생성일: ${new Date().toISOString()}`,
  '',
  '## 1. 현재 판정',
  '',
  `- 기술 게이트: ${completion.technicalGateStatus}`,
  `- 외부 발행: ${completion.externalReleaseStatus}`,
  `- canonical 승격: ${completion.releaseBlockers.canonicalPromotionStatus}`,
  `- 기존+신규: ${completion.crossCorpusSimilarity.logicalPaths}경로 → ${completion.crossCorpusSimilarity.binaryGroups} SHA → ${completion.crossCorpusSimilarity.visualGroups} 시각군`,
  `- 시각 미판정: ${completion.crossCorpusSimilarity.unjudged}`,
  `- 공개 Git 가능으로 표시된 신규 경로: ${completion.releaseBlockers.publicRepoEligiblePaths}`,
  '',
  '## 2. 경로 처리 승인',
  '',
  '| 분류 | 경로 수 | 제안 | 사장 결정 |',
  '| --- | ---: | --- | --- |',
  `| 같은 경로·같은 바이너리 | ${comparison.counts.same_path_unchanged} | 동일 object 참조 | [ ] 승인 |`,
  `| 같은 경로 교체 | ${comparison.counts.same_path_replacement} | 신규를 candidate로 유지, 승인 후 canonical 교체 | [ ] 승인 / [ ] 보류 |`,
  `| 새 경로·기존 어딘가와 완전 동일 | ${comparison.counts.new_path_exact_duplicate} | 새 복사 없이 동일 object 참조 | [ ] 승인 |`,
  `| 기존 상품군의 실질 신규 경로 | ${comparison.counts.substantive_new_path_existing_product} | 신규 논리 경로 추가 | [ ] 승인 / [ ] 보류 |`,
  `| canonical 폴더가 없는 신규 상품 묶음 | ${comparison.counts.new_product_bundle} | 신규 상품 source로 보존 | [ ] 승인 / [ ] 보류 |`,
  '',
  '## 3. 권리·공개 저장 결정',
  '',
  '> 아래 네 항목만 사장님이 사업 판단한다. SHA·근거 ID·영문 상태값은 작업자가 기록한다.',
  '',
  `- [ ] ${sourceGroupCount}개 출처 묶음은 문장군이 제작했거나 적법하게 납품받아 내부 원본 보존이 가능하다.`,
  `- [ ] ${sourceGroupCount}개 출처 묶음의 자산을 공개 Git 저장소에 저장할 권리가 확인됐다.`,
  '- [ ] 블로그·상세페이지·SNS 등 외부 채널 재사용 권리가 확인됐다.',
  '- [ ] 인물·아동·행사·후기·메신저 화면은 별도 제한 또는 동의 범위를 적용한다.',
  '',
  '권리 증거는 동의서·개인정보 원문 대신 `rightsEvidenceRef`만 기록한다.',
  '',
  '### 쉬운 응답 형식',
  '',
  '- 내부 보존: 보존 / 보류',
  '- 공개 Git 저장: 승인 / 보류',
  '- 블로그·SNS 재사용: 승인 / 보류',
  '- 인물·후기 등에 추가 제한: 있음 / 없음',
  '',
  '> 이 응답과 그룹 워크시트는 검토 입력일 뿐 발행 권한이 아니다. 실제 자산별 원장과 신뢰된 서명 영수증으로 확정되기 전에는 모두 차단된다.',
  ...(approvalInputRef ? ['', `- 구조화 입력 파일: \`${approvalInputRef}\``] : []),
  '',
  `### ${sourceGroupCount}개 출처 묶음별 검토 현황`,
  '',
  '> 한 SHA가 여러 상세페이지에서 쓰이면 여러 묶음에 중복 집계된다. 아래 표는 검토 편의용이며 자산별 승인을 자동 생성하지 않는다.',
  '',
  '| 묶음 | SHA | 경로 | 상향 | claim | 개인정보 | 특수제한 | 4축 묶음 응답 |',
  '| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |',
  ...approvalInput.sourceGroups.map((group) => `| ${escapeCell(group.label)} | ${group.assetCount} | ${group.sourcePathCount} | ${group.escalationCount} | ${group.claimAssetCount} | ${group.privacyAssetCount} | ${group.specialRestrictionAssetCount} | 모두 pending |`),
  '',
  '## 4. 검토 신호 요약',
  '',
  `- 상향 검토 그룹: ${escalations.length}`,
  `- claim 신호 그룹: ${completion.releaseBlockers.claimSignalGroups}`,
  `- 개인정보 신호 그룹: ${privacy.length}`,
  `- 특수 인물·후기·제3자 권리 검토 그룹: ${specialRestrictions.length}`,
  `- 중복: 상향∩claim ${approvalInput.overlapSummary.escalationAndClaim}, 상향∩개인정보 ${approvalInput.overlapSummary.escalationAndPrivacy}, claim∩개인정보 ${approvalInput.overlapSummary.claimAndPrivacy}, 세 조건 모두 ${approvalInput.overlapSummary.allThree}`,
  `- URL 접근·상품 연결: ${urlReview.entries.filter((entry) => entry.accessStatus === 'accessible' && entry.productConnectionStatus === 'matched').length}/${urlReview.recordCount}`,
  '',
  '| claim 신호 | 그룹 수 |',
  '| --- | ---: |',
  ...claimSignals.map(([signal, count]) => `| ${escapeCell(signal)} | ${count} |`),
  '',
  `## 5. 상향 검토 ${escalations.length}개`,
  '',
  '| SHA | 내용 | 대표 경로 | claim | 개인정보 | 권리 | 결정 |',
  '| --- | --- | --- | --- | --- | --- | --- |',
  ...escalations.map((entry) => `| ${entry.sha256.slice(0, 12)} | ${escapeCell(entry.semanticSummary)} | ${escapeCell(entry.sourceRefs.slice(0, 3).map((ref) => ref.sourceRelativePath).join('<br>'))} | ${escapeCell(entry.claimSignals.join(', '))} | ${escapeCell(entry.privacySignals.join(', '))} | ${escapeCell(entry.rightsSignals.join(', '))} | [ ] 확인 / [ ] 제한 |`),
  '',
  `## 6. 개인정보 신호 ${privacy.length}개`,
  '',
  '| SHA | 내용 | 대표 경로 | 신호 | 결정 |',
  '| --- | --- | --- | --- | --- |',
  ...privacy.map((entry) => `| ${entry.sha256.slice(0, 12)} | ${escapeCell(entry.semanticSummary)} | ${escapeCell(entry.sourceRefs[0]?.sourceRelativePath ?? '')} | ${escapeCell(entry.privacySignals.join(', '))} | [ ] cleared / [ ] restricted / [ ] needs_redaction |`),
  '',
  '## 7. 승인 후 실행 순서',
  '',
  '1. 권리·개인정보·claim 상태와 증거 참조를 manifest v2에 반영한다.',
  '2. 전체 source는 보존하되 자산별 외부 발행 상태를 분리한다.',
  '3. 승인된 공개 저장 자산만 LFS pointer 여부를 검증해 공개 object로 승격한다.',
  '4. resolver/materialize로 기존 소비자 호환성을 검증한다.',
  '5. 기존 source를 `superseded` 처리한 뒤에만 펼친 중복 폴더 정리를 검토한다.',
  '',
];
const approvalInputSchema = await readJson(fileURLToPath(new URL('../schemas/asset-owner-approval-input.schema.json', import.meta.url)));
assertSchema(approvalInput, approvalInputSchema, 'owner approval input');
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${lines.join('\n')}\n`, { encoding: 'utf8', flag: 'wx' });
if (approvalInputOutputPath) {
  await mkdir(dirname(approvalInputOutputPath), { recursive: true });
  await writeFile(approvalInputOutputPath, `${JSON.stringify(approvalInput, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
}
if (decisionsOutputPath) {
  const pendingDecision = () => ({ status: 'pending', evidenceRefs: [], notes: '' });
  const assetDecisions = catalog.entries.map((entry) => ({
    sha256: entry.sha256,
    contentId: entry.contentId,
    needsEscalation: entry.humanReviewStatus === 'needs_escalation',
    humanReviewDecision: 'pending',
    claimDecision: 'pending',
    privacyDecision: 'pending',
    rightsDecision: 'pending',
    rightsEvidenceRefs: [],
    claimEvidenceRefs: [],
    notes: '',
  }));
  const decisions = {
    schema: 'munjanggun.assetOwnerDecisions.v1',
    version: '1.0',
    intakeId: catalog.intakeId,
    generatedAt: new Date().toISOString(),
    catalogSha256,
    useEvidenceReceiptSha256: await sha256File(useEvidenceReceiptPath),
    inheritancePolicy: 'global_answers_do_not_propagate_to_asset_decisions',
    rightsDecisions: {
      internalPreservation: pendingDecision(),
      publicGitStorage: pendingDecision(),
      externalReuse: pendingDecision(),
      specialAssetRestrictions: pendingDecision(),
    },
    assetDecisionCount: assetDecisions.length,
    assetDecisions,
    escalationDecisionCount: escalations.length,
    escalationDecisions: escalations.map((entry) => ({
      sha256: entry.sha256,
      contentId: entry.contentId,
      humanReviewDecision: 'pending',
      claimDecision: 'pending',
      privacyDecision: 'pending',
      rightsDecision: 'pending',
      rightsEvidenceRefs: [],
      claimEvidenceRefs: [],
      notes: '',
    })),
  };
  const decisionsSchema = await readJson(fileURLToPath(new URL('../schemas/asset-owner-decisions.schema.json', import.meta.url)));
  const validation = validateAgainstSchema(decisions, decisionsSchema);
  if (!validation.valid) throw new Error(`Owner decisions schema failed:\n${formatSchemaErrors(validation.errors).join('\n')}`);
  await mkdir(dirname(decisionsOutputPath), { recursive: true });
  await writeFile(decisionsOutputPath, `${JSON.stringify(decisions, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
  const globalStatuses = [...new Set(Object.values(decisions.rightsDecisions).map((decision) => decision.status))];
  const decisionsReceipt = {
    schema: 'munjanggun.assetOwnerDecisionReceipt.v1',
    version: '1.0',
    intakeId: catalog.intakeId,
    sealedAt: new Date().toISOString(),
    catalogSha256,
    useEvidenceReceiptSha256: decisions.useEvidenceReceiptSha256,
    ledgerRef: relative(dirname(decisionsReceiptOutputPath), decisionsOutputPath).replaceAll('\\', '/'),
    ledgerSha256: await sha256File(decisionsOutputPath),
    globalDecisionStatus: globalStatuses.length === 1 ? globalStatuses[0] : 'mixed',
    assetDecisionCount: assetDecisions.length,
    escalationDecisionCount: escalations.length,
    signature: null,
  };
  const receiptSchema = await readJson(fileURLToPath(new URL('../schemas/asset-owner-decision-receipt.schema.json', import.meta.url)));
  const receiptValidation = validateAgainstSchema(decisionsReceipt, receiptSchema);
  if (!receiptValidation.valid) throw new Error(`Owner decision receipt schema failed:\n${formatSchemaErrors(receiptValidation.errors).join('\n')}`);
  await mkdir(dirname(decisionsReceiptOutputPath), { recursive: true });
  await writeFile(decisionsReceiptOutputPath, `${JSON.stringify(decisionsReceipt, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
}
console.log(`Owner approval report written: ${escalations.length} escalations / ${privacy.length} privacy groups.`);

function countSignals(signals) {
  const counts = new Map();
  for (const signal of signals) counts.set(signal, (counts.get(signal) ?? 0) + 1);
  return [...counts.entries()].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]));
}

function escapeCell(value) {
  return String(value ?? '').replaceAll('|', '\\|').replaceAll('\n', '<br>');
}

function assertSchema(value, schema, label) {
  const validation = validateAgainstSchema(value, schema);
  if (!validation.valid) throw new Error(`${label} schema failed:\n${formatSchemaErrors(validation.errors).join('\n')}`);
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

function getArg(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

function requiredArg(name) {
  const value = getArg(name);
  if (!value) throw new Error(`Missing required argument ${name}`);
  return value;
}
