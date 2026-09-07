import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, generateKeyPairSync, sign } from 'node:crypto';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { assertContentEntryEvidence, buildVerifiedContentAuthority, computeContentDecisionHash, computeVisibleTextObservationDigest } from '../scripts/lib/asset-content-revalidation.mjs';
import { assertCatalogContentUsable } from '../scripts/lib/asset-content-quality.mjs';
import { decodeGifFramePixels, GIF_PIXEL_DECODER_VERSION } from '../scripts/lib/gif-frame-pixels.mjs';
import { applyExifOrientation, decodeStaticRegionPixels, encodeRgbaPng, STATIC_PIXEL_DECODER_VERSION, STATIC_PNG_ENCODER_VERSION } from '../scripts/lib/static-image-region-pixels.mjs';
import { stableJson } from '../scripts/lib/asset-owner-trust.mjs';

test('static pixel decoder applies EXIF orientation before normalized cropping', () => {
  const source = { width: 2, height: 1, data: Uint8Array.from([255, 0, 0, 255, 0, 0, 255, 255]) };
  const rotated = applyExifOrientation(source, 6);
  assert.deepEqual({ width: rotated.width, height: rotated.height }, { width: 1, height: 2 });
  assert.deepEqual([...rotated.data], [255, 0, 0, 255, 0, 0, 255, 255]);
});

test('canonical static crop PNG bytes are stable across Windows and Ubuntu runners', () => {
  assert.equal(digest(staticPngFixture()), 'b8471af02966b8308108e2083364916e1a99ee09fcc18e97050537e57ef46416');
});

test('builder seals a per-object original review and verified quality authority replays it', async () => {
  const fixture = await makeFixture({ visibleText: ['제품 가격 600,000원'], claimSignals: ['price_or_discount_claim'] });
  const result = await buildVerifiedContentAuthority(fixture.options);
  const policy = qualityPolicy(result);
  const authority = await assertCatalogContentUsable({ intakeId: fixture.catalog.intakeId, catalogSha256: fixture.catalogSha256 }, {
    policy,
    trustedRoots: [fixture.root],
  });
  assert.equal(authority.overlay.entryCount, 1);
  assert.equal(authority.receipt.verifiedCount, 1);
  assert.equal(authority.overlay.entries[0].semanticSummary, '한 가지 제품 디자인을 안내하는 정지 이미지');
});

test('builder rejects visible price text without a price claim signal', async () => {
  const fixture = await makeFixture({ visibleText: ['₩ 600'], claimSignals: [] });
  await assert.rejects(buildVerifiedContentAuthority(fixture.options), /requires a price claim signal/u);
});

test('builder rejects a fabricated sensitive text claim without an independent second review', async () => {
  const fixture = await makeFixture({ visibleText: ['9,999,999원'], claimSignals: ['price_claim'] });
  await mutateReview(fixture, (entry) => { delete entry.visibleTextObservations[0].secondReview; });
  await assert.rejects(buildVerifiedContentAuthority(fixture.options), /requires an independent visible-text second review/u);
});

test('builder rejects visible text claimed from a one-pixel blank image even with a signed second receipt', async () => {
  const fixture = await makeFixture({ visibleText: ['9,999,999원'], claimSignals: ['price_claim'], staticBytes: pixelPngFixture() });
  await assert.rejects(buildVerifiedContentAuthority(fixture.options), /crop is too small to support visible text/u);
});

test('builder rejects a static text crop whose pixels do not match the declared source region', async () => {
  const fixture = await makeFixture({ visibleText: ['제품 안내'] });
  const wrongCrop = encodeRgbaPng({ width: 2, height: 2, data: Buffer.from([0, 0, 0, 255, 0, 0, 0, 255, 255, 255, 255, 255, 255, 255, 255, 255]) });
  await writeFile(fixture.staticCropPath, wrongCrop);
  await mutateReview(fixture, (entry) => { entry.visibleTextObservations[0].cropEvidence.sha256 = digest(wrongCrop); });
  await assert.rejects(buildVerifiedContentAuthority(fixture.options), /crop pixels do not match source region/u);
});

test('builder rejects a sensitive second review that reuses the primary reviewer identity', async () => {
  const fixture = await makeFixture({ visibleText: ['600,000원'], claimSignals: ['price_claim'] });
  await mutateReview(fixture, (entry) => { entry.visibleTextObservations[0].secondReview.reviewerPrincipalId = 'FIXTURE REVIEWER'; });
  await assert.rejects(buildVerifiedContentAuthority(fixture.options), /second review binding mismatch/u);
});

test('builder rejects an invented primary reviewer even when the raw document is re-signed by another trusted key', async () => {
  const fixture = await makeFixture({ visibleText: ['가격 600원'], claimSignals: ['price_claim'] });
  const review = JSON.parse(await readFile(fixture.options.reviewFiles[0], 'utf8'));
  delete review.signature;
  review.reviewer = 'invented-primary-reviewer';
  review.entries[0].reviewEvidence.reviewer = 'invented-primary-reviewer';
  review.signature = signReviewDocument(review, 'fixture-primary-reviewer', fixture.primaryPrivateKey);
  await writeFile(fixture.options.reviewFiles[0], bytes(review));
  await assert.rejects(buildVerifiedContentAuthority(fixture.options), /signing key is not trusted for the declared reviewer/u);
});

test('builder rejects an entry reviewer that differs from the signed primary reviewer', async () => {
  const fixture = await makeFixture();
  await mutateReview(fixture, (entry) => { entry.reviewEvidence.reviewer = 'invented-entry-reviewer'; });
  await assert.rejects(buildVerifiedContentAuthority(fixture.options), /does not match signed review principal/u);
});

test('builder rejects a second-review receipt whose bytes and declared hash were changed without its trusted signature', async () => {
  const fixture = await makeFixture({ visibleText: ['600,000원'], claimSignals: ['price_claim'] });
  const receipt = JSON.parse(await readFile(fixture.secondReviewPaths[0], 'utf8'));
  receipt.signature.valueBase64 = `${receipt.signature.valueBase64.slice(0, -4)}AAAA`;
  const changed = bytes(receipt);
  await writeFile(fixture.secondReviewPaths[0], changed);
  await mutateReview(fixture, (entry) => { entry.visibleTextObservations[0].secondReview.evidenceSha256 = digest(changed); });
  await assert.rejects(buildVerifiedContentAuthority(fixture.options), /reviewer signature is invalid/u);
});

test('builder rejects a sensitive second review timestamp before the primary review', async () => {
  const fixture = await makeFixture({ visibleText: ['600,000원'], claimSignals: ['price_claim'] });
  await mutateReview(fixture, (entry) => { entry.visibleTextObservations[0].secondReview.reviewedAt = '2026-09-07T04:59:59.000Z'; });
  await assert.rejects(buildVerifiedContentAuthority(fixture.options), /must not be before primary review/u);
});

test('builder rejects visible text that has no coordinate-bound pixel observation', async () => {
  const fixture = await makeFixture({ visibleText: ['제품 안내'] });
  await mutateReview(fixture, (entry) => { entry.visibleTextObservations = []; });
  await assert.rejects(buildVerifiedContentAuthority(fixture.options), /schema failed|one pixel observation/u);
});

test('builder never promotes non-sensitive OCR or contextual inference into visible pixel text', async () => {
  const fixture = await makeFixture({
    visibleText: [], ocrText: 'BASIC', sourceContext: ['가격표 폴더'], inferredText: ['3년 무상 A/S'],
    claimSignals: [],
  });
  const result = await buildVerifiedContentAuthority(fixture.options);
  const overlay = JSON.parse(await readFile(result.overlayPath, 'utf8'));
  assert.deepEqual(overlay.entries[0].visibleText, []);
  assert.equal(overlay.entries[0].ocrText, 'BASIC');
  assert.deepEqual(overlay.entries[0].sourceContext, ['가격표 폴더']);
  assert.deepEqual(overlay.entries[0].inferredText, ['3년 무상 A/S']);
  assert.deepEqual(overlay.entries[0].claimSignals, []);
});

test('builder rejects sensitive OCR that has not been confirmed as visible pixel text', async () => {
  const fixture = await makeFixture({ visibleText: [], ocrText: '600,000원', claimSignals: [] });
  await assert.rejects(buildVerifiedContentAuthority(fixture.options), /Sensitive OCR text lacks confirmed pixel evidence/u);
});

for (const [field, value] of [
  ['observedSummary', 'A/S 안내 이미지'],
  ['contentType', '가격표'],
  ['useCases', ['할인 행사 안내']],
]) {
  test(`builder rejects sensitive searchable ${field} without pixel evidence`, async () => {
    const fixture = await makeFixture();
    await mutateReview(fixture, (entry) => { entry[field] = value; });
    await assert.rejects(buildVerifiedContentAuthority(fixture.options), /Sensitive searchable content lacks pixel evidence/u);
  });
}

test('builder rejects a claim whose evidence points outside visible text', async () => {
  const fixture = await makeFixture({ visibleText: ['제품 안내'], claimSignals: ['price_or_discount_claim'] });
  await assert.rejects(buildVerifiedContentAuthority(fixture.options), /does not point to visible price text/u);
});

test('builder rejects static claim evidence labeled as GIF-frame evidence', async () => {
  const fixture = await makeFixture({ visibleText: ['600,000원'], claimSignals: ['price_or_discount_claim'] });
  await mutateReview(fixture, (entry) => { entry.claimEvidence[0].provenance = 'gif_frame_visible_text'; entry.claimEvidence[0].frameIndex = 0; });
  await assert.rejects(buildVerifiedContentAuthority(fixture.options), /Static claim evidence must use direct visible text/u);
});

test('builder rejects GIF claim evidence pointed at a different frame than the visible text observation', async () => {
  const fixture = await makeFixture({ mediaKind: 'gif', visibleText: ['600,000원'], claimSignals: ['price_claim'] });
  await mutateReview(fixture, (entry) => { entry.claimEvidence[0].frameIndex = 1; });
  await assert.rejects(buildVerifiedContentAuthority(fixture.options), /frame does not match its visible text observation/u);
});

test('BASIC GLASS ASH and 원슬라이딩 are not treated as A/S or price evidence', async () => {
  const fixture = await makeFixture({
    visibleText: ['BASIC', 'GLASS', 'ASH', '원슬라이딩'],
    searchTopics: ['BASIC', 'GLASS', 'ASH', '원슬라이딩'],
  });
  const result = await buildVerifiedContentAuthority(fixture.options);
  const overlay = JSON.parse(await readFile(result.overlayPath, 'utf8'));
  assert.deepEqual(overlay.entries[0].claimSignals, []);
  assert.deepEqual(overlay.entries[0].claimEvidence, []);
});

test('builder rejects A/S topic and signal without directly visible A/S text', async () => {
  const fixture = await makeFixture({ visibleText: ['BASIC'], claimSignals: [], searchTopics: ['상품 안내'] });
  await mutateReview(fixture, (entry) => {
    entry.claimSignals = ['as_claim'];
    entry.searchTags.topics = ['A/S'];
    entry.claimEvidence = [{
      signal: 'as_claim', topic: 'after_sales_service', provenance: 'visible_text', visibleTextIndices: [0],
      sourceObjectSha256: entry.sha256, evidenceRef: entry.reviewEvidence.originalPath,
    }];
  });
  await assert.rejects(buildVerifiedContentAuthority(fixture.options), /does not point to visible A\/S text/u);
});

test('builder rejects unsigned review schedule and specification claims hidden in searchable meaning', async () => {
  const attacks = [
    ['리뷰 15,000개를 안내하는 이미지', 'review'],
    ['3일 이내 시공을 안내하는 이미지', 'schedule'],
    ['10mm 강화유리 사양을 안내하는 이미지', 'specification'],
  ];
  for (const [summary, topic] of attacks) {
    const fixture = await makeFixture();
    await mutateReview(fixture, (entry) => {
      entry.observedSummary = summary;
      entry.searchTags.topics = [topic];
    });
    await assert.rejects(buildVerifiedContentAuthority(fixture.options), /Sensitive search topic lacks pixel evidence|Sensitive searchable content lacks pixel evidence/u);
  }
});

test('builder verifies decoded GIF metadata independently from sampled frames', async () => {
  const fixture = await makeFixture({ mediaKind: 'gif' });
  await mutateReview(fixture, (entry) => { entry.gifReview.decodedFrameCount = 1; });
  await assert.rejects(buildVerifiedContentAuthority(fixture.options), /GIF decoded metadata mismatch/u);
});

test('builder rejects a GIF original reused as if it were extracted frame evidence', async () => {
  const fixture = await makeFixture({ mediaKind: 'gif' });
  await mutateReview(fixture, (entry) => {
    entry.gifReview.sampleEvidence[0].path = entry.reviewEvidence.originalPath;
    entry.gifReview.sampleEvidence[0].sha256 = entry.sha256;
  });
  await assert.rejects(buildVerifiedContentAuthority(fixture.options), /must be a valid PNG frame/u);
});

test('builder rejects a short GIF playback observation even when a storyboard exists', async () => {
  const fixture = await makeFixture({ mediaKind: 'gif' });
  await mutateReview(fixture, (entry) => { entry.gifReview.fullPlaybackObservation.observedToMs = 100; });
  await assert.rejects(buildVerifiedContentAuthority(fixture.options), /shorter than decoded duration/u);
});

test('builder rejects all-frame GIF review that sampled only part of the decoded frames', async () => {
  const fixture = await makeFixture({ mediaKind: 'gif' });
  await mutateReview(fixture, (entry) => { entry.gifReview.fullPlaybackObservation.method = 'all_decoded_frames_reviewed'; });
  await assert.rejects(buildVerifiedContentAuthority(fixture.options), /does not cover every decoded frame/u);
});

test('runtime evidence replay rejects a GIF entry with no GIF review evidence', async () => {
  const hash = 'a'.repeat(64);
  await assert.rejects(assertContentEntryEvidence({
    sourceObjectSha256: hash,
    visibleText: [], claimSignals: [], claimEvidence: [],
    searchTags: { topics: [] },
  }, 'gif'), /GIF review evidence is missing/u);
});

test('runtime evidence replay rejects fabricated visible text for the known no-text object', async () => {
  await assert.rejects(assertContentEntryEvidence({
    sourceObjectSha256: 'bff4bbbb15d2b2cd9404ebdfe3d8ada978d4ca1c8c8ab0237a7066518367e009',
    visibleText: ['BASIC', 'FULL WINDOW'], ocrText: 'BASIC; FULL WINDOW', claimSignals: [], claimEvidence: [],
    searchTags: { topics: [] },
  }, 'static'), /Known fabricated no-text regression remains/u);
});

test('builder seals separate decoded sampled and full-playback GIF facts', async () => {
  const fixture = await makeFixture({ mediaKind: 'gif' });
  const result = await buildVerifiedContentAuthority(fixture.options);
  const receipt = JSON.parse(await readFile(result.receiptPath, 'utf8'));
  assert.equal(receipt.decodedGifFrameCount, 2);
  assert.equal(receipt.sampledGifFrameCount, 1);
  assert.equal(receipt.fullPlaybackObservedGifCount, 1);
});

test('builder rejects entry review time after the shard review time', async () => {
  const fixture = await makeFixture();
  await mutateReview(fixture, (entry) => { entry.reviewEvidence.reviewedAt = '2026-09-07T05:00:01.000Z'; });
  await assert.rejects(buildVerifiedContentAuthority(fixture.options), /Primary review .* must not be after entry reviewedAt/u);
});

test('builder rejects shard review time after seal time', async () => {
  const fixture = await makeFixture({ generatedAt: '2026-09-07T04:59:59.000Z' });
  await assert.rejects(buildVerifiedContentAuthority(fixture.options), /must not be after sealedAt/u);
});

test('builder rejects an authority seal timestamp beyond the clock-skew window', async () => {
  const fixture = await makeFixture({ generatedAt: new Date(Date.now() + 60 * 60 * 1000).toISOString() });
  await assert.rejects(buildVerifiedContentAuthority(fixture.options), /sealedAt must not be in the future/u);
});

test('builder rejects a product name that conflicts with the source product profile', async () => {
  const fixture = await makeFixture({ visibleText: [], claimSignals: [] });
  const profile = JSON.parse(await readFile(fixture.options.profilePath, 'utf8'));
  profile.products.push({ folder: '다른상품', productId: 'PROD-OTHER', label: '원슬라이딩중문', slug: 'other', sourceId: 'SRC-OTHER', exclusiveAliases: ['원슬라이딩중문'], requiredAliases: ['원슬라이딩중문'] });
  await writeFile(fixture.options.profilePath, bytes(profile));
  await mutateReview(fixture, (entry) => {
    entry.observedSummary = '원슬라이딩중문 제품 이미지';
    entry.searchTags.productTypes = ['원슬라이딩중문'];
  });
  await assert.rejects(buildVerifiedContentAuthority(fixture.options), /product identity conflicts with source/u);
});

test('builder rejects a nonempty product tag that omits its single-source product identity', async () => {
  const fixture = await makeFixture({ visibleText: [], claimSignals: [] });
  await mutateReview(fixture, (entry) => {
    entry.observedSummary = '일반 상세 이미지';
    entry.searchTags.productTypes = ['일반 중문'];
  });
  await assert.rejects(buildVerifiedContentAuthority(fixture.options), /omits its single-source product identity/u);
});

test('builder rejects a source product named in the summary but omitted from productTypes', async () => {
  const fixture = await makeFixture({ visibleText: [], claimSignals: [] });
  await mutateReview(fixture, (entry) => { entry.searchTags.productTypes = []; });
  await assert.rejects(buildVerifiedContentAuthority(fixture.options), /names a source product but omits its productTypes tag/u);
});

test('builder does not accept a generic shared token as a detailed product identity', async () => {
  const fixture = await makeFixture({ visibleText: [], claimSignals: [] });
  const profile = JSON.parse(await readFile(fixture.options.profilePath, 'utf8'));
  profile.products[0].label = 'ABS도어 방문교체';
  profile.products[0].requiredAliases = ['ABS도어 방문교체', '방문교체'];
  await writeFile(fixture.options.profilePath, bytes(profile));
  await mutateReview(fixture, (entry) => {
    entry.observedSummary = 'ABS도어 제품 이미지';
    entry.searchTags.productTypes = ['ABS도어'];
  });
  await assert.rejects(buildVerifiedContentAuthority(fixture.options), /omits its single-source product identity/u);
});

test('builder accepts a generic family tag only with profile support and an explicit visual reason', async () => {
  const fixture = await makeFixture({ visibleText: [], claimSignals: [] });
  const profile = JSON.parse(await readFile(fixture.options.profilePath, 'utf8'));
  profile.products[0].label = 'ABS도어 방문교체';
  profile.products[0].requiredAliases = ['ABS도어 방문교체', '방문교체'];
  profile.products[0].genericAliases = ['ABS도어'];
  await writeFile(fixture.options.profilePath, bytes(profile));
  await mutateReview(fixture, (entry) => {
    entry.observedSummary = '세부 패키지를 특정하지 않는 ABS도어 공용 색상표';
    entry.searchTags.productTypes = ['ABS도어'];
    entry.genericSourceProduct = true;
    entry.genericSourceProductReason = '원본에는 ABS도어 공용 색상만 보이고 세부 서비스명은 표시되지 않는다.';
  });
  const result = await buildVerifiedContentAuthority(fixture.options);
  assert.equal(result.entryCount, 1);
});

test('builder rejects cross-product declarations duplicated from catalog sourceRefs', async () => {
  const fixture = await makeFixture({ visibleText: [], claimSignals: [] });
  await mutateReview(fixture, (entry) => { entry.crossProductSourceIds = ['SRC-FIXTURE']; });
  await assert.rejects(buildVerifiedContentAuthority(fixture.options), /duplicates a catalog sourceRef/u);
});

test('sealed quality authority rejects review evidence changed after receipt creation', async () => {
  const fixture = await makeFixture({ visibleText: [], claimSignals: [] });
  const result = await buildVerifiedContentAuthority(fixture.options);
  const receipt = JSON.parse(await readFile(result.receiptPath, 'utf8'));
  await writeFile(receipt.reviewFiles[0].path, '{}\n', 'utf8');
  await assert.rejects(assertCatalogContentUsable({ intakeId: fixture.catalog.intakeId, catalogSha256: fixture.catalogSha256 }, {
    policy: qualityPolicy(result),
    trustedRoots: [fixture.root],
  }), /Content review shard SHA-256 mismatch/u);
});

test('sealed quality authority rejects a policy bound to a different intake profile', async () => {
  const fixture = await makeFixture({ visibleText: [], claimSignals: [] });
  const result = await buildVerifiedContentAuthority(fixture.options);
  const policy = qualityPolicy(result);
  policy.records[0].profileSha256 = 'f'.repeat(64);
  await assert.rejects(assertCatalogContentUsable({ intakeId: fixture.catalog.intakeId, catalogSha256: fixture.catalogSha256 }, {
    policy,
    trustedRoots: [fixture.root],
  }), /authority binding is invalid/u);
});

test('sealed quality authority rejects a changed intake profile snapshot', async () => {
  const fixture = await makeFixture({ visibleText: [], claimSignals: [] });
  const result = await buildVerifiedContentAuthority(fixture.options);
  const receipt = JSON.parse(await readFile(result.receiptPath, 'utf8'));
  await writeFile(receipt.profilePath, '{}\n', 'utf8');
  await assert.rejects(assertCatalogContentUsable({ intakeId: fixture.catalog.intakeId, catalogSha256: fixture.catalogSha256 }, {
    policy: qualityPolicy(result),
    trustedRoots: [fixture.root],
  }), /Content intake profile snapshot SHA-256 mismatch/u);
});

test('sealed quality authority recomputes claim risk counts from overlay entries', async () => {
  const fixture = await makeFixture({ visibleText: [], claimSignals: [] });
  const result = await buildVerifiedContentAuthority(fixture.options);
  const receipt = JSON.parse(await readFile(result.receiptPath, 'utf8'));
  receipt.claimSignalAssetCount = 1;
  const receiptBytes = bytes(receipt);
  await writeFile(result.receiptPath, receiptBytes);
  const policy = qualityPolicy(result);
  policy.records[0].receiptSha256 = digest(receiptBytes);
  await assert.rejects(assertCatalogContentUsable({ intakeId: fixture.catalog.intakeId, catalogSha256: fixture.catalogSha256 }, {
    policy,
    trustedRoots: [fixture.root],
  }), /authority binding is invalid/u);
});

test('sealed quality authority rejects an original evidence file replaced after sealing', async () => {
  const fixture = await makeFixture({ visibleText: [], claimSignals: [] });
  const result = await buildVerifiedContentAuthority(fixture.options);
  const receipt = JSON.parse(await readFile(result.receiptPath, 'utf8'));
  const shard = JSON.parse(await readFile(receipt.reviewFiles[0].path, 'utf8'));
  await writeFile(shard.entries[0].originalPath, Buffer.from('replacement pixels', 'utf8'));
  await assert.rejects(assertCatalogContentUsable({ intakeId: fixture.catalog.intakeId, catalogSha256: fixture.catalogSha256 }, {
    policy: qualityPolicy(result),
    trustedRoots: [fixture.root],
  }), /Original file hash mismatch|Content original evidence SHA-256 mismatch/u);
});

test('sealed quality authority rejects an independently reviewed text receipt changed after sealing', async () => {
  const fixture = await makeFixture({ visibleText: ['600,000원'], claimSignals: ['price_claim'] });
  const result = await buildVerifiedContentAuthority(fixture.options);
  const receipt = JSON.parse(await readFile(fixture.secondReviewPaths[0], 'utf8'));
  receipt.observedText = '9,999,999원';
  await writeFile(fixture.secondReviewPaths[0], bytes(receipt));
  await assert.rejects(assertCatalogContentUsable({ intakeId: fixture.catalog.intakeId, catalogSha256: fixture.catalogSha256 }, {
    policy: qualityPolicy(result), trustedRoots: [fixture.root],
  }), /Visible text second review .*SHA-256 mismatch/u);
});

test('sealed quality authority rejects GIF sample evidence changed after sealing', async () => {
  const fixture = await makeFixture({ mediaKind: 'gif' });
  const result = await buildVerifiedContentAuthority(fixture.options);
  await writeFile(fixture.sampleEvidencePath, Buffer.from('changed sample evidence'));
  await assert.rejects(assertCatalogContentUsable({ intakeId: fixture.catalog.intakeId, catalogSha256: fixture.catalogSha256 }, {
    policy: qualityPolicy(result), trustedRoots: [fixture.root],
  }), /GIF sample evidence .*SHA-256 mismatch/u);
});

test('sealed quality authority rejects GIF playback receipt changed after sealing', async () => {
  const fixture = await makeFixture({ mediaKind: 'gif' });
  const result = await buildVerifiedContentAuthority(fixture.options);
  await writeFile(fixture.playbackReceiptPath, Buffer.from('{}\n'));
  await assert.rejects(assertCatalogContentUsable({ intakeId: fixture.catalog.intakeId, catalogSha256: fixture.catalogSha256 }, {
    policy: qualityPolicy(result), trustedRoots: [fixture.root],
  }), /GIF playback receipt .*SHA-256 mismatch/u);
});

test('sealed quality authority rejects a needs-escalation shard even after consistent resealing', async () => {
  const fixture = await makeFixture({ visibleText: [], claimSignals: [] });
  const result = await buildVerifiedContentAuthority(fixture.options);
  const receipt = JSON.parse(await readFile(result.receiptPath, 'utf8'));
  const shardPath = receipt.reviewFiles[0].path;
  const shard = JSON.parse(await readFile(shardPath, 'utf8'));
  shard.entries[0].humanReviewStatus = 'needs_escalation';
  shard.entries[0].decisionHash = computeContentDecisionHash(shard.entries[0]);
  const shardBytes = bytes(shard);
  const shardSha256 = digest(shardBytes);
  await writeFile(shardPath, shardBytes);
  receipt.reviewFiles[0].sha256 = shardSha256;
  receipt.treeHash = digest(Buffer.from(`${[
    `${receipt.overlaySha256}  content-overlay.json`,
    `${receipt.baseCatalogSha256}  base-catalog.json`,
    `${receipt.profileSha256}  intake-profile.json`,
    `${receipt.reviewerTrustSha256}  reviewer-trust.json`,
    `${shardSha256}  ${shardPath}`,
    `${receipt.reviewFiles[0].rawSha256}  ${receipt.reviewFiles[0].rawPath}`,
  ].sort().join('\n')}\n`, 'utf8'));
  const receiptBytes = bytes(receipt);
  await writeFile(result.receiptPath, receiptBytes);
  const policy = qualityPolicy(result);
  policy.records[0].receiptSha256 = digest(receiptBytes);
  await assert.rejects(assertCatalogContentUsable({ intakeId: fixture.catalog.intakeId, catalogSha256: fixture.catalogSha256 }, {
    policy,
    trustedRoots: [fixture.root],
  }), /Sealed review shard does not match its signed primary review input|Content review entry is not verified/u);
});

test('sealed quality authority rejects an actual GIF reclassified as static after resealing', async () => {
  const fixture = await makeFixture({ mediaKind: 'gif' });
  const result = await buildVerifiedContentAuthority(fixture.options);
  const receipt = JSON.parse(await readFile(result.receiptPath, 'utf8'));
  const shardPath = receipt.reviewFiles[0].path;
  const shard = JSON.parse(await readFile(shardPath, 'utf8'));
  shard.mediaKind = 'static';
  shard.entries[0].mediaType = 'image/jpeg';
  shard.entries[0].annotationMethod = 'full_resolution_original_reviewed';
  delete shard.entries[0].gifReview;
  shard.entries[0].decisionHash = computeContentDecisionHash(shard.entries[0]);
  const shardBytes = bytes(shard);
  const shardSha256 = digest(shardBytes);
  await writeFile(shardPath, shardBytes);

  const overlay = JSON.parse(await readFile(result.overlayPath, 'utf8'));
  overlay.entries[0].gifMetadata = null;
  overlay.entries[0].annotationMethod = 'full_resolution_original_reviewed';
  overlay.entries[0].decisionHash = shard.entries[0].decisionHash;
  const overlayBytes = bytes(overlay);
  const overlaySha256 = digest(overlayBytes);
  await writeFile(result.overlayPath, overlayBytes);

  receipt.reviewFiles[0].sha256 = shardSha256;
  receipt.overlaySha256 = overlaySha256;
  receipt.staticCount = 1;
  receipt.gifCount = 0;
  receipt.decodedGifFrameCount = 0;
  receipt.sampledGifFrameCount = 0;
  receipt.fullPlaybackObservedGifCount = 0;
  receipt.treeHash = digest(Buffer.from(`${[
    `${overlaySha256}  content-overlay.json`,
    `${receipt.baseCatalogSha256}  base-catalog.json`,
    `${receipt.profileSha256}  intake-profile.json`,
    `${receipt.reviewerTrustSha256}  reviewer-trust.json`,
    `${shardSha256}  ${shardPath}`,
    `${receipt.reviewFiles[0].rawSha256}  ${receipt.reviewFiles[0].rawPath}`,
  ].sort().join('\n')}\n`, 'utf8'));
  const receiptBytes = bytes(receipt);
  await writeFile(result.receiptPath, receiptBytes);
  const policy = qualityPolicy(result);
  policy.records[0].overlaySha256 = overlaySha256;
  policy.records[0].receiptSha256 = digest(receiptBytes);
  await assert.rejects(assertCatalogContentUsable({ intakeId: fixture.catalog.intakeId, catalogSha256: fixture.catalogSha256 }, {
    policy,
    trustedRoots: [fixture.root],
  }), /Content review shard receipt binding is invalid|Content review entry does not match base catalog/u);
});

test('sealed quality authority rejects overlay content injected after review sealing', async () => {
  const fixture = await makeFixture({ visibleText: [], claimSignals: [] });
  const result = await buildVerifiedContentAuthority(fixture.options);
  const overlay = JSON.parse(await readFile(result.overlayPath, 'utf8'));
  overlay.entries[0].semanticSummary = 'POST-REVIEW OVERLAY CONTENT INJECTION';
  const overlayBytes = bytes(overlay);
  const overlaySha256 = digest(overlayBytes);
  await writeFile(result.overlayPath, overlayBytes);

  const receipt = JSON.parse(await readFile(result.receiptPath, 'utf8'));
  receipt.overlaySha256 = overlaySha256;
  receipt.treeHash = digest(Buffer.from(`${[
    `${overlaySha256}  content-overlay.json`,
    `${receipt.baseCatalogSha256}  base-catalog.json`,
    `${receipt.profileSha256}  intake-profile.json`,
    `${receipt.reviewerTrustSha256}  reviewer-trust.json`,
    ...receipt.reviewFiles.map((entry) => `${entry.sha256}  ${entry.path}`),
    ...receipt.reviewFiles.map((entry) => `${entry.rawSha256}  ${entry.rawPath}`),
  ].sort().join('\n')}\n`, 'utf8'));
  const receiptBytes = bytes(receipt);
  await writeFile(result.receiptPath, receiptBytes);

  const policy = qualityPolicy(result);
  policy.records[0].overlaySha256 = overlaySha256;
  policy.records[0].receiptSha256 = digest(receiptBytes);
  await assert.rejects(assertCatalogContentUsable({ intakeId: fixture.catalog.intakeId, catalogSha256: fixture.catalogSha256 }, {
    policy,
    trustedRoots: [fixture.root],
  }), /Content overlay does not match sealed review shard/u);
});

test('sealed quality authority rejects policy verification before receipt sealing', async () => {
  const fixture = await makeFixture();
  const result = await buildVerifiedContentAuthority(fixture.options);
  const policy = qualityPolicy(result);
  policy.records[0].verifiedAt = '2026-09-07T05:59:59.000Z';
  await assert.rejects(assertCatalogContentUsable({ intakeId: fixture.catalog.intakeId, catalogSha256: fixture.catalogSha256 }, {
    policy, trustedRoots: [fixture.root],
  }), /authority binding is invalid/u);
});

async function makeFixture({
  visibleText = [], claimSignals = [], claimEvidence, ocrText = '', sourceContext,
  inferredText = [], searchTopics = ['상품 안내'], mediaKind = 'static', generatedAt = '2026-09-07T06:00:00.000Z', staticBytes = staticPngFixture(),
} = {}) {
  const root = await mkdtemp(join(tmpdir(), 'munjanggun-content-review-'));
  const { publicKey: primaryPublicKey, privateKey: primaryPrivateKey } = generateKeyPairSync('ed25519');
  const { publicKey: secondPublicKey, privateKey: secondPrivateKey } = generateKeyPairSync('ed25519');
  const primaryPublicKeyPem = primaryPublicKey.export({ type: 'spki', format: 'pem' });
  const secondPublicKeyPem = secondPublicKey.export({ type: 'spki', format: 'pem' });
  const reviewerTrustPath = resolve(root, 'reviewer-trust.json');
  const reviewerTrustBytes = bytes({
    schema: 'munjanggun.assetContentReviewerTrust.v1', version: '1.0', keys: [{
      principalId: 'fixture reviewer', keyId: 'fixture-primary-reviewer', status: 'active',
      publicKeyPem: primaryPublicKeyPem, fingerprint: digest(Buffer.from(primaryPublicKeyPem, 'utf8')),
    }, {
      principalId: 'fixture independent reviewer', keyId: 'fixture-second-reviewer', status: 'active',
      publicKeyPem: secondPublicKeyPem, fingerprint: digest(Buffer.from(secondPublicKeyPem, 'utf8')),
    }],
  });
  await writeFile(reviewerTrustPath, reviewerTrustBytes);
  const rawRoot = resolve(root, 'raw');
  const objectRoot = resolve(root, 'objects');
  const outputRoot = resolve(root, 'authority');
  const original = mediaKind === 'gif' ? animatedGifFixture() : staticBytes;
  const sha256 = digest(original);
  const sourceRelativePath = mediaKind === 'gif' ? '제품/001.gif' : '제품/001.png';
  const originalPath = resolve(rawRoot, ...sourceRelativePath.split('/'));
  const objectRef = `sha256/${sha256.slice(0, 2)}/${sha256}.${mediaKind === 'gif' ? 'gif' : 'png'}`;
  await mkdir(resolve(originalPath, '..'), { recursive: true });
  await mkdir(resolve(objectRoot, 'sha256', sha256.slice(0, 2)), { recursive: true });
  await writeFile(originalPath, original);
  await writeFile(resolve(objectRoot, ...objectRef.split('/')), original);
  const evidenceSha256 = digest(original);
  const playbackReceiptPath = resolve(root, 'evidence', 'playback.json');
  const sampleEvidencePath = resolve(root, 'evidence', 'sample-0.bin');
  const sampleEvidenceBytes = pixelPngFixture();
  const sampleEvidenceSha256 = digest(sampleEvidenceBytes);
  const playbackReceipt = mediaKind === 'gif' ? {
    schema: 'munjanggun.gifPlaybackObservation.v1', observed: true, sourceObjectSha256: sha256,
    method: 'continuous_original_playback', observedFromMs: 0, observedToMs: 200,
    decodedFrameCount: 2, decodedDurationMs: 200,
    reviewedAt: '2026-09-07T05:00:00.000Z', reviewer: 'fixture reviewer',
  } : null;
  if (playbackReceipt) {
    await mkdir(resolve(playbackReceiptPath, '..'), { recursive: true });
    await writeFile(playbackReceiptPath, bytes(playbackReceipt));
    await writeFile(sampleEvidencePath, sampleEvidenceBytes);
  }
  const staticCropRegion = { x: 0, y: 0, width: 1, height: 1, unit: 'normalized' };
  const staticCrop = mediaKind === 'static' ? decodeStaticRegionPixels(original, staticCropRegion) : null;
  const staticCropBytes = staticCrop ? encodeRgbaPng(staticCrop) : null;
  const staticCropPath = resolve(root, 'evidence', 'static-text-crop.png');
  if (staticCropBytes) {
    await mkdir(resolve(staticCropPath, '..'), { recursive: true });
    await writeFile(staticCropPath, staticCropBytes);
  }
  const visibleTextObservations = visibleText.map((text, index) => ({
    text, sourceObjectSha256: sha256, provenance: mediaKind === 'gif' ? 'gif_frame_pixel' : 'static_pixel',
    region: mediaKind === 'gif' ? { x: 0, y: Math.min(index * 0.01, 0.9), width: 1, height: 0.1, unit: 'normalized' } : staticCropRegion,
    evidenceRef: originalPath, evidenceSha256,
    ...(mediaKind === 'gif' ? { frameIndex: 0 } : {}),
    ...(mediaKind === 'static' ? { cropEvidence: {
          path: staticCropPath, sha256: digest(staticCropBytes), pixelSha256: staticCrop.pixelSha256,
          width: staticCrop.width, height: staticCrop.height, decoderVersion: STATIC_PIXEL_DECODER_VERSION,
          sourceWidth: staticCrop.sourceWidth, sourceHeight: staticCrop.sourceHeight, pixelRegion: staticCrop.pixelRegion,
          encoderVersion: STATIC_PNG_ENCODER_VERSION,
          sourceObjectSha256: sha256,
    } } : {}),
  }));
  const secondReviewPaths = [];
  if (claimSignals.length) {
    for (let index = 0; index < visibleTextObservations.length; index += 1) {
      const observation = visibleTextObservations[index];
      const observationDigest = computeVisibleTextObservationDigest(observation);
      const secondReviewPath = resolve(root, 'evidence', `second-review-${index}.json`);
      const secondReceipt = {
        schema: 'munjanggun.visibleTextSecondReview.v1', version: '1.0', status: 'confirmed_visible', method: 'independent_crop_review',
        sourceObjectSha256: sha256, observedText: observation.text, region: observation.region,
        pixelEvidenceSha256: mediaKind === 'gif' ? sampleEvidenceSha256 : observation.cropEvidence.sha256,
        observationDigest, reviewerPrincipalId: 'fixture independent reviewer', reviewedAt: '2026-09-07T05:00:00.000Z',
      };
      secondReceipt.signature = {
        algorithm: 'Ed25519', keyId: 'fixture-second-reviewer',
        valueBase64: sign(null, Buffer.from(stableJson(secondReceipt), 'utf8'), secondPrivateKey).toString('base64'),
      };
      await mkdir(resolve(secondReviewPath, '..'), { recursive: true });
      await writeFile(secondReviewPath, bytes(secondReceipt));
      secondReviewPaths.push(secondReviewPath);
      observation.secondReview = {
        status: 'confirmed_visible', method: 'independent_crop_review', reviewerPrincipalId: 'fixture independent reviewer',
        reviewedAt: '2026-09-07T05:00:00.000Z', observationDigest,
        evidenceRef: secondReviewPath, evidenceSha256: digest(bytes(secondReceipt)),
      };
    }
  }
  const catalog = {
    schema: 'fixture', version: '1', intakeId: 'INTAKE-20260907-99', generatedAt: '2026-09-07T04:00:00.000Z', binaryGroupCount: 1,
    entries: [{
      sha256, byteSize: original.length, objectRef, mediaType: mediaKind === 'gif' ? 'image/gif' : 'image/png', contentId: 'CONTENT-FIXTURE',
      sourceRefs: [{ sourceId: 'SRC-FIXTURE', sourceRelativePath }],
    }],
  };
  const catalogBytes = bytes(catalog);
  const catalogPath = resolve(root, 'catalog.json');
  await writeFile(catalogPath, catalogBytes);
  const profilePath = resolve(root, 'profile.json');
  await writeFile(profilePath, bytes({
    schema: 'munjanggun.assetIntakeProfile.v1', version: '1.0', intakeId: catalog.intakeId,
    products: [{ folder: '제품', productId: 'PROD-FIXTURE', label: '제품', slug: 'fixture', sourceId: 'SRC-FIXTURE', exclusiveAliases: [], requiredAliases: ['제품'] }],
  }));
  const review = {
    schema: 'munjanggun.assetContentReviewInput.v1', version: '1.0', intakeId: catalog.intakeId,
    reviewId: `${mediaKind}-fixture`, mediaKind, reviewedAt: '2026-09-07T05:00:00.000Z', reviewer: 'fixture reviewer',
    entries: [{
      sha256, sourceRefs: catalog.entries[0].sourceRefs, verificationStatus: 'verified',
      observedSummary: '한 가지 제품 디자인을 안내하는 정지 이미지', contentType: 'product_guide',
      useCases: ['상품 안내'], textPresence: visibleText.length ? 'observed' : 'none_observed', visibleText,
      visibleTextObservations,
      ocrText,
      sourceContext: sourceContext ?? [sourceRelativePath], inferredText,
      searchTags: { productTypes: ['제품'], scenes: [], colors: [], designs: ['단일 디자인'], topics: searchTopics },
      claimSignals,
      claimEvidence: claimEvidence ?? claimSignals.map((signal) => ({
        signal, topic: 'price', provenance: mediaKind === 'gif' ? 'gif_frame_visible_text' : 'visible_text',
        visibleTextIndices: [0], sourceObjectSha256: sha256, evidenceRef: originalPath,
        ...(mediaKind === 'gif' ? { frameIndex: 0 } : {}),
      })),
      privacySignals: [], uncertainties: [],
      reviewEvidence: {
        method: mediaKind === 'gif' ? 'full_loop_original_opened' : 'full_resolution_original_opened',
        originalPath, reviewer: 'fixture reviewer', reviewedAt: '2026-09-07T05:00:00.000Z',
      },
      ...(mediaKind === 'gif' ? {
        gifReview: {
          decodedFrameCount: 2, decodedDurationMs: 200, decodedLoopCount: 0,
          sampledFrameCount: 1, sampledFrameIndices: [0], loopBehavior: 'infinite', storyboardEvidence: [],
          sampleEvidence: [{
            frameIndex: 0, path: sampleEvidencePath, sha256: sampleEvidenceSha256,
            pixelSha256: decodeGifFramePixels(original, [0]).frames.get(0).pixelSha256,
            width: 1, height: 1, decoderVersion: GIF_PIXEL_DECODER_VERSION, sourceObjectSha256: sha256,
          }],
          fullPlaybackObservation: {
            observed: true, method: 'continuous_original_playback', observedFromMs: 0, observedToMs: 200,
            reviewedAt: '2026-09-07T05:00:00.000Z', evidenceRef: playbackReceiptPath,
            evidenceSha256: digest(bytes(playbackReceipt)),
          },
        },
      } : {}),
    }],
  };
  review.signature = signReviewDocument(review, 'fixture-primary-reviewer', primaryPrivateKey);
  const reviewPath = resolve(root, 'review.json');
  await writeFile(reviewPath, bytes(review));
  return {
    root, catalog, catalogSha256: digest(catalogBytes), sampleEvidencePath, playbackReceiptPath, staticCropPath, secondReviewPaths,
    reviewerTrustPath, primaryPrivateKey,
    options: { catalogPath, profilePath, objectRoot, rawRoot, reviewFiles: [reviewPath], reviewerTrustPath, outputRoot, generatedAt, repoRoot: resolve(root, 'public-repo') },
  };
}

function qualityPolicy(result) {
  return {
    schema: 'munjanggun.assetContentQualityPolicy.v1', version: '1.0', updatedAt: '2026-09-07T06:00:00.000Z',
    records: [{
      intakeId: 'INTAKE-20260907-99', catalogSha256: result.baseCatalogSha256,
      status: 'visually_verified', reason: 'fixture verified original review', verifiedAt: '2026-09-07T06:00:00.000Z',
      authorityContractVersion: 'content-evidence-v3',
      profileSha256: result.profileSha256,
      reviewerTrustSha256: result.reviewerTrustSha256,
      overlayPath: result.overlayPath, overlaySha256: result.overlaySha256,
      receiptPath: result.receiptPath, receiptSha256: result.receiptSha256,
    }],
  };
}

function bytes(value) { return Buffer.from(`${JSON.stringify(value, null, 2)}\n`, 'utf8'); }
function digest(value) { return createHash('sha256').update(value).digest('hex'); }

function animatedGifFixture() {
  return Buffer.from('R0lGODlhAQABAIEAAP8AAAAAAAAAAAAAACH/C05FVFNDQVBFMi4wAwEAAAAh+QQACgAAACwAAAAAAQABAAAIBAABBAQAIfkEAQoAAQAsAAAAAAEAAQCBAAD/AAAAAAAAAAAACAQAAQQEADs=', 'base64');
}

function pixelPngFixture() {
  return Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/iZk9HQAAAABJRU5ErkJggg==', 'base64');
}

function staticPngFixture() {
  return encodeRgbaPng({
    width: 2,
    height: 2,
    data: Buffer.from([
      255, 0, 0, 255, 0, 0, 255, 255,
      0, 255, 0, 255, 255, 255, 255, 255,
    ]),
  });
}

async function mutateReview(fixture, mutate) {
  const review = JSON.parse(await readFile(fixture.options.reviewFiles[0], 'utf8'));
  delete review.signature;
  mutate(review.entries[0], review);
  review.signature = signReviewDocument(review, 'fixture-primary-reviewer', fixture.primaryPrivateKey);
  await writeFile(fixture.options.reviewFiles[0], bytes(review));
}

function signReviewDocument(document, keyId, privateKey) {
  return {
    algorithm: 'Ed25519', keyId,
    valueBase64: sign(null, Buffer.from(stableJson(document), 'utf8'), privateKey).toString('base64'),
  };
}
