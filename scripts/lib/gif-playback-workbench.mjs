import { createHash, randomBytes } from 'node:crypto';
import { constants as fsConstants } from 'node:fs';
import { link, mkdir, open, readFile, stat, unlink } from 'node:fs/promises';
import { createServer } from 'node:http';
import { dirname, isAbsolute, resolve } from 'node:path';
import { inspectMedia } from './media-metadata.mjs';

const SHA256 = /^[a-f0-9]{64}$/u;
const INVALIDATING_EVENTS = new Set(['visibility_hidden', 'blur', 'seek', 'reload', 'media_error']);
const ALLOWED_EVENTS = new Set([
  'playback_started', 'heartbeat', 'visibility_hidden', 'visibility_visible', 'blur', 'seek', 'reload', 'media_error',
]);

export async function loadVerifiedGifPlaybackQueue(queuePath) {
  const path = resolve(String(queuePath ?? ''));
  const bytes = await readFile(path);
  const queue = JSON.parse(bytes.toString('utf8'));
  if (queue.schema !== 'munjanggun.assetVisualReviewQueue.v1' || !Array.isArray(queue.entries)) {
    throw new Error('GIF playback workbench requires munjanggun.assetVisualReviewQueue.v1');
  }
  const entries = [];
  for (const source of queue.entries.filter((entry) => entry.reviewMediaKind === 'gif' || entry.mediaType === 'image/gif')) {
    const sha256 = String(source.sha256 ?? '').toLowerCase();
    const originalPath = resolve(String(source.primaryOriginalPath ?? ''));
    if (!SHA256.test(sha256) || source.mediaType !== 'image/gif' || !isAbsolute(String(source.primaryOriginalPath ?? ''))
      || !Number.isSafeInteger(source.byteSize) || source.byteSize < 1) {
      throw new Error(`Invalid GIF playback queue entry: ${sha256 || 'unknown'}`);
    }
    let fileBytes;
    let fileStat;
    let decoded;
    try {
      [fileBytes, fileStat, decoded] = await Promise.all([readFile(originalPath), stat(originalPath), inspectMedia(originalPath)]);
    } catch {
      throw new Error(`GIF source facts mismatch: ${originalPath}`);
    }
    const actualSha256 = digest(fileBytes);
    if (!fileStat.isFile() || fileStat.size !== source.byteSize || actualSha256 !== sha256 || decoded.mediaType !== 'image/gif') {
      throw new Error(`GIF source facts mismatch: ${originalPath}`);
    }
    if ((source.decodedFrameCount !== undefined && source.decodedFrameCount !== decoded.frameCount)
      || (source.decodedDurationMs !== undefined && source.decodedDurationMs !== decoded.durationMs)) {
      throw new Error(`GIF decoded metadata mismatch: ${sha256}`);
    }
    entries.push({
      sha256,
      byteSize: source.byteSize,
      primaryOriginalPath: originalPath,
      decodedFrameCount: decoded.frameCount,
      decodedDurationMs: decoded.durationMs,
      decodedLoopCount: decoded.loopCount,
      width: decoded.width,
      height: decoded.height,
      intakeIds: uniqueStrings(source.intakeIds?.length ? source.intakeIds : source.origins?.map((origin) => origin.intakeId)),
      origins: Array.isArray(source.origins) ? source.origins : [],
    });
  }
  if (!entries.length) throw new Error('GIF playback queue has no GIF entries');
  if (new Set(entries.map((entry) => entry.sha256)).size !== entries.length) throw new Error('GIF playback queue contains duplicate SHA-256 entries');
  return { path, sha256: digest(bytes), queue, entries };
}

export async function createGifPlaybackWorkbench({
  queuePath,
  evidenceRoot = null,
  evidenceRootsByIntake = {},
  reviewer,
  host = '127.0.0.1',
  port = 0,
  now = () => Date.now(),
  heartbeatGapLimitMs = 2_000,
  requireZEvidenceRoots = false,
} = {}) {
  const reviewerName = String(reviewer ?? '').trim();
  if (!reviewerName) throw new Error('Reviewer is required');
  if (host !== '127.0.0.1') throw new Error('GIF playback workbench must bind to 127.0.0.1');
  if (!Number.isInteger(port) || port < 0 || port > 65_535) throw new Error('Workbench port is invalid');
  if (!Number.isFinite(heartbeatGapLimitMs) || heartbeatGapLimitMs < 250) throw new Error('Heartbeat gap limit is invalid');
  const verifiedQueue = await loadVerifiedGifPlaybackQueue(queuePath);
  const roots = normalizeEvidenceRoots({ evidenceRoot, evidenceRootsByIntake, requireZEvidenceRoots });
  for (const entry of verifiedQueue.entries) evidencePathsFor(entry, roots, 'complete');
  const entryBySha = new Map(verifiedQueue.entries.map((entry) => [entry.sha256, entry]));
  const sessions = new Map();
  const server = createServer(async (request, response) => {
    try {
      await routeRequest({ request, response, verifiedQueue, entryBySha, sessions, roots, reviewerName, now, heartbeatGapLimitMs });
    } catch (error) {
      sendJson(response, error.statusCode ?? 500, { error: error.message });
    }
  });
  await new Promise((accept, reject) => {
    server.once('error', reject);
    server.listen(port, host, accept);
  });
  const address = server.address();
  const url = `http://${host}:${address.port}/`;
  return {
    url,
    server,
    queue: verifiedQueue,
    close: () => new Promise((accept, reject) => server.close((error) => (error ? reject(error) : accept()))),
  };
}

async function routeRequest(context) {
  const { request, response, verifiedQueue, entryBySha, sessions, roots, reviewerName, now, heartbeatGapLimitMs } = context;
  const url = new URL(request.url, 'http://127.0.0.1');
  if (request.method === 'GET' && url.pathname === '/') {
    sendHtml(response, workbenchHtml());
    return;
  }
  if (request.method === 'GET' && url.pathname === '/api/queue') {
    sendJson(response, 200, {
      queueSha256: verifiedQueue.sha256,
      reviewer: reviewerName,
      entries: verifiedQueue.entries.map((entry) => ({
        sha256: entry.sha256,
        byteSize: entry.byteSize,
        decodedFrameCount: entry.decodedFrameCount,
        decodedDurationMs: entry.decodedDurationMs,
        decodedLoopCount: entry.decodedLoopCount,
        width: entry.width,
        height: entry.height,
        intakeIds: entry.intakeIds,
        label: entry.origins[0]?.sourceRelativePath ?? entry.sha256,
      })),
    });
    return;
  }
  const mediaMatch = url.pathname.match(/^\/media\/([a-f0-9]{64})\.gif$/u);
  if (request.method === 'GET' && mediaMatch) {
    const entry = entryBySha.get(mediaMatch[1]);
    if (!entry) throw httpError(404, 'Unknown GIF');
    const bytes = await readFile(entry.primaryOriginalPath);
    if (digest(bytes) !== entry.sha256 || bytes.length !== entry.byteSize) throw httpError(409, 'GIF changed after startup verification');
    response.writeHead(200, {
      'Content-Type': 'image/gif',
      'Content-Length': bytes.length,
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      Pragma: 'no-cache',
      'X-Content-Type-Options': 'nosniff',
    });
    response.end(bytes);
    return;
  }
  if (request.method === 'POST' && url.pathname === '/api/sessions') {
    const body = await readJsonBody(request);
    const entry = entryBySha.get(String(body.sha256 ?? '').toLowerCase());
    if (!entry) throw httpError(404, 'Unknown GIF');
    const token = randomBytes(24).toString('hex');
    const startedAtMs = now();
    sessions.set(token, {
      token, entry, createdAtMs: startedAtMs, playbackStartedAtMs: null, reviewer: reviewerName,
      events: [], invalidReasons: new Set(), lastClientElapsedMs: null, lastServerEventAtMs: null,
    });
    sendJson(response, 201, { token, mediaUrl: `/media/${entry.sha256}.gif?run=${randomBytes(12).toString('hex')}` });
    return;
  }
  const eventMatch = url.pathname.match(/^\/api\/sessions\/([a-f0-9]{48})\/events$/u);
  if (request.method === 'POST' && eventMatch) {
    const session = activeSession(sessions, eventMatch[1]);
    const body = await readJsonBody(request);
    recordSessionEvent(session, body, now(), heartbeatGapLimitMs);
    sendJson(response, 200, sessionSummary(session, now()));
    return;
  }
  const decisionMatch = url.pathname.match(/^\/api\/sessions\/([a-f0-9]{48})\/decision$/u);
  if (request.method === 'POST' && decisionMatch) {
    const session = activeSession(sessions, decisionMatch[1]);
    const body = await readJsonBody(request);
    const result = await finalizeDecision({ session, body, atMs: now(), roots, queueSha256: verifiedQueue.sha256, heartbeatGapLimitMs });
    sessions.delete(session.token);
    sendJson(response, 201, result);
    return;
  }
  throw httpError(404, 'Not found');
}

function recordSessionEvent(session, body, atMs, heartbeatGapLimitMs) {
  const type = String(body.type ?? '');
  if (!ALLOWED_EVENTS.has(type)) throw httpError(400, 'Unsupported session event');
  const clientElapsedMs = finiteNonnegative(body.clientElapsedMs, 'clientElapsedMs');
  if (session.lastClientElapsedMs !== null && clientElapsedMs < session.lastClientElapsedMs) {
    session.invalidReasons.add('client_elapsed_reversed');
  }
  if (session.lastServerEventAtMs !== null && atMs - session.lastServerEventAtMs > heartbeatGapLimitMs) {
    session.invalidReasons.add('heartbeat_gap_exceeded');
  }
  if (type === 'playback_started') {
    if (session.playbackStartedAtMs !== null) session.invalidReasons.add('playback_restarted');
    else session.playbackStartedAtMs = atMs;
  } else if (session.playbackStartedAtMs === null) {
    session.invalidReasons.add('event_before_playback_start');
  }
  if (INVALIDATING_EVENTS.has(type)) session.invalidReasons.add(type);
  session.events.push({
    sequence: session.events.length + 1,
    type,
    serverAt: new Date(atMs).toISOString(),
    elapsedSincePlaybackMs: session.playbackStartedAtMs === null ? null : Math.max(0, atMs - session.playbackStartedAtMs),
    clientElapsedMs,
    visible: body.visible === true,
    focused: body.focused === true,
    pageId: String(body.pageId ?? ''),
  });
  if (body.visible !== true) session.invalidReasons.add('client_not_visible');
  if (body.focused !== true) session.invalidReasons.add('client_not_focused');
  session.lastClientElapsedMs = clientElapsedMs;
  session.lastServerEventAtMs = atMs;
}

async function finalizeDecision({ session, body, atMs, roots, queueSha256, heartbeatGapLimitMs }) {
  const decision = String(body.decision ?? '');
  const note = String(body.note ?? '').trim();
  if (!['complete', 'needs_escalation'].includes(decision)) throw httpError(400, 'Decision must be complete or needs_escalation');
  if (!note) throw httpError(400, 'A review note is required');
  const clientElapsedMs = finiteNonnegative(body.clientElapsedMs, 'clientElapsedMs');
  const rootPaths = evidencePathsFor(session.entry, roots, decision);
  const completedAt = new Date(atMs).toISOString();
  if (decision === 'needs_escalation') {
    const document = {
      schema: 'munjanggun.gifPlaybackEscalation.v1', version: '1.0', sourceObjectSha256: session.entry.sha256,
      decision, reviewer: session.reviewer, reviewedAt: completedAt, note,
      decodedFrameCount: session.entry.decodedFrameCount, decodedDurationMs: session.entry.decodedDurationMs,
      queueSha256,
    };
    await writeDocumentsExclusively(rootPaths, document);
    return { decision, paths: rootPaths };
  }

  if (session.playbackStartedAtMs === null) session.invalidReasons.add('playback_not_started');
  const wallElapsedMs = session.playbackStartedAtMs === null ? 0 : atMs - session.playbackStartedAtMs;
  if (session.lastServerEventAtMs === null || atMs - session.lastServerEventAtMs > heartbeatGapLimitMs) {
    session.invalidReasons.add('heartbeat_gap_exceeded');
  }
  if (!session.events.some((event) => event.type === 'heartbeat')) session.invalidReasons.add('heartbeat_missing');
  if (wallElapsedMs < session.entry.decodedDurationMs || clientElapsedMs < session.entry.decodedDurationMs) {
    session.invalidReasons.add('elapsed_shorter_than_decoded_duration');
  }
  if (session.invalidReasons.size) {
    throw httpError(409, `Full playback completion rejected: ${[...session.invalidReasons].sort().join(', ')}`);
  }
  const eventLog = session.events;
  const eventDigest = digest(Buffer.from(canonicalJson(eventLog), 'utf8'));
  const counts = Object.fromEntries([...ALLOWED_EVENTS].map((type) => [type, eventLog.filter((event) => event.type === type).length]));
  const receipt = {
    schema: 'munjanggun.gifPlaybackObservation.v1', version: '1.0', observed: true,
    workbenchVersion: 'gif-playback-workbench-v1',
    sourceObjectSha256: session.entry.sha256,
    method: 'continuous_original_playback', observedFromMs: 0, observedToMs: session.entry.decodedDurationMs,
    decodedFrameCount: session.entry.decodedFrameCount, decodedDurationMs: session.entry.decodedDurationMs,
    decodedLoopCount: session.entry.decodedLoopCount,
    reviewer: session.reviewer,
    startedAt: new Date(session.playbackStartedAtMs).toISOString(),
    reviewedAt: completedAt,
    wallElapsedMs,
    clientElapsedMs,
    note,
    playbackRate: 1,
    cachePolicy: 'cache_busted_no_store',
    heartbeatGapLimitMs,
    eventCounts: counts,
    eventDigest,
    eventLog,
    queueSha256,
  };
  assertGifPlaybackWorkbenchReceipt(receipt, session.entry);
  await writeDocumentsExclusively(rootPaths, receipt);
  return { decision, paths: rootPaths, receiptSha256: digest(Buffer.from(`${JSON.stringify(receipt, null, 2)}\n`, 'utf8')) };
}

export function assertGifPlaybackWorkbenchReceipt(receipt, expected = {}) {
  if (receipt?.schema !== 'munjanggun.gifPlaybackObservation.v1' || receipt.version !== '1.0'
    || receipt.workbenchVersion !== 'gif-playback-workbench-v1' || receipt.observed !== true
    || receipt.method !== 'continuous_original_playback' || receipt.observedFromMs !== 0
    || receipt.observedToMs !== receipt.decodedDurationMs || receipt.playbackRate !== 1
    || receipt.cachePolicy !== 'cache_busted_no_store' || !SHA256.test(String(receipt.sourceObjectSha256 ?? ''))
    || !SHA256.test(String(receipt.queueSha256 ?? '')) || !SHA256.test(String(receipt.eventDigest ?? ''))) {
    throw new Error('GIF playback workbench receipt header is invalid');
  }
  if ((expected.sha256 && receipt.sourceObjectSha256 !== expected.sha256)
    || (expected.decodedFrameCount !== undefined && receipt.decodedFrameCount !== expected.decodedFrameCount)
    || (expected.decodedDurationMs !== undefined && receipt.decodedDurationMs !== expected.decodedDurationMs)
    || !Number.isInteger(receipt.decodedFrameCount) || receipt.decodedFrameCount < 1
    || !Number.isInteger(receipt.decodedDurationMs) || receipt.decodedDurationMs < 0
    || !Number.isFinite(receipt.wallElapsedMs) || receipt.wallElapsedMs < receipt.decodedDurationMs
    || !Number.isFinite(receipt.clientElapsedMs) || receipt.clientElapsedMs < receipt.decodedDurationMs
    || !Number.isFinite(receipt.heartbeatGapLimitMs) || receipt.heartbeatGapLimitMs < 250
    || !String(receipt.reviewer ?? '').trim() || !String(receipt.note ?? '').trim()) {
    throw new Error('GIF playback workbench receipt facts are invalid');
  }
  const events = receipt.eventLog;
  if (!Array.isArray(events) || !events.length || digest(Buffer.from(canonicalJson(events), 'utf8')) !== receipt.eventDigest) {
    throw new Error('GIF playback workbench event digest is invalid');
  }
  const counts = Object.fromEntries([...ALLOWED_EVENTS].map((type) => [type, events.filter((event) => event.type === type).length]));
  if (canonicalJson(counts) !== canonicalJson(receipt.eventCounts) || counts.playback_started !== 1 || counts.heartbeat < 1
    || [...INVALIDATING_EVENTS].some((type) => counts[type] > 0)) {
    throw new Error('GIF playback workbench event counts are invalid');
  }
  const startedAtMs = Date.parse(receipt.startedAt);
  const reviewedAtMs = Date.parse(receipt.reviewedAt);
  if (!Number.isFinite(startedAtMs) || !Number.isFinite(reviewedAtMs) || reviewedAtMs - startedAtMs !== receipt.wallElapsedMs) {
    throw new Error('GIF playback workbench chronology is invalid');
  }
  let priorServerAtMs = startedAtMs;
  let priorClientElapsedMs = 0;
  let pageId = null;
  for (let index = 0; index < events.length; index += 1) {
    const event = events[index];
    const serverAtMs = Date.parse(event.serverAt);
    if (event.sequence !== index + 1 || !ALLOWED_EVENTS.has(event.type) || !Number.isFinite(serverAtMs)
      || serverAtMs < startedAtMs || serverAtMs > reviewedAtMs || event.visible !== true || event.focused !== true
      || event.elapsedSincePlaybackMs !== serverAtMs - startedAtMs
      || !Number.isFinite(event.clientElapsedMs) || event.clientElapsedMs < 0
      || serverAtMs < priorServerAtMs || serverAtMs - priorServerAtMs > receipt.heartbeatGapLimitMs
      || event.clientElapsedMs < priorClientElapsedMs
      || !String(event.pageId ?? '').trim()
      || (pageId !== null && event.pageId !== pageId)) {
      throw new Error('GIF playback workbench event log is invalid');
    }
    if (index === 0 && (event.type !== 'playback_started' || serverAtMs !== startedAtMs)) {
      throw new Error('GIF playback workbench event log is invalid');
    }
    pageId = event.pageId;
    priorServerAtMs = serverAtMs;
    priorClientElapsedMs = event.clientElapsedMs;
  }
  const lastEventAtMs = Date.parse(events.at(-1).serverAt);
  if (reviewedAtMs - lastEventAtMs > receipt.heartbeatGapLimitMs) throw new Error('GIF playback workbench final heartbeat gap is invalid');
  return true;
}

function evidencePathsFor(entry, roots, decision) {
  const directory = decision === 'complete' ? 'gif-playback-observations' : 'gif-playback-escalations';
  const selected = [];
  for (const intakeId of entry.intakeIds) {
    const root = roots.byIntake.get(intakeId) ?? roots.defaultRoot;
    if (!root) throw httpError(409, `No evidence root is registered for ${intakeId}`);
    selected.push(resolve(root, directory, `${entry.sha256}.json`));
  }
  if (!selected.length && roots.defaultRoot) selected.push(resolve(roots.defaultRoot, directory, `${entry.sha256}.json`));
  return [...new Set(selected)];
}

export async function writeJsonExclusiveAtomic(pathValue, value) {
  const path = resolve(pathValue);
  await mkdir(dirname(path), { recursive: true });
  const bytes = Buffer.from(`${JSON.stringify(value, null, 2)}\n`, 'utf8');
  const tempPath = `${path}.partial-${process.pid}-${randomBytes(8).toString('hex')}`;
  let tempCreated = false;
  try {
    const handle = await open(tempPath, fsConstants.O_CREAT | fsConstants.O_EXCL | fsConstants.O_WRONLY);
    tempCreated = true;
    try {
      await handle.writeFile(bytes);
      await handle.sync();
    } finally {
      await handle.close();
    }
    await link(tempPath, path);
    await unlink(tempPath);
    tempCreated = false;
  } catch (error) {
    if (tempCreated) await unlink(tempPath).catch(() => {});
    if (error.code === 'EEXIST') throw httpError(409, `Evidence already exists and will not be overwritten: ${path}`);
    throw error;
  }
  return { path, sha256: digest(bytes) };
}

async function writeDocumentsExclusively(paths, value) {
  const written = [];
  try {
    for (const path of paths) written.push(await writeJsonExclusiveAtomic(path, value));
  } catch (error) {
    for (const item of written) await unlink(item.path).catch(() => {});
    throw error;
  }
  return written.map((item) => item.path);
}

function normalizeEvidenceRoots({ evidenceRoot, evidenceRootsByIntake, requireZEvidenceRoots }) {
  const normalizeRoot = (value) => {
    const original = String(value ?? '');
    if (!isAbsolute(original)) throw new Error('Evidence root must be absolute');
    const root = resolve(original);
    if (requireZEvidenceRoots && !/^Z:\\/iu.test(root)) throw new Error(`Operational evidence root must be on Z: ${root}`);
    return root;
  };
  const defaultRoot = evidenceRoot ? normalizeRoot(evidenceRoot) : null;
  const byIntake = new Map(Object.entries(evidenceRootsByIntake ?? {}).map(([intakeId, root]) => [intakeId, normalizeRoot(root)]));
  if (!defaultRoot && byIntake.size === 0) throw new Error('At least one evidence root is required');
  return { defaultRoot, byIntake };
}

function activeSession(sessions, token) {
  const session = sessions.get(token);
  if (!session) throw httpError(404, 'Unknown or completed session');
  return session;
}

function sessionSummary(session, atMs) {
  return {
    sha256: session.entry.sha256,
    playbackStarted: session.playbackStartedAtMs !== null,
    wallElapsedMs: session.playbackStartedAtMs === null ? 0 : Math.max(0, atMs - session.playbackStartedAtMs),
    decodedDurationMs: session.entry.decodedDurationMs,
    invalidReasons: [...session.invalidReasons].sort(),
  };
}

async function readJsonBody(request) {
  const chunks = [];
  let length = 0;
  for await (const chunk of request) {
    length += chunk.length;
    if (length > 64 * 1024) throw httpError(413, 'Request body is too large');
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
  } catch {
    throw httpError(400, 'Request body must be JSON');
  }
}

function sendJson(response, status, value) {
  const bytes = Buffer.from(`${JSON.stringify(value)}\n`, 'utf8');
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': bytes.length,
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  response.end(bytes);
}

function sendHtml(response, html) {
  const bytes = Buffer.from(html, 'utf8');
  response.writeHead(200, {
    'Content-Type': 'text/html; charset=utf-8',
    'Content-Length': bytes.length,
    'Cache-Control': 'no-store',
    'Content-Security-Policy': "default-src 'self'; img-src 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'",
    'X-Content-Type-Options': 'nosniff',
  });
  response.end(bytes);
}

function httpError(statusCode, message) {
  return Object.assign(new Error(message), { statusCode });
}

function finiteNonnegative(value, label) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) throw httpError(400, `${label} must be a nonnegative number`);
  return number;
}

function uniqueStrings(values = []) {
  return [...new Set(values.map((value) => String(value ?? '').trim()).filter(Boolean))].sort();
}

function digest(value) {
  return createHash('sha256').update(value).digest('hex');
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}

function workbenchHtml() {
  return `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>GIF 전체 한 주기 검토</title><style>
body{font-family:system-ui,sans-serif;margin:0;background:#f4f4f0;color:#182018}main{max-width:1100px;margin:auto;padding:24px}
.warning{background:#fff4cc;border:2px solid #d68a00;padding:14px;font-weight:700}.grid{display:grid;grid-template-columns:280px 1fr;gap:20px;margin-top:18px}
select,textarea,button{font:inherit;width:100%;box-sizing:border-box;margin:6px 0;padding:10px}img{display:block;max-width:100%;max-height:65vh;margin:auto;background:#ddd}
.status{white-space:pre-wrap;background:#17221b;color:#eff8ef;padding:12px;min-height:72px}.actions{display:grid;grid-template-columns:1fr 1fr;gap:10px}
</style></head><body><main>
<h1>GIF 전체 한 주기 검토</h1>
<div class="warning">표본 프레임이나 스토리보드를 봤다고 전체 재생 완료로 판정하지 마세요. 이 화면에서 0ms부터 반복 경계까지 자연 속도로 연속 재생한 경우만 complete가 가능합니다.</div>
<div class="grid"><section><label>GIF 선택<select id="items"></select></label><button id="start">0ms부터 검토 시작</button><div id="facts"></div>
<label>판독 메모<textarea id="note" rows="7" placeholder="어떤 동작·문구·순서를 확인했는지, 또는 상향 사유"></textarea></label>
<div class="actions"><button id="complete" disabled>complete</button><button id="escalate" disabled>needs_escalation</button></div></section>
<section><img id="media" alt="검토 대상 GIF"><div class="status" id="status">아직 시작하지 않음</div></section></div>
</main><script>
let queue=[],active=null,timer=null,pageId=crypto.randomUUID(),eventChain=Promise.resolve();
const q=(id)=>document.getElementById(id), post=(url,body)=>fetch(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}).then(async r=>{const j=await r.json();if(!r.ok)throw Error(j.error);return j});
const observation=()=>({clientElapsedMs:active?performance.now()-active.clientStart:0,visible:!document.hidden,focused:document.hasFocus(),pageId});
function event(type){if(!active)return Promise.resolve();const token=active.token,body={type,...observation()};eventChain=eventChain.then(()=>post('/api/sessions/'+token+'/events',body)).then(render).catch(e=>{q('status').textContent=e.message});return eventChain}
function render(s){q('status').textContent='elapsed '+Math.floor(s.wallElapsedMs)+' / '+s.decodedDurationMs+'ms\\n'+(s.invalidReasons.length?'무효 사유: '+s.invalidReasons.join(', '):'창을 유지하고 한 주기를 계속 관찰하세요.')}
fetch('/api/queue').then(r=>r.json()).then(data=>{queue=data.entries;queue.forEach(e=>q('items').add(new Option(e.label,e.sha256)));showFacts()});
const interruptedToken=localStorage.getItem('gifWorkbenchActive');if(interruptedToken){localStorage.removeItem('gifWorkbenchActive');fetch('/api/sessions/'+interruptedToken+'/events',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({type:'reload',clientElapsedMs:0,visible:!document.hidden,focused:document.hasFocus(),pageId})}).catch(()=>{})}
q('items').onchange=showFacts;function showFacts(){const e=queue.find(x=>x.sha256===q('items').value);if(e)q('facts').textContent=e.decodedFrameCount+' frames / '+e.decodedDurationMs+'ms'}
q('start').onclick=async()=>{if(active)await event('seek');const data=await post('/api/sessions',{sha256:q('items').value});active={...data,clientStart:performance.now()};localStorage.setItem('gifWorkbenchActive',active.token);q('media').src=data.mediaUrl;q('complete').disabled=false;q('escalate').disabled=false};
q('media').onload=()=>{if(active){active.clientStart=performance.now();event('playback_started');clearInterval(timer);timer=setInterval(()=>event('heartbeat'),250)}};
q('media').onerror=()=>event('media_error');
document.addEventListener('visibilitychange',()=>event(document.hidden?'visibility_hidden':'visibility_visible'));window.addEventListener('blur',()=>event('blur'));
window.addEventListener('beforeunload',()=>{if(active)navigator.sendBeacon('/api/sessions/'+active.token+'/events',new Blob([JSON.stringify({type:'reload',...observation()})],{type:'application/json'}))});
async function decide(decision){try{await eventChain;const result=await post('/api/sessions/'+active.token+'/decision',{decision,note:q('note').value,...observation()});clearInterval(timer);timer=null;active=null;localStorage.removeItem('gifWorkbenchActive');q('media').removeAttribute('src');q('complete').disabled=true;q('escalate').disabled=true;q('status').textContent=decision+' 기록 완료\\n'+result.paths.join('\\n')}catch(e){q('status').textContent=e.message}}
q('complete').onclick=()=>decide('complete');q('escalate').onclick=()=>decide('needs_escalation');
</script></body></html>`;
}
