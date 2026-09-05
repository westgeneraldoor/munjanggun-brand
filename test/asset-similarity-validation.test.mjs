import test from 'node:test';
import assert from 'node:assert/strict';
import { compareSimilarityEvidenceRow, validateSimilarityMapInvariants } from '../scripts/lib/asset-similarity-validation.mjs';

const sha = 'a'.repeat(64);
const entry = {
  sha256: sha, sourcePathCount: 2, visualGroupId: 'VG-1', semanticGroupId: null,
  visualDecision: 'reviewed_singleton', comparisonScope: 'within_media_only',
  comparisonMethod: ['sha256_exact_partition', 'human_review'], humanReviewStatus: 'reviewed',
};

test('similarity counts are recomputed from entries', () => {
  const map = { logicalPathCount: 2, binaryGroupCount: 1, visualGroupCount: 1, unjudgedCount: 0, entries: [entry] };
  assert.deepEqual(validateSimilarityMapInvariants(map), []);
  assert.match(validateSimilarityMapInvariants({ ...map, visualGroupCount: 99 }).join('\n'), /visualGroupCount mismatch/);
  assert.match(validateSimilarityMapInvariants({ ...map, unjudgedCount: 1 }).join('\n'), /unjudgedCount mismatch/);
  const duplicatedSingleton = { ...map, logicalPathCount: 4, binaryGroupCount: 2, entries: [entry, { ...entry, sha256: 'b'.repeat(64) }] };
  assert.match(validateSimilarityMapInvariants(duplicatedSingleton).join('\n'), /reviewed_singleton group has 2 members/);
});

test('similarity map row must match its sealed final report row', () => {
  const row = {
    sha256: sha, visualGroupId: 'VG-1', semanticGroupId: null, visualDecision: 'reviewed_singleton',
    comparisonScope: 'within_media_only', comparisonMethod: ['human_review', 'sha256_exact_partition'], humanReviewStatus: 'reviewed',
  };
  assert.deepEqual(compareSimilarityEvidenceRow(row, entry), []);
  assert.match(compareSimilarityEvidenceRow({ ...row, visualGroupId: 'VG-FORGED' }, entry).join('\n'), /visualGroupId mismatch/);
  assert.match(compareSimilarityEvidenceRow({ ...row, humanReviewStatus: 'needs_escalation' }, entry).join('\n'), /humanReviewStatus mismatch/);
});
