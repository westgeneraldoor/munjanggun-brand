#!/usr/bin/env node
import { constants } from 'node:fs';
import { copyFile, link, mkdir, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { readAndValidateManifestV2 } from './lib/asset-manifest-v2.mjs';
import { resolveAssetObject, selectAsset } from './lib/asset-resolver.mjs';
import { sha256File } from './lib/asset-inventory.mjs';
import { authorizePrivateRecovery, recoveryContextFromArgv } from './lib/asset-transfer-policy.mjs';
import { flag, one, parseStrictArgs, required } from './lib/strict-cli-args.mjs';

export async function runAssetExtract(argv, { trustedPrivateRoots, emit = console.log } = {}) {
  const args = parseStrictArgs(argv, {
    valueFlags: ['--manifest', '--object-root', '--output', '--asset-id', '--logical-path', '--source-id', '--source-relative-path', '--purpose', '--destination-class', '--approved-private-root', '--recovery-ref', '--requested-by', '--reason'],
    booleanFlags: ['--acknowledge-no-publication'],
  });
  const manifestPath = resolve(required(args, '--manifest'));
  const objectRoot = resolve(required(args, '--object-root'));
  const outputPath = resolve(required(args, '--output'));
  const transfer = await authorizePrivateRecovery({
    ...recoveryContextFromArgv((name) => one(args, name), (name) => flag(args, name)), outputPath, objectRoot,
  }, trustedPrivateRoots === undefined ? undefined : { trustedPrivateRoots });
  const { manifest, findings } = await readAndValidateManifestV2(manifestPath);
  if (findings.length > 0) throw new Error(findings.map((finding) => finding.message).join('\n'));
  const asset = selectAsset(manifest, {
    assetId: one(args, '--asset-id'),
    logicalPath: one(args, '--logical-path'),
    sourceId: one(args, '--source-id'),
    sourceRelativePath: one(args, '--source-relative-path'),
  });
  const objectPath = await resolveAssetObject(objectRoot, asset);
  await mkdir(dirname(outputPath), { recursive: true });
  const nonce = randomUUID();
  const partialPath = `${outputPath}.${nonce}.partial`;
  const receiptPath = `${outputPath}.receipt.json`;
  const partialReceiptPath = `${receiptPath}.${nonce}.partial`;
  let outputCommitted = false;
  try {
    await copyFile(objectPath, partialPath, constants.COPYFILE_EXCL);
    const copied = await stat(partialPath);
    const copiedSha256 = await sha256File(partialPath);
    if (copied.size !== asset.byteSize || copiedSha256 !== asset.sha256) throw new Error('Copied recovery output integrity mismatch');
    const receipt = {
      schema: 'munjanggun.assetRecoveryReceipt.v1', version: '1.0', operation: 'single_extract',
      createdAt: new Date().toISOString(), ...transfer, manifestPath, manifestSha256: await sha256File(manifestPath),
      intakeId: manifest.intakeId, outputPath, noOverwrite: true,
      assets: [{ logicalPath: asset.logicalPath, contentId: asset.contentId, sha256: asset.sha256, byteSize: asset.byteSize,
        observed: { humanReviewStatus: asset.humanReviewStatus, rightsStatus: asset.rightsStatus, privacyStatus: asset.privacyStatus, claimReviewStatus: asset.claimReviewStatus, publishStatus: asset.publishStatus } }],
    };
    await writeFile(partialReceiptPath, `${JSON.stringify(receipt, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
    await link(partialPath, outputPath);
    outputCommitted = true;
    await rm(partialPath);
    await link(partialReceiptPath, receiptPath);
    await rm(partialReceiptPath);
    const result = { result: 'success', outputPath, receiptPath };
    emit(JSON.stringify(result, null, 2));
    return result;
  } catch (error) {
    await Promise.all([rm(partialPath, { force: true }), rm(partialReceiptPath, { force: true })]);
    if (outputCommitted) {
      try { if (await sha256File(outputPath) === asset.sha256) await rm(outputPath, { force: true }); } catch {}
    }
    throw error;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await runAssetExtract(process.argv.slice(2));
}
