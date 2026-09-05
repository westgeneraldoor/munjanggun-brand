import { lstat, realpath } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep } from 'node:path';

const TRUSTED_PRIVATE_ROOTS = Object.freeze(
  ['C:/Users/hjh/안티그래비티/문장군_브랜드_private', 'Z:/문장군_브랜드_원본보관'].map((value) => resolve(value)),
);

export async function authorizePrivateRecovery({
  purpose, destinationClass, approvedPrivateRoot, outputPath, objectRoot,
  recoveryRef, requestedBy, reason, noPublicationAcknowledged,
}, { trustedPrivateRoots = TRUSTED_PRIVATE_ROOTS } = {}) {
  if (purpose !== 'internal-recovery' || destinationClass !== 'private-recovery') {
    throw new Error('Compatibility copy tools are internal-recovery only; use assets:extract-content for external publication or public repository output');
  }
  if (!approvedPrivateRoot) throw new Error('Missing required argument --approved-private-root');
  if (!/^RECOVERY-[A-Z0-9-]+$/i.test(recoveryRef ?? '')) throw new Error('--recovery-ref must use RECOVERY-... format');
  if (!requestedBy) throw new Error('Missing required argument --requested-by');
  if ((reason ?? '').length < 20) throw new Error('--reason must be at least 20 characters');
  if (!noPublicationAcknowledged) throw new Error('Internal recovery requires --acknowledge-no-publication');

  const { approvedPrivateRoot: root } = await assertTrustedPrivateOutput({
    approvedPrivateRoot, outputPath, objectRoot, outputLabel: 'Recovery output',
  }, { trustedPrivateRoots });
  return { purpose, destinationClass, approvedPrivateRoot: root, recoveryRef, requestedBy, reason, noPublicationAcknowledged: true };
}

export async function assertTrustedPrivateOutput({
  approvedPrivateRoot, outputPath, objectRoot, outputLabel = 'Private output',
}, { trustedPrivateRoots = TRUSTED_PRIVATE_ROOTS } = {}) {
  if (!approvedPrivateRoot) throw new Error('Missing required argument --approved-private-root');
  const root = resolve(approvedPrivateRoot);
  const target = resolve(outputPath);
  const objects = resolve(objectRoot);
  if (root === target) throw new Error(`${outputLabel} must be a child of --approved-private-root, not the root itself`);
  const trustedRoot = trustedPrivateRoots.map((value) => resolve(value)).some((value) => isContained(value, root));
  if (!trustedRoot) throw new Error('Approved private root is not in the trusted private-root policy');
  if (!isContained(root, target)) throw new Error(`${outputLabel} must stay under --approved-private-root`);
  if (isContained(objects, target) || isContained(target, objects)) throw new Error(`${outputLabel} and object root must be separate`);
  const rootInfo = await lstat(root);
  if (!rootInfo.isDirectory() || rootInfo.isSymbolicLink()) throw new Error('Approved private root must be a real directory');
  const rootReal = await realpath(root);
  const segments = relative(root, target).split(sep).filter(Boolean);
  let cursor = root;
  for (const segment of segments) {
    cursor = resolve(cursor, segment);
    try {
      const info = await lstat(cursor);
      if (info.isSymbolicLink()) throw new Error(`${outputLabel} path must not contain symbolic links`);
    } catch (error) {
      if (error.code === 'ENOENT') break;
      throw error;
    }
  }
  if (!isContained(rootReal, resolve(rootReal, ...segments))) throw new Error(`${outputLabel} real path escapes approved root`);
  return { approvedPrivateRoot: root, outputPath: target };
}

export function recoveryContextFromArgv(getArg, hasFlag) {
  return {
    purpose: getArg('--purpose'),
    destinationClass: getArg('--destination-class'),
    approvedPrivateRoot: getArg('--approved-private-root'),
    recoveryRef: getArg('--recovery-ref'),
    requestedBy: getArg('--requested-by'),
    reason: getArg('--reason'),
    noPublicationAcknowledged: hasFlag('--acknowledge-no-publication'),
  };
}

function isContained(root, child) {
  const relation = relative(resolve(root), resolve(child));
  return relation === '' || (!relation.startsWith(`..${sep}`) && relation !== '..' && !isAbsolute(relation));
}
