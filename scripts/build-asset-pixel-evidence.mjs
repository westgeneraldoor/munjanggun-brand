#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { lstat, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { once } from 'node:events';
import { decodeGifFrameImages, GIF_PIXEL_DECODER_VERSION } from './lib/gif-frame-pixels.mjs';
import { encodeRgbaPng } from './lib/static-image-region-pixels.mjs';
import { parseStrictArgs, required } from './lib/strict-cli-args.mjs';

const REPO_ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const OCR_SCRIPT = resolve(REPO_ROOT, 'scripts/windows-ocr-observe.ps1');

export async function buildAssetPixelEvidenceWorkset({
  draftReportPath,
  outputRoot,
  resume = false,
  generatedAt = new Date().toISOString(),
  powershellPath = resolve(process.env.WINDIR ?? 'C:/Windows', 'System32/WindowsPowerShell/v1.0/powershell.exe'),
} = {}) {
  const reportPath = requireAbsoluteFilePath(draftReportPath, 'Draft report');
  const destination = requirePrivateOutput(outputRoot);
  if (!resume) await assertMissing(destination);
  const reportBytes = await readFile(reportPath);
  const report = JSON.parse(reportBytes.toString('utf8'));
  if (report?.schema !== 'munjanggun.assetContentReviewDraftSet.v1' || !Array.isArray(report.documentFiles)) {
    throw new Error('Draft report contract is invalid');
  }

  const documents = await Promise.all(report.documentFiles.map(async (item) => {
    const path = requireAbsoluteFilePath(item.path, 'Draft document');
    const bytes = await readFile(path);
    if (digest(bytes) !== item.sha256) throw new Error(`Draft document SHA-256 mismatch: ${path}`);
    const value = JSON.parse(bytes.toString('utf8'));
    return { path, sha256: item.sha256, value };
  }));
  const assets = new Map();
  for (const document of documents) {
    for (const entry of document.value.entries ?? []) {
      const prior = assets.get(entry.sha256);
      if (prior) {
        prior.intakeIds.add(document.value.intakeId);
        prior.sourceRefs.push(...entry.sourceRefs);
        continue;
      }
      assets.set(entry.sha256, {
        sha256: entry.sha256,
        mediaKind: document.value.mediaKind,
        originalPath: resolve(entry.reviewEvidence.originalPath),
        textPresence: entry.textPresence,
        visibleText: entry.visibleText,
        intakeIds: new Set([document.value.intakeId]),
        sourceRefs: [...entry.sourceRefs],
        reviewHistory: entry.reviewHistory ?? null,
        staticTileCoverage: entry.staticTileCoverage ?? null,
      });
    }
  }
  if (assets.size !== report.coverage?.queueUniqueAssets) {
    throw new Error(`Workset unique asset count mismatch: ${assets.size}`);
  }

  await mkdir(destination, { recursive: true });
  const ocrInputs = [];
  const records = [];
  for (const asset of assets.values()) {
    const originalBytes = await readFile(asset.originalPath);
    if (digest(originalBytes) !== asset.sha256) throw new Error(`Original SHA-256 mismatch: ${asset.sha256}`);
    const baseRecord = {
      sourceObjectSha256: asset.sha256,
      mediaKind: asset.mediaKind,
      originalPath: asset.originalPath,
      intakeIds: [...asset.intakeIds].sort(),
      sourceRefs: uniqueSourceRefs(asset.sourceRefs),
      textPresence: asset.textPresence,
      visibleText: asset.visibleText,
      ocrInputs: [],
    };
    if (asset.mediaKind === 'static') {
      if (asset.textPresence !== 'none_observed') {
        const manifestPath = resolve(asset.staticTileCoverage?.manifestRef ?? '');
        const manifestBytes = await readFile(manifestPath);
        if (digest(manifestBytes) !== asset.staticTileCoverage?.manifestSha256) {
          throw new Error(`Static tile manifest SHA-256 mismatch: ${asset.sha256}`);
        }
        const manifest = JSON.parse(manifestBytes.toString('utf8'));
        if (manifest.sourceObjectSha256 !== asset.sha256 || !Array.isArray(manifest.tiles) || manifest.tiles.length === 0) {
          throw new Error(`Static tile manifest binding mismatch: ${asset.sha256}`);
        }
        for (const tile of manifest.tiles) {
          const tilePath = resolve(tile.path);
          const tileBytes = await readFile(tilePath);
          if (digest(tileBytes) !== tile.sha256) throw new Error(`Static tile SHA-256 mismatch: ${tilePath}`);
          baseRecord.ocrInputs.push({
            kind: 'static_tile',
            path: tilePath,
            sha256: tile.sha256,
            pixelSha256: tile.pixelSha256,
            pixelRegion: tile.pixelRegion,
            sourceWidth: manifest.sourceWidth,
            sourceHeight: manifest.sourceHeight,
          });
          ocrInputs.push(tilePath);
        }
      }
    } else {
      const selected = asset.reviewHistory?.sampledSemanticReview?.selectedFrameIndices;
      if (!Array.isArray(selected) || selected.length === 0) throw new Error(`GIF sampled frame indices are missing: ${asset.sha256}`);
      const decoded = decodeGifFrameImages(originalBytes, selected);
      if (decoded.frames.size !== selected.length) throw new Error(`GIF sampled frame decode mismatch: ${asset.sha256}`);
      const frameRoot = resolve(destination, 'gif-sample-frames', asset.sha256.slice(0, 2), asset.sha256);
      await mkdir(frameRoot, { recursive: true });
      for (const frameIndex of selected) {
        const frame = decoded.frames.get(frameIndex);
        const framePath = resolve(frameRoot, `frame-${String(frameIndex).padStart(6, '0')}.png`);
        const frameBytes = encodeRgbaPng(frame);
        if (resume && await pathExists(framePath)) {
          const existing = await readFile(framePath);
          if (!existing.equals(frameBytes)) throw new Error(`Existing GIF sample frame mismatch: ${framePath}`);
        } else {
          await writeFile(framePath, frameBytes, { flag: 'wx' });
        }
        const frameRecord = {
          kind: 'gif_sample_frame',
          frameIndex,
          path: framePath,
          sha256: digest(frameBytes),
          pixelSha256: frame.pixelSha256,
          width: frame.width,
          height: frame.height,
          decoderVersion: GIF_PIXEL_DECODER_VERSION,
        };
        baseRecord.ocrInputs.push(frameRecord);
        ocrInputs.push(framePath);
      }
    }
    records.push(baseRecord);
  }

  const listPath = resolve(destination, 'ocr-inputs.txt');
  await writeFile(listPath, `\ufeff${ocrInputs.join('\r\n')}\r\n`, { encoding: 'utf8', flag: resume ? 'w' : 'wx' });
  const ocrPath = resolve(destination, 'ocr-observations.ndjson');
  const ocrResult = await runWindowsOcr({ powershellPath, inputListPath: listPath, outputPath: ocrPath, overwrite: resume });
  if (ocrResult.lineCount !== ocrInputs.length) {
    throw new Error(`OCR result count mismatch: ${ocrResult.lineCount} of ${ocrInputs.length}`);
  }
  const workset = {
    schema: 'munjanggun.assetPixelEvidenceWorkset.v1',
    version: '1.0',
    status: 'ocr_observed_non_authority',
    generatedAt: new Date(generatedAt).toISOString(),
    sourceDraftReport: { path: reportPath, sha256: digest(reportBytes) },
    uniqueAssetCount: records.length,
    staticAssetCount: records.filter((item) => item.mediaKind === 'static').length,
    gifAssetCount: records.filter((item) => item.mediaKind === 'gif').length,
    ocrInputCount: ocrInputs.length,
    ocrObservationFile: { path: ocrPath, sha256: digest(await readFile(ocrPath)), lineCount: ocrResult.lineCount },
    records,
    guard: 'OCR coordinates are machine observations only. They do not authorize visible text, search tags, claims, privacy, publication, or library promotion without independent evidence binding.',
  };
  const worksetPath = resolve(destination, 'workset.json');
  const worksetBytes = jsonBytes(workset);
  await writeFile(worksetPath, worksetBytes, { flag: 'wx' });
  return {
    outputRoot: destination,
    worksetPath,
    worksetSha256: digest(worksetBytes),
    uniqueAssetCount: records.length,
    ocrInputCount: ocrInputs.length,
    ocrObservationCount: ocrResult.lineCount,
  };
}

export async function runWindowsOcr({ powershellPath, inputListPath, outputPath, overwrite = false }) {
  const child = spawn(powershellPath, [
    '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', OCR_SCRIPT, '-InputListPath', inputListPath,
  ], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  const output = createWriteStream(outputPath, { flags: overwrite ? 'w' : 'wx', encoding: 'utf8' });
  let stderr = '';
  let lineCount = 0;
  let carry = '';
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', (chunk) => { stderr += chunk; });
  child.stdout.setEncoding('utf8');
  child.stdout.on('data', (chunk) => {
    const combined = carry + chunk;
    const lines = combined.split(/\r?\n/u);
    carry = lines.pop() ?? '';
    for (const line of lines) {
      if (!line.trim()) continue;
      JSON.parse(line);
      output.write(`${line}\n`);
      lineCount += 1;
    }
  });
  const [exitCode] = await once(child, 'close');
  if (carry.trim()) {
    JSON.parse(carry);
    output.write(`${carry}\n`);
    lineCount += 1;
  }
  output.end();
  await once(output, 'close');
  if (exitCode !== 0) throw new Error(`Windows OCR failed (${exitCode}): ${stderr.trim()}`);
  return { lineCount };
}

function uniqueSourceRefs(values) {
  const seen = new Set();
  return values.filter((entry) => {
    const key = `${entry.sourceId}\0${entry.sourceRelativePath}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function requirePrivateOutput(value) {
  if (!isAbsolute(value ?? '')) throw new Error('Output root must be absolute');
  const destination = resolve(value);
  const relation = relative(REPO_ROOT, destination);
  if (relation === '' || (!relation.startsWith('..') && !isAbsolute(relation))) {
    throw new Error('Output root must be outside the public repository');
  }
  return destination;
}

function requireAbsoluteFilePath(value, label) {
  if (!isAbsolute(value ?? '')) throw new Error(`${label} path must be absolute`);
  return resolve(value);
}

async function assertMissing(path) {
  try {
    await lstat(path);
    throw new Error(`Output root already exists: ${path}`);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

async function pathExists(path) {
  try {
    await lstat(path);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}

function digest(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function jsonBytes(value) {
  return Buffer.from(`${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

export async function runBuildAssetPixelEvidence(argv) {
  const args = parseStrictArgs(argv, { valueFlags: ['--draft-report', '--output-root'], booleanFlags: ['--resume'] });
  const result = await buildAssetPixelEvidenceWorkset({
    draftReportPath: required(args, '--draft-report'),
    outputRoot: required(args, '--output-root'),
    resume: args.has('--resume'),
  });
  console.log(JSON.stringify(result, null, 2));
  return result;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await runBuildAssetPixelEvidence(process.argv.slice(2));
}
