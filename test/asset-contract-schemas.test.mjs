import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { validateAgainstSchema } from '../scripts/lib/schema-validation.mjs';

test('content catalog schema accepts a fail-closed binary group', async () => {
  const schema = await readSchema('asset-content-catalog.schema.json');
  const hash = 'a'.repeat(64);
  const result = validateAgainstSchema({
    schema: 'munjanggun.assetContentCatalog.v2',
    version: '2.0',
    intakeId: 'INTAKE-20260904-01',
    generatedAt: '2026-09-04T00:00:00.000Z',
    binaryGroupCount: 1,
    entries: [{
      binaryGroupId: `sha256:${hash}`,
      sha256: hash,
      byteSize: 1,
      mediaType: 'image/jpeg',
      sourcePathCount: 1,
      sourceRefs: [{ sourceId: 'SRC-1', sourceRelativePath: '상품/001.jpg' }],
      contentId: 'CONTENT-CANDIDATE-1',
      visualGroupId: null,
      comparisonMethod: ['sha256_exact'],
      humanReviewStatus: 'not_reviewed',
      semanticSummary: '',
      ocrText: '',
      gifReviewStatus: 'not_applicable',
      claimSignals: [],
      privacySignals: [],
      rightsSignals: [],
    }],
  }, schema);

  assert.equal(result.valid, true);
});

test('completion gates schema pins this intake numerical contract', async () => {
  const schema = await readSchema('asset-completion-gates.schema.json');
  const result = validateAgainstSchema({
    schema: 'munjanggun.assetCompletionGates.v2',
    version: '2.0',
    intakeId: 'INTAKE-20260904-01',
    expected: {
      receiptManaged: 1154,
      visualManifestPaths: 1134,
      binaryGroups: 407,
      uniqueGifBinaries: 72,
      gifSourcePaths: 252,
      unresolvedVisualGroups: 0,
      urlRecords: 13,
      unverifiedRightsPublishable: 0,
      receiptMismatch: 0,
    },
  }, schema);

  assert.equal(result.valid, true);
});

async function readSchema(name) {
  return JSON.parse(await readFile(resolve('schemas', name), 'utf8'));
}
