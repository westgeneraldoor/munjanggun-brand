#!/usr/bin/env node
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { formatSchemaErrors, validateAgainstSchema } from './lib/schema-validation.mjs';

const inventoryPath = resolve(requiredArg('--inventory'));
const staticPath = resolve(requiredArg('--static'));
const gifPath = resolve(requiredArg('--gif'));
const outputPath = resolve(requiredArg('--output'));
const [inventory, staticReview, gifReview] = await Promise.all([readJson(inventoryPath), readJson(staticPath), readJson(gifPath)]);
const schema = await readJson(fileURLToPath(new URL('../schemas/asset-visual-similarity-map.schema.json', import.meta.url)));

const reviewed = new Map();
for (const [label, rows] of [['static-final-375', staticReview.entries], ['gif-final-75', gifReview.entries]]) {
  for (const entry of rows) {
    if (reviewed.has(entry.sha256)) throw new Error(`Duplicate final review SHA ${entry.sha256}`);
    reviewed.set(entry.sha256, { label, entry });
  }
}
if (reviewed.size !== inventory.groups.length) throw new Error(`Final review covers ${reviewed.size}; inventory requires ${inventory.groups.length}`);

const entries = inventory.groups.map((group) => {
  const review = reviewed.get(group.sha256);
  if (!review) throw new Error(`Missing final visual review for ${group.sha256}`);
  const entry = review.entry;
  if (entry.mediaType !== group.mediaType) throw new Error(`mediaType mismatch for ${group.sha256}`);
  if (entry.comparisonScope !== 'within_media_only') throw new Error(`comparisonScope mismatch for ${group.sha256}`);
  if (entry.humanReviewStatus !== 'reviewed') throw new Error(`unfinished human review for ${group.sha256}`);
  const sourcePathCount = group.canonicalPathCount + group.intakePathCount;
  const originScope = group.canonicalPathCount > 0 && group.intakePathCount > 0
    ? 'shared'
    : group.canonicalPathCount > 0 ? 'canonical_only' : 'intake_only';
  const sourceDecision = entry.visualDecision ?? entry.evidence?.visualDecision;
  const visualDecision = sourceDecision === 'reviewed_singleton'
    ? 'reviewed_singleton'
    : ['grouped_visual_equivalent', 'member_of_reviewed_near_duplicate_group'].includes(sourceDecision)
      ? 'human_confirmed_equivalent_group'
      : null;
  if (!visualDecision) throw new Error(`Unknown visualDecision ${sourceDecision} for ${group.sha256}`);
  const comparisonMethod = Array.isArray(entry.comparisonMethod) ? entry.comparisonMethod : [entry.comparisonMethod];
  return {
    binaryGroupId: `sha256:${group.sha256}`,
    sha256: group.sha256,
    mediaType: group.mediaType,
    originScope,
    sourcePathCount,
    visualGroupId: entry.visualGroupId,
    semanticGroupId: entry.semanticGroupId ?? null,
    visualDecision,
    comparisonScope: 'within_media_only',
    comparisonMethod: [...new Set(comparisonMethod.map(String))],
    humanReviewStatus: 'reviewed',
    humanReviewEvidence: [`${review.label}.json#sha256=${group.sha256}`],
  };
});
const visualGroups = new Set(entries.map((entry) => entry.visualGroupId));
const unjudgedCount = entries.filter((entry) => !entry.visualGroupId || entry.humanReviewStatus !== 'reviewed').length;
const output = {
  schema: 'munjanggun.assetVisualSimilarityMap.v1',
  version: '1.0',
  intakeId: inventory.intakeId,
  generatedAt: new Date().toISOString(),
  comparisonPolicy: 'within_media_only',
  logicalPathCount: entries.reduce((sum, entry) => sum + entry.sourcePathCount, 0),
  binaryGroupCount: entries.length,
  visualGroupCount: visualGroups.size,
  unjudgedCount,
  entries,
};
if (output.logicalPathCount !== 2013) throw new Error(`Expected 2013 logical paths, got ${output.logicalPathCount}`);
if (output.binaryGroupCount !== 450) throw new Error(`Expected 450 binary groups, got ${output.binaryGroupCount}`);
const result = validateAgainstSchema(output, schema);
if (!result.valid) throw new Error(`Visual similarity schema failed:\n${formatSchemaErrors(result.errors).join('\n')}`);
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
console.log(`Visual similarity merge passed: ${output.logicalPathCount} paths / ${output.binaryGroupCount} SHA groups / ${output.visualGroupCount} visual groups / ${output.unjudgedCount} unjudged.`);

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
