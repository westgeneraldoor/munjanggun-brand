import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';
import { Script } from 'node:vm';
import {
  assertGifPlaybackWorkbenchReceipt, createGifPlaybackWorkbench, loadVerifiedGifPlaybackQueue, writeJsonExclusiveAtomic,
} from '../scripts/lib/gif-playback-workbench.mjs';

const GIF = Buffer.from('R0lGODlhAQABAIEAAP8AAAAAAAAAAAAAACH/C05FVFNDQVBFMi4wAwEAAAAh+QQACgAAACwAAAAAAQABAAAIBAABBAQAIfkEAQoAAQAsAAAAAAEAAQCBAAD/AAAAAAAAAAAACAQAAQQEADs=', 'base64');

test('workbench startup verifies queued GIF hash size frame count and duration', async () => {
  const fixture = await makeFixture();
  const queue = await loadVerifiedGifPlaybackQueue(fixture.queuePath);
  assert.equal(queue.entries[0].decodedFrameCount, 2);
  assert.equal(queue.entries[0].decodedDurationMs, 200);
  await writeFile(fixture.gifPath, Buffer.from('changed'));
  await assert.rejects(loadVerifiedGifPlaybackQueue(fixture.queuePath), /GIF source facts mismatch/u);
});

test('continuous visible playback writes a hash-bound receipt and never overwrites it', async (t) => {
  const fixture = await makeFixture();
  let clock = Date.parse('2026-09-08T01:00:00.000Z');
  const workbench = await createGifPlaybackWorkbench({
    queuePath: fixture.queuePath, evidenceRoot: fixture.evidenceRoot, reviewer: 'reviewer-a', now: () => clock,
  });
  t.after(() => workbench.close());
  const session = await post(workbench.url, '/api/sessions', { sha256: fixture.sha256 });
  await post(workbench.url, `/api/sessions/${session.token}/events`, event('playback_started', 0));
  clock += 100;
  await post(workbench.url, `/api/sessions/${session.token}/events`, event('heartbeat', 100));
  clock += 120;
  await post(workbench.url, `/api/sessions/${session.token}/events`, event('heartbeat', 220));
  const result = await post(workbench.url, `/api/sessions/${session.token}/decision`, { decision: 'complete', note: '처음부터 반복 경계까지 연속 확인', ...observation(220) });
  assert.equal(result.decision, 'complete');
  const receipt = JSON.parse(await readFile(result.paths[0], 'utf8'));
  assert.equal(receipt.schema, 'munjanggun.gifPlaybackObservation.v1');
  assert.equal(receipt.sourceObjectSha256, fixture.sha256);
  assert.equal(receipt.observedFromMs, 0);
  assert.equal(receipt.observedToMs, 200);
  assert.equal(receipt.wallElapsedMs, 220);
  assert.equal(receipt.eventCounts.blur, 0);
  assert.match(receipt.eventDigest, /^[a-f0-9]{64}$/u);
  assert.equal(assertGifPlaybackWorkbenchReceipt(receipt, { sha256: fixture.sha256, decodedFrameCount: 2, decodedDurationMs: 200 }), true);
  const tampered = structuredClone(receipt);
  tampered.eventLog[0].clientElapsedMs = 999;
  assert.throws(() => assertGifPlaybackWorkbenchReceipt(tampered, { sha256: fixture.sha256 }), /event digest is invalid/u);
  await assert.rejects(writeJsonExclusiveAtomic(result.paths[0], { changed: true }), /will not be overwritten/u);
  assert.equal(JSON.parse(await readFile(result.paths[0], 'utf8')).sourceObjectSha256, fixture.sha256);
});

test('finalization snapshots events and rejects late heartbeats while the receipt is being written', async (t) => {
  const fixture = await makeFixture();
  let clock = Date.parse('2026-09-08T01:20:00.000Z');
  let enterWrite;
  let releaseWrite;
  const writeEntered = new Promise((accept) => { enterWrite = accept; });
  const writeReleased = new Promise((accept) => { releaseWrite = accept; });
  const workbench = await createGifPlaybackWorkbench({
    queuePath: fixture.queuePath,
    evidenceRoot: fixture.evidenceRoot,
    reviewer: 'reviewer-race',
    now: () => clock,
    beforeReceiptWrite: async () => {
      enterWrite();
      await writeReleased;
    },
  });
  t.after(() => workbench.close());
  const session = await post(workbench.url, '/api/sessions', { sha256: fixture.sha256 });
  await post(workbench.url, `/api/sessions/${session.token}/events`, event('playback_started', 0));
  clock += 220;
  await post(workbench.url, `/api/sessions/${session.token}/events`, event('heartbeat', 220));
  const decisionPromise = postResponse(workbench.url, `/api/sessions/${session.token}/decision`, {
    decision: 'complete', note: '영수증 쓰기 중 이벤트 경합 검증', ...observation(220),
  });
  await writeEntered;
  const lateEvent = await postResponse(workbench.url, `/api/sessions/${session.token}/events`, event('heartbeat', 221));
  assert.equal(lateEvent.status, 409);
  assert.match(lateEvent.body.error, /finalizing/u);
  releaseWrite();
  const result = await decisionPromise;
  assert.equal(result.status, 201);
  const receipt = JSON.parse(await readFile(result.body.paths[0], 'utf8'));
  assert.equal(receipt.eventLog.length, 2);
  assert.equal(assertGifPlaybackWorkbenchReceipt(receipt, { sha256: fixture.sha256 }), true);
});

test('receipt replay rejects sparse, reversed, or cross-page event histories even when their digest and counts are consistent', () => {
  const valid = playbackReceiptFixture();
  assert.equal(assertGifPlaybackWorkbenchReceipt(valid, { sha256: valid.sourceObjectSha256 }), true);

  const sparse = structuredClone(valid);
  sparse.eventLog.splice(1, 1);
  refreshReceiptEvents(sparse);
  assert.throws(() => assertGifPlaybackWorkbenchReceipt(sparse), /event log is invalid/u);

  const reversedServerTime = structuredClone(valid);
  reversedServerTime.eventLog[2].serverAt = '2026-09-08T01:00:00.050Z';
  reversedServerTime.eventLog[2].elapsedSincePlaybackMs = 50;
  refreshReceiptEvents(reversedServerTime);
  assert.throws(() => assertGifPlaybackWorkbenchReceipt(reversedServerTime), /event log is invalid/u);

  const reversedClientTime = structuredClone(valid);
  reversedClientTime.eventLog[2].clientElapsedMs = 50;
  refreshReceiptEvents(reversedClientTime);
  assert.throws(() => assertGifPlaybackWorkbenchReceipt(reversedClientTime), /event log is invalid/u);

  const changedPage = structuredClone(valid);
  changedPage.eventLog[2].pageId = 'other-page';
  refreshReceiptEvents(changedPage);
  assert.throws(() => assertGifPlaybackWorkbenchReceipt(changedPage), /event log is invalid/u);
});

test('one deduplicated playback writes identical metadata receipts under both intake evidence roots', async (t) => {
  const intakeIds = ['INTAKE-20260904-01', 'INTAKE-20260907-01'];
  const fixture = await makeFixture({ intakeIds });
  let clock = Date.parse('2026-09-08T01:30:00.000Z');
  const firstRoot = resolve(fixture.root, 'first-evidence');
  const secondRoot = resolve(fixture.root, 'second-evidence');
  const workbench = await createGifPlaybackWorkbench({
    queuePath: fixture.queuePath,
    evidenceRootsByIntake: { [intakeIds[0]]: firstRoot, [intakeIds[1]]: secondRoot },
    reviewer: 'reviewer-shared', now: () => clock,
  });
  t.after(() => workbench.close());
  const session = await post(workbench.url, '/api/sessions', { sha256: fixture.sha256 });
  await post(workbench.url, `/api/sessions/${session.token}/events`, event('playback_started', 0));
  clock += 220;
  await post(workbench.url, `/api/sessions/${session.token}/events`, event('heartbeat', 220));
  const result = await post(workbench.url, `/api/sessions/${session.token}/decision`, {
    decision: 'complete', note: '중복 SHA는 한 번 연속 관찰', ...observation(220),
  });
  assert.equal(result.paths.length, 2);
  assert.equal(await readFile(result.paths[0], 'utf8'), await readFile(result.paths[1], 'utf8'));
});

test('blur or insufficient elapsed time rejects complete while escalation remains recordable', async (t) => {
  const fixture = await makeFixture();
  let clock = Date.parse('2026-09-08T02:00:00.000Z');
  const workbench = await createGifPlaybackWorkbench({
    queuePath: fixture.queuePath, evidenceRoot: fixture.evidenceRoot, reviewer: 'reviewer-b', now: () => clock,
  });
  t.after(() => workbench.close());
  const first = await post(workbench.url, '/api/sessions', { sha256: fixture.sha256 });
  await post(workbench.url, `/api/sessions/${first.token}/events`, event('playback_started', 0));
  clock += 50;
  await post(workbench.url, `/api/sessions/${first.token}/events`, event('blur', 50, { focused: false }));
  const rejected = await postResponse(workbench.url, `/api/sessions/${first.token}/decision`, { decision: 'complete', note: '중단됨', ...observation(50) });
  assert.equal(rejected.status, 409);
  assert.match(rejected.body.error, /blur|shorter/u);

  const second = await post(workbench.url, '/api/sessions', { sha256: fixture.sha256 });
  const result = await post(workbench.url, `/api/sessions/${second.token}/decision`, { decision: 'needs_escalation', note: '창 이탈로 재검토 필요', ...observation(0) });
  assert.equal(result.decision, 'needs_escalation');
  const escalation = JSON.parse(await readFile(result.paths[0], 'utf8'));
  assert.equal(escalation.decision, 'needs_escalation');
});

for (const [interruptType, overrides] of [
  ['visibility_hidden', { visible: false }],
  ['blur', { focused: false }],
  ['seek', {}],
  ['reload', {}],
]) {
  test(`${interruptType} independently rejects an otherwise long-enough playback`, async (t) => {
    const fixture = await makeFixture();
    let clock = Date.parse('2026-09-08T03:00:00.000Z');
    const workbench = await createGifPlaybackWorkbench({
      queuePath: fixture.queuePath, evidenceRoot: fixture.evidenceRoot, reviewer: 'reviewer-interruption', now: () => clock,
    });
    t.after(() => workbench.close());
    const session = await post(workbench.url, '/api/sessions', { sha256: fixture.sha256 });
    await post(workbench.url, `/api/sessions/${session.token}/events`, event('playback_started', 0));
    clock += 100;
    await post(workbench.url, `/api/sessions/${session.token}/events`, event('heartbeat', 100));
    clock += 120;
    await post(workbench.url, `/api/sessions/${session.token}/events`, event(interruptType, 220, overrides));
    clock += 10;
    const rejected = await postResponse(workbench.url, `/api/sessions/${session.token}/decision`, {
      decision: 'complete', note: '중단 사유 독립 검증', ...observation(230),
    });
    assert.equal(rejected.status, 409);
    assert.match(rejected.body.error, new RegExp(interruptType, 'u'));
  });
}

test('elapsed time guard independently rejects a focused uninterrupted short playback', async (t) => {
  const fixture = await makeFixture();
  let clock = Date.parse('2026-09-08T04:00:00.000Z');
  const workbench = await createGifPlaybackWorkbench({
    queuePath: fixture.queuePath, evidenceRoot: fixture.evidenceRoot, reviewer: 'reviewer-short', now: () => clock,
  });
  t.after(() => workbench.close());
  const session = await post(workbench.url, '/api/sessions', { sha256: fixture.sha256 });
  await post(workbench.url, `/api/sessions/${session.token}/events`, event('playback_started', 0));
  clock += 100;
  await post(workbench.url, `/api/sessions/${session.token}/events`, event('heartbeat', 100));
  const rejected = await postResponse(workbench.url, `/api/sessions/${session.token}/decision`, {
    decision: 'complete', note: '재생 시간 미달 검증', ...observation(100),
  });
  assert.equal(rejected.status, 409);
  assert.match(rejected.body.error, /elapsed_shorter_than_decoded_duration/u);
  assert.doesNotMatch(rejected.body.error, /blur|seek|reload|visibility_hidden/u);
});

test('UI explicitly distinguishes sampled frames from full continuous playback', async (t) => {
  const fixture = await makeFixture();
  const workbench = await createGifPlaybackWorkbench({ queuePath: fixture.queuePath, evidenceRoot: fixture.evidenceRoot, reviewer: 'reviewer-c' });
  t.after(() => workbench.close());
  const response = await fetch(workbench.url);
  const html = await response.text();
  assert.equal(response.status, 200);
  assert.match(html, /표본 프레임.*전체 재생 완료로 판정하지/u);
  assert.match(html, /visibilitychange/u);
  assert.match(html, /beforeunload/u);
  assert.match(html, /clearInterval\(timer\);timer=null;await eventChain/u);
  const embeddedScript = html.match(/<script>([\s\S]*)<\/script>/u)?.[1];
  assert.ok(embeddedScript, 'workbench page must include its browser script');
  assert.doesNotThrow(() => new Script(embeddedScript), 'workbench browser script must parse');
  const media = await fetch(`${workbench.url}media/${fixture.sha256}.gif?run=unique`);
  assert.equal(media.headers.get('cache-control'), 'no-store, no-cache, must-revalidate, max-age=0');
  assert.deepEqual(Buffer.from(await media.arrayBuffer()), GIF);
});

async function makeFixture({ intakeIds = ['INTAKE-20260908-01'] } = {}) {
  const root = await mkdtemp(join(tmpdir(), 'munjanggun-gif-workbench-'));
  const rawRoot = resolve(root, 'raw');
  const evidenceRoot = resolve(root, 'evidence');
  await mkdir(rawRoot, { recursive: true });
  const gifPath = resolve(rawRoot, 'animated.gif');
  await writeFile(gifPath, GIF);
  const sha256 = digest(GIF);
  const queuePath = resolve(root, 'review-queue.json');
  await writeFile(queuePath, `${JSON.stringify({
    schema: 'munjanggun.assetVisualReviewQueue.v1', version: '1.0', entries: [{
      sha256, byteSize: GIF.length, mediaType: 'image/gif', reviewMediaKind: 'gif', primaryOriginalPath: gifPath,
      decodedFrameCount: 2, decodedDurationMs: 200, intakeIds,
      origins: intakeIds.map((intakeId) => ({ intakeId, sourceRelativePath: '제품/animated.gif' })),
    }],
  }, null, 2)}\n`);
  return { root, rawRoot, evidenceRoot, gifPath, queuePath, sha256 };
}

function event(type, clientElapsedMs, overrides = {}) {
  return { type, ...observation(clientElapsedMs), ...overrides };
}

function observation(clientElapsedMs) {
  return { clientElapsedMs, visible: true, focused: true, pageId: 'test-page' };
}

async function post(base, path, body) {
  const response = await postResponse(base, path, body);
  if (!response.ok) throw new Error(response.body.error);
  return response.body;
}

async function postResponse(base, path, body) {
  const response = await fetch(new URL(path, base), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  return { ok: response.ok, status: response.status, body: await response.json() };
}

function digest(value) {
  return createHash('sha256').update(value).digest('hex');
}

function playbackReceiptFixture() {
  const eventLog = [
    { sequence: 1, type: 'playback_started', serverAt: '2026-09-08T01:00:00.000Z', elapsedSincePlaybackMs: 0, clientElapsedMs: 0, visible: true, focused: true, pageId: 'page-a' },
    { sequence: 2, type: 'heartbeat', serverAt: '2026-09-08T01:00:00.150Z', elapsedSincePlaybackMs: 150, clientElapsedMs: 150, visible: true, focused: true, pageId: 'page-a' },
    { sequence: 3, type: 'heartbeat', serverAt: '2026-09-08T01:00:00.300Z', elapsedSincePlaybackMs: 300, clientElapsedMs: 300, visible: true, focused: true, pageId: 'page-a' },
  ];
  const receipt = {
    schema: 'munjanggun.gifPlaybackObservation.v1', version: '1.0', observed: true,
    workbenchVersion: 'gif-playback-workbench-v1', sourceObjectSha256: 'a'.repeat(64),
    method: 'continuous_original_playback', observedFromMs: 0, observedToMs: 300,
    decodedFrameCount: 3, decodedDurationMs: 300, decodedLoopCount: 0,
    reviewer: 'reviewer-a', startedAt: '2026-09-08T01:00:00.000Z', reviewedAt: '2026-09-08T01:00:00.300Z',
    wallElapsedMs: 300, clientElapsedMs: 300, note: 'continuous review', playbackRate: 1,
    cachePolicy: 'cache_busted_no_store', heartbeatGapLimitMs: 250,
    eventLog, queueSha256: 'b'.repeat(64),
  };
  refreshReceiptEvents(receipt);
  return receipt;
}

function refreshReceiptEvents(receipt) {
  const names = ['playback_started', 'heartbeat', 'visibility_hidden', 'visibility_visible', 'blur', 'seek', 'reload', 'media_error'];
  receipt.eventCounts = Object.fromEntries(names.map((name) => [name, receipt.eventLog.filter((eventItem) => eventItem.type === name).length]));
  receipt.eventDigest = digest(Buffer.from(canonicalJson(receipt.eventLog), 'utf8'));
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}
