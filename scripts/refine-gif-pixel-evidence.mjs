#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodeGifFrameImages, GIF_PIXEL_DECODER_VERSION } from './lib/gif-frame-pixels.mjs';
import { encodeRgbaPng } from './lib/static-image-region-pixels.mjs';
import { runWindowsOcr } from './build-asset-pixel-evidence.mjs';
import { parseStrictArgs, required } from './lib/strict-cli-args.mjs';

const REPO_ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));

export async function refineGifPixelEvidence({ worksetPath, analysisPath, outputRoot, generatedAt = new Date().toISOString(), powershellPath = resolve(process.env.WINDIR ?? 'C:/Windows', 'System32/WindowsPowerShell/v1.0/powershell.exe') } = {}) {
  const worksetFile = requireAbsolute(worksetPath, 'Workset');
  const analysisFile = requireAbsolute(analysisPath, 'Analysis');
  const destination = requirePrivateOutput(outputRoot);
  const [worksetBytes, analysisBytes] = await Promise.all([readFile(worksetFile), readFile(analysisFile)]);
  const workset = JSON.parse(worksetBytes.toString('utf8'));
  const analysis = JSON.parse(analysisBytes.toString('utf8'));
  if (workset?.schema !== 'munjanggun.assetPixelEvidenceWorkset.v1' || !Array.isArray(workset.records)) throw new Error('Workset contract is invalid');
  if (analysis?.schema !== 'munjanggun.assetPixelEvidenceAnalysis.v1' || !Array.isArray(analysis.assets)
    || resolve(analysis.workset?.path ?? '') !== worksetFile || analysis.workset?.sha256 !== digest(worksetBytes)) {
    throw new Error('Analysis is not bound to the selected workset');
  }
  const analysisBySha = new Map(analysis.assets.map((asset) => [asset.sourceObjectSha256, asset]));
  await mkdir(destination, { recursive: false });
  const supplementalPaths = [];
  const refinedRecords = [];
  for (const sourceRecord of workset.records) {
    const record = structuredClone(sourceRecord);
    const asset = analysisBySha.get(record.sourceObjectSha256);
    if (record.mediaKind !== 'gif' || !asset?.textMatches?.some((item) => ['weak', 'unmatched'].includes(item.status))) {
      refinedRecords.push(record);
      continue;
    }
    const existing = [...new Set(record.ocrInputs.map((item) => item.frameIndex).filter(Number.isInteger))].sort((a, b) => a - b);
    const supplemental = midpointIndices(existing);
    if (!supplemental.length) {
      refinedRecords.push(record);
      continue;
    }
    const originalBytes = await readFile(record.originalPath);
    if (digest(originalBytes) !== record.sourceObjectSha256) throw new Error(`Original GIF SHA-256 mismatch: ${record.sourceObjectSha256}`);
    const decoded = decodeGifFrameImages(originalBytes, supplemental);
    const frameRoot = resolve(destination, 'gif-supplemental-frames', record.sourceObjectSha256.slice(0, 2), record.sourceObjectSha256);
    await mkdir(frameRoot, { recursive: true });
    for (const frameIndex of supplemental) {
      const frame = decoded.frames.get(frameIndex);
      if (!frame) throw new Error(`Supplemental GIF frame is missing: ${record.sourceObjectSha256}:${frameIndex}`);
      const bytes = encodeRgbaPng(frame);
      const path = resolve(frameRoot, `frame-${String(frameIndex).padStart(6, '0')}.png`);
      await writeFile(path, bytes, { flag: 'wx' });
      record.ocrInputs.push({
        kind: 'gif_supplemental_frame', frameIndex, path, sha256: digest(bytes), pixelSha256: frame.pixelSha256,
        width: frame.width, height: frame.height, decoderVersion: GIF_PIXEL_DECODER_VERSION,
      });
      supplementalPaths.push(path);
    }
    refinedRecords.push(record);
  }
  const listPath = resolve(destination, 'supplemental-ocr-inputs.txt');
  await writeFile(listPath, `\ufeff${supplementalPaths.join('\r\n')}\r\n`, { encoding: 'utf8', flag: 'wx' });
  const supplementalOcrPath = resolve(destination, 'supplemental-ocr-observations.ndjson');
  const ocrResult = await runWindowsOcr({ powershellPath, inputListPath: listPath, outputPath: supplementalOcrPath });
  if (ocrResult.lineCount !== supplementalPaths.length) throw new Error('Supplemental OCR count mismatch');
  const [priorOcrBytes, supplementalOcrBytes] = await Promise.all([
    readFile(workset.ocrObservationFile.path), readFile(supplementalOcrPath),
  ]);
  if (digest(priorOcrBytes) !== workset.ocrObservationFile.sha256) throw new Error('Prior OCR observation SHA-256 mismatch');
  const combinedOcrBytes = Buffer.concat([priorOcrBytes, supplementalOcrBytes]);
  const combinedOcrPath = resolve(destination, 'ocr-observations.ndjson');
  await writeFile(combinedOcrPath, combinedOcrBytes, { flag: 'wx' });
  const refined = {
    ...workset,
    generatedAt: new Date(generatedAt).toISOString(),
    ocrInputCount: workset.ocrInputCount + supplementalPaths.length,
    ocrObservationFile: { path: combinedOcrPath, sha256: digest(combinedOcrBytes), lineCount: workset.ocrObservationFile.lineCount + ocrResult.lineCount },
    records: refinedRecords,
    refinement: {
      method: 'midpoint_frames_between_signed_sample_indices_v1',
      sourceWorkset: { path: worksetFile, sha256: digest(worksetBytes) },
      sourceAnalysis: { path: analysisFile, sha256: digest(analysisBytes) },
      supplementalFrameCount: supplementalPaths.length,
      authority: 'machine_observation_non_authority',
    },
  };
  const refinedBytes = jsonBytes(refined);
  const refinedPath = resolve(destination, 'workset.json');
  await writeFile(refinedPath, refinedBytes, { flag: 'wx' });
  return { outputRoot: destination, worksetPath: refinedPath, worksetSha256: digest(refinedBytes), supplementalFrameCount: supplementalPaths.length, ocrInputCount: refined.ocrInputCount };
}

export function midpointIndices(indices) {
  const result = [];
  for (let index = 1; index < indices.length; index += 1) {
    const left = indices[index - 1];
    const right = indices[index];
    if (right - left > 1) result.push(Math.floor((left + right) / 2));
  }
  return [...new Set(result)].filter((value) => !indices.includes(value));
}

function requireAbsolute(value, label) { if (!isAbsolute(value ?? '')) throw new Error(`${label} path must be absolute`); return resolve(value); }
function requirePrivateOutput(value) {
  const destination = requireAbsolute(value, 'Output root');
  const relation = relative(REPO_ROOT, destination);
  if (relation === '' || (!relation.startsWith('..') && !isAbsolute(relation))) throw new Error('Output root must be outside the public repository');
  return destination;
}
function digest(bytes) { return createHash('sha256').update(bytes).digest('hex'); }
function jsonBytes(value) { return Buffer.from(`${JSON.stringify(value, null, 2)}\n`, 'utf8'); }

export async function runRefineGifPixelEvidence(argv) {
  const args = parseStrictArgs(argv, { valueFlags: ['--workset', '--analysis', '--output-root'] });
  const result = await refineGifPixelEvidence({ worksetPath: required(args, '--workset'), analysisPath: required(args, '--analysis'), outputRoot: required(args, '--output-root') });
  console.log(JSON.stringify(result, null, 2));
  return result;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await runRefineGifPixelEvidence(process.argv.slice(2));
