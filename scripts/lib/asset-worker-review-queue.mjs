export function buildWorkerReviewQueue(catalog, generatedAt = new Date().toISOString()) {
  const entries = [...catalog.entries].sort((left, right) => left.sha256.localeCompare(right.sha256));
  const firstReviewCandidates = entries.filter((entry) => entry.humanReviewStatus === 'reviewed'
    && entry.claimSignals.length === 0 && entry.privacySignals.length === 0);
  const claimEntries = entries.filter((entry) => entry.claimSignals.length > 0);
  const privacyEntries = entries.filter((entry) => entry.privacySignals.length > 0);
  const escalationEntries = entries.filter((entry) => entry.humanReviewStatus === 'needs_escalation');
  return {
    schema: 'munjanggun.assetWorkerReviewQueue.v1',
    version: '1.0',
    intakeId: catalog.intakeId,
    generatedAt,
    guidance: {
      firstReviewCandidates: '즉시 발행 가능 수가 아니라, claim·개인정보 신호가 없고 사람 검토가 끝나 작업자가 우선 판정하기 좋은 묶음',
      claimBatches: '같은 신호 조합끼리 묶은 작업자 검토 단위. 동일 사실 확정은 OCR·이미지·최신 근거를 함께 보고 판단',
    },
    counts: {
      totalAssets: entries.length,
      firstReviewCandidates: firstReviewCandidates.length,
      claimSignalAssets: claimEntries.length,
      privacySignalAssets: privacyEntries.length,
      humanReReviewAssets: escalationEntries.length,
    },
    firstReviewCandidates: firstReviewCandidates.map(summary),
    claimBatches: groupBySignals(claimEntries, 'claimSignals'),
    privacyBatches: groupBySignals(privacyEntries, 'privacySignals'),
    humanReReview: escalationEntries.map(summary),
  };
}

function groupBySignals(entries, field) {
  const groups = new Map();
  for (const entry of entries) {
    const signals = [...new Set(entry[field])].sort();
    const key = signals.join('+');
    const group = groups.get(key) ?? { batchId: `${field === 'claimSignals' ? 'CLAIM' : 'PRIVACY'}-${String(groups.size + 1).padStart(3, '0')}`, signals, assets: [] };
    group.assets.push(summary(entry));
    groups.set(key, group);
  }
  return [...groups.values()].map((group) => ({ ...group, assetCount: group.assets.length }));
}

function summary(entry) {
  return {
    contentId: entry.contentId,
    sha256: entry.sha256,
    semanticSummary: entry.semanticSummary,
    representativePath: entry.sourceRefs[0]?.sourceRelativePath ?? '',
    claimSignals: entry.claimSignals,
    privacySignals: entry.privacySignals,
    humanReviewStatus: entry.humanReviewStatus,
  };
}
