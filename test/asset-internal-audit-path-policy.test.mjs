import test from 'node:test';
import assert from 'node:assert/strict';
import { access, mkdir, readFile, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { assertTrustedPrivateOutput } from '../scripts/lib/asset-transfer-policy.mjs';

const repoRoot = resolve('.');
const privateTestBase = resolve(tmpdir(), 'mg-internal-audit-policy-tests');

test('internal audit private policy accepts only registered private roots', async () => {
  const nonce = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const approvedPrivateRoot = join(privateTestBase, `internal-audit-policy-${nonce}`);
  const objectRoot = join(approvedPrivateRoot, 'objects');
  const outputPath = join(approvedPrivateRoot, 'audit-output');
  await mkdir(objectRoot, { recursive: true });
  try {
    const accepted = await assertTrustedPrivateOutput({
      approvedPrivateRoot,
      outputPath,
      objectRoot,
      outputLabel: 'Internal audit output',
    }, { trustedPrivateRoots: [approvedPrivateRoot] });
    assert.equal(accepted.approvedPrivateRoot, resolve(approvedPrivateRoot));

    const rejected = [
      { root: repoRoot, output: join(repoRoot, `.internal-audit-denied-${nonce}`) },
      { root: tmpdir(), output: join(tmpdir(), `mg-internal-audit-denied-${nonce}`) },
    ];
    for (const item of rejected) {
      await assert.rejects(assertTrustedPrivateOutput({
        approvedPrivateRoot: item.root,
        outputPath: item.output,
        objectRoot,
        outputLabel: 'Internal audit output',
      }), /trusted private-root policy/);
      await assert.rejects(access(item.output), { code: 'ENOENT' });
    }
  } finally {
    await rm(approvedPrivateRoot, { recursive: true, force: true });
  }
});

test('content extractor routes internal-audit output through the common transfer policy', async () => {
  const source = await readFile(resolve(repoRoot, 'scripts', 'assets-extract-content.mjs'), 'utf8');
  assert.match(source, /import \{ assertTrustedPrivateOutput \} from '\.\/lib\/asset-transfer-policy\.mjs';/);
  assert.match(source, /if \(purpose === 'internal-audit'\) \{[\s\S]{0,400}await assertTrustedPrivateOutput\(\{/);
});
