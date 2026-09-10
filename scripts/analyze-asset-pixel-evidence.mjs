#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseStrictArgs, required } from './lib/strict-cli-args.mjs';

export async function analyzeAssetPixelEvidence({ worksetPath, outputPath } = {}) {
  const worksetFile = requireAbsolute(worksetPath, 'Workset');
  const destination = requireAbsolute(outputPath, 'Output');
  const worksetBytes = await readFile(worksetFile);
  const workset = JSON.parse(worksetBytes.toString('utf8'));
  if (workset?.schema !== 'munjanggun.assetPixelEvidenceWorkset.v1' || !Array.isArray(workset.records)) {
    throw new Error('Pixel evidence workset contract is invalid');
  }
  const ocrBytes = await readFile(workset.ocrObservationFile.path);
  if (digest(ocrBytes) !== workset.ocrObservationFile.sha256) throw new Error('OCR observation SHA-256 mismatch');
  const observations = ocrBytes.toString('utf8').split(/\r?\n/u).filter(Boolean).map((line) => decodeObservation(JSON.parse(line)));
  if (observations.length !== workset.ocrObservationFile.lineCount) throw new Error('OCR observation count mismatch');
  const byPath = new Map(observations.map((item) => [pathKey(item.sourcePath), item]));
  const assets = workset.records.map((record) => analyzeAsset(record, byPath));
  const matches = assets.flatMap((asset) => asset.textMatches);
  const statusCounts = countBy(matches, (item) => item.status);
  const analysis = {
    schema: 'munjanggun.assetPixelEvidenceAnalysis.v1',
    version: '1.0',
    status: 'machine_match_non_authority',
    generatedAt: new Date().toISOString(),
    workset: { path: worksetFile, sha256: digest(worksetBytes) },
    coverage: {
      uniqueAssetCount: assets.length,
      staticAssetCount: assets.filter((item) => item.mediaKind === 'static').length,
      gifAssetCount: assets.filter((item) => item.mediaKind === 'gif').length,
      atomicVisibleTextCount: matches.length,
      exactMatchCount: statusCounts.exact ?? 0,
      strongMatchCount: statusCounts.strong ?? 0,
      weakMatchCount: statusCounts.weak ?? 0,
      criticalMismatchCount: statusCounts.critical_mismatch ?? 0,
      unmatchedCount: statusCounts.unmatched ?? 0,
      fullyMatchedAssetCount: assets.filter((item) => item.matchStatus === 'fully_machine_matched').length,
      reviewRequiredAssetCount: assets.filter((item) => item.matchStatus === 'review_required').length,
      noTextAssetCount: assets.filter((item) => item.matchStatus === 'no_text').length,
      uncertainTextAssetCount: assets.filter((item) => item.textPresence === 'uncertain').length,
    },
    assets,
    guard: 'Machine OCR matches propose pixel regions only. Weak or unmatched text and every uncertainty require direct evidence review before authority signing or library promotion.',
  };
  const bytes = jsonBytes(analysis);
  await writeFile(destination, bytes, { flag: 'wx' });
  return { outputPath: destination, sha256: digest(bytes), ...analysis.coverage };
}

function analyzeAsset(record, byPath) {
  const atomicText = record.mediaKind === 'gif'
    ? orderedUnique(record.visibleText.flatMap((value) => String(value).split(/\r?\n/u).map((part) => part.trim()).filter(Boolean)))
    : record.visibleText;
  if (record.textPresence === 'none_observed') {
    return { sourceObjectSha256: record.sourceObjectSha256, mediaKind: record.mediaKind, textPresence: record.textPresence, matchStatus: 'no_text', textMatches: [] };
  }
  const candidates = record.ocrInputs.map((input) => {
    const observation = byPath.get(pathKey(input.path));
    if (!observation) throw new Error(`OCR observation is missing: ${input.path}`);
    return { input, lines: transformLines(input, observation) };
  });
  const textMatches = atomicText.map((text) => bestTextMatch(text, candidates));
  const fullyMatched = record.textPresence === 'observed' && textMatches.length > 0
    && textMatches.every((item) => item.status === 'exact' || item.status === 'strong');
  return {
    sourceObjectSha256: record.sourceObjectSha256,
    mediaKind: record.mediaKind,
    textPresence: record.textPresence,
    atomicVisibleText: atomicText,
    matchStatus: fullyMatched ? 'fully_machine_matched' : 'review_required',
    textMatches,
  };
}

function bestTextMatch(text, candidates) {
  const target = normalizeText(text);
  let best = null;
  for (const candidate of candidates) {
    const lines = candidate.lines;
    for (let start = 0; start < lines.length; start += 1) {
      for (let length = 1; length <= Math.min(10, lines.length - start); length += 1) {
        const window = lines.slice(start, start + length);
        const recognized = window.map((line) => line.text).join(' ');
        const classified = classifyTextMatch(text, recognized);
        const score = classified.score;
        if (!best || isBetterCandidate(classified, best)) {
          best = {
            score,
            status: classified.status,
            criticalCompatible: classified.criticalCompatible,
            normalizedCandidate: classified.normalizedCandidate,
            recognizedText: recognized,
            sourcePath: candidate.input.path,
            frameIndex: candidate.input.frameIndex,
            region: unionRegions(window.map((line) => line.region)),
            ocrLineStart: start,
            ocrLineCount: length,
          };
        }
      }
    }
  }
  const score = best?.score ?? 0;
  const classified = best ? classifyTextMatch(text, best.recognizedText) : { status: 'unmatched', criticalTokens: criticalTokens(text), candidateCriticalTokens: [] };
  return {
    text,
    status: classified.status,
    score: Number(score.toFixed(4)),
    criticalTokens: classified.criticalTokens,
    candidateCriticalTokens: classified.candidateCriticalTokens,
    ...(best ?? {}),
  };
}

export function classifyTextMatch(targetText, candidateText) {
  const target = normalizeText(targetText);
  const candidate = normalizeText(candidateText);
  const score = matchScore(target, candidate);
  const targetCritical = criticalTokens(targetText);
  const candidateCritical = criticalTokens(candidateText);
  const criticalCompatible = targetCritical.length === 0 || sameStringSet(targetCritical, candidateCritical);
  const criticalMismatch = !criticalCompatible;
  const status = target && candidate && target === candidate
    ? 'exact'
    : criticalMismatch
      ? 'critical_mismatch'
      : score >= 0.72
        ? 'strong'
        : score >= 0.45
          ? 'weak'
          : 'unmatched';
  return {
    status,
    score,
    normalizedTarget: target,
    normalizedCandidate: candidate,
    criticalTokens: targetCritical,
    candidateCriticalTokens: candidateCritical,
    criticalCompatible,
  };
}

function isBetterCandidate(candidate, prior) {
  if (candidate.criticalCompatible !== prior.criticalCompatible) return candidate.criticalCompatible;
  if (candidate.status === 'exact' && prior.status !== 'exact') return true;
  if (candidate.status !== 'exact' && prior.status === 'exact') return false;
  return candidate.score > prior.score;
}

function sameStringSet(left, right) {
  return left.length === right.length && left.every((value) => right.includes(value));
}

function criticalTokens(value) {
  const normalized = String(value ?? '').normalize('NFKC').toLocaleLowerCase('ko-KR');
  const tokens = normalized.match(/(?:\d[\d,.]*(?:원|mm|cm|km|kg|g|m|%|회|년|개월|월|일|개|종|가지)?)|(?:[a-z]+[-_.]?\d+[a-z0-9-_.]*)/giu) ?? [];
  return [...new Set(tokens.map((token) => token.replace(/[,.]/gu, '').replace(/[-_.]/gu, '')))];
}

function transformLines(input, observation) {
  return observation.lines.map((line) => {
    const local = unionRegions(line.words.map((word) => word.normalized));
    if (input.kind !== 'static_tile') return { text: line.text, region: local };
    return {
      text: line.text,
      region: {
        x: (input.pixelRegion.left + local.x * input.pixelRegion.width) / input.sourceWidth,
        y: (input.pixelRegion.top + local.y * input.pixelRegion.height) / input.sourceHeight,
        width: local.width * input.pixelRegion.width / input.sourceWidth,
        height: local.height * input.pixelRegion.height / input.sourceHeight,
        unit: 'normalized',
      },
    };
  }).filter((line) => line.text.trim());
}

function decodeObservation(value) {
  return {
    ...value,
    text: decodeBase64(value.textUtf8Base64),
    lines: (value.lines ?? []).map((line) => ({
      ...line,
      text: decodeBase64(line.textUtf8Base64),
      words: (line.words ?? []).map((word) => ({ ...word, text: decodeBase64(word.textUtf8Base64) })),
    })),
  };
}

function decodeBase64(value) {
  return Buffer.from(String(value ?? ''), 'base64').toString('utf8');
}

function matchScore(target, candidate) {
  if (!target || !candidate) return 0;
  if (target === candidate) return 1;
  if (candidate.includes(target)) return Math.min(0.99, target.length / candidate.length + 0.25);
  if (target.includes(candidate)) return Math.min(0.9, candidate.length / target.length + 0.2);
  const distance = levenshtein(target, candidate);
  return Math.max(0, 1 - distance / Math.max(target.length, candidate.length));
}

function levenshtein(left, right) {
  const prior = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let row = 1; row <= left.length; row += 1) {
    let diagonal = prior[0];
    prior[0] = row;
    for (let column = 1; column <= right.length; column += 1) {
      const above = prior[column];
      prior[column] = Math.min(prior[column] + 1, prior[column - 1] + 1, diagonal + (left[row - 1] === right[column - 1] ? 0 : 1));
      diagonal = above;
    }
  }
  return prior[right.length];
}

function normalizeText(value) {
  return String(value ?? '').normalize('NFKC').toLocaleLowerCase('ko-KR').replace(/[^\p{L}\p{N}]+/gu, '');
}

function unionRegions(regions) {
  if (!regions.length) return { x: 0, y: 0, width: 1, height: 1, unit: 'normalized' };
  const left = Math.max(0, Math.min(...regions.map((item) => item.x)));
  const top = Math.max(0, Math.min(...regions.map((item) => item.y)));
  const right = Math.min(1, Math.max(...regions.map((item) => item.x + item.width)));
  const bottom = Math.min(1, Math.max(...regions.map((item) => item.y + item.height)));
  const padX = Math.min(0.01, left, 1 - right);
  const padY = Math.min(0.01, top, 1 - bottom);
  return {
    x: Number((left - padX).toFixed(8)),
    y: Number((top - padY).toFixed(8)),
    width: Number((right - left + padX * 2).toFixed(8)),
    height: Number((bottom - top + padY * 2).toFixed(8)),
    unit: 'normalized',
  };
}

function orderedUnique(values) {
  return [...new Set(values)];
}

function countBy(values, getter) {
  const result = {};
  for (const value of values) {
    const key = getter(value);
    result[key] = (result[key] ?? 0) + 1;
  }
  return result;
}

function pathKey(value) {
  return resolve(value).toLocaleLowerCase('en-US');
}

function requireAbsolute(value, label) {
  if (!isAbsolute(value ?? '')) throw new Error(`${label} path must be absolute`);
  return resolve(value);
}

function digest(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function jsonBytes(value) {
  return Buffer.from(`${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

export async function runAnalyzeAssetPixelEvidence(argv) {
  const args = parseStrictArgs(argv, { valueFlags: ['--workset', '--output'] });
  const result = await analyzeAssetPixelEvidence({
    worksetPath: required(args, '--workset'),
    outputPath: required(args, '--output'),
  });
  console.log(JSON.stringify(result, null, 2));
  return result;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await runAnalyzeAssetPixelEvidence(process.argv.slice(2));
}
