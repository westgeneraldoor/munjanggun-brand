#!/usr/bin/env node
import { constants } from 'node:fs';
import { copyFile, mkdir, readdir, rename, rm, rmdir, stat, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { resolveContainedPath } from './lib/asset-paths.mjs';
import { sha256File } from './lib/asset-inventory.mjs';
import { readAndValidateManifestV2 } from './lib/asset-manifest-v2.mjs';
import { resolveAssetObject } from './lib/asset-resolver.mjs';
import { authorizePrivateRecovery, recoveryContextFromArgv } from './lib/asset-transfer-policy.mjs';
import { flag, many, one, parseStrictArgs, required } from './lib/strict-cli-args.mjs';

const args = parseStrictArgs(process.argv.slice(2), {
  valueFlags: ['--manifest', '--object-root', '--output-root', '--purpose', '--destination-class', '--approved-private-root', '--recovery-ref', '--requested-by', '--reason'],
  booleanFlags: ['--acknowledge-no-publication'], multipleFlags: ['--manifest'],
});
const manifestPaths = many(args, '--manifest').map((value) => resolve(value));
if (manifestPaths.length === 0) throw new Error('At least one --manifest is required.');
const objectRoot = resolve(required(args, '--object-root'));
const outputRoot = resolve(required(args, '--output-root'));
const transfer = await authorizePrivateRecovery({
  ...recoveryContextFromArgv((name) => one(args, name), (name) => flag(args, name)), outputPath: outputRoot, objectRoot,
});
await requireAbsentOrEmptyOutput(outputRoot);
const assets = [];
for (const manifestPath of manifestPaths) {
  const { manifest, findings } = await readAndValidateManifestV2(manifestPath);
  if (findings.length > 0) throw new Error(`${manifestPath}: ${findings.map((finding) => finding.message).join('\n')}`);
  assets.push(...manifest.assets);
}
const logicalPaths = new Set();
for (const asset of assets) {
  if (logicalPaths.has(asset.logicalPath)) throw new Error(`Duplicate logicalPath across manifests: ${asset.logicalPath}`);
  logicalPaths.add(asset.logicalPath);
}

const partialRoot = `${outputRoot}.${randomUUID()}.partial`;
try {
  await mkdir(partialRoot, { recursive: false });
  const receiptAssets = [];
  for (const asset of [...assets].sort((a, b) => a.logicalPath.localeCompare(b.logicalPath, 'ko', { numeric: true }))) {
    const sourcePath = await resolveAssetObject(objectRoot, asset);
    const targetPath = resolveContainedPath(partialRoot, asset.logicalPath, 'logicalPath');
    await mkdir(dirname(targetPath), { recursive: true });
    await copyFile(sourcePath, targetPath, constants.COPYFILE_EXCL);
    const copied = await stat(targetPath);
    if (copied.size !== asset.byteSize || await sha256File(targetPath) !== asset.sha256) throw new Error(`Copied recovery output integrity mismatch: ${asset.logicalPath}`);
    receiptAssets.push({ logicalPath: asset.logicalPath, contentId: asset.contentId, sha256: asset.sha256, byteSize: asset.byteSize,
      observed: { humanReviewStatus: asset.humanReviewStatus, rightsStatus: asset.rightsStatus, privacyStatus: asset.privacyStatus, claimReviewStatus: asset.claimReviewStatus, publishStatus: asset.publishStatus } });
  }
  const receipt = {
    schema: 'munjanggun.assetRecoveryReceipt.v1', version: '1.0', operation: 'materialize', createdAt: new Date().toISOString(), ...transfer,
    manifests: await Promise.all(manifestPaths.map(async (path) => ({ path, sha256: await sha256File(path) }))),
    outputRoot, assetCount: receiptAssets.length, noOverwrite: true, assets: receiptAssets,
  };
  await writeFile(resolveContainedPath(partialRoot, '_asset-recovery-receipt.json', 'recovery receipt'), `${JSON.stringify(receipt, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
  await rmdir(outputRoot);
  await rename(partialRoot, outputRoot);
  console.log(JSON.stringify({ result: 'success', assetCount: assets.length, outputRoot, receiptPath: resolve(outputRoot, '_asset-recovery-receipt.json') }, null, 2));
} catch (error) {
  await rm(partialRoot, { recursive: true, force: true });
  throw error;
}

async function requireAbsentOrEmptyOutput(path) {
  await mkdir(path, { recursive: true });
  const entries = await readdir(path);
  if (entries.length > 0) throw new Error(`Output root must be empty: ${path}`);
}
