import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { inspectMedia } from '../scripts/lib/media-metadata.mjs';

test('media metadata reads PNG dimensions', async () => {
  const path = await fixturePath('pixel.png');
  await writeFile(path, Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2nWQAAAAASUVORK5CYII=', 'base64'));
  const metadata = await inspectMedia(path);
  assert.deepEqual(metadata, {
    mediaType: 'image/png',
    width: 1,
    height: 1,
    frameCount: null,
    durationMs: null,
    loopCount: null,
  });
});

test('media metadata reads GIF frames and dimensions', async () => {
  const path = await fixturePath('pixel.gif');
  await writeFile(path, Buffer.from('R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==', 'base64'));
  const metadata = await inspectMedia(path);
  assert.deepEqual(metadata, {
    mediaType: 'image/gif',
    width: 1,
    height: 1,
    frameCount: 1,
    durationMs: 0,
    loopCount: null,
  });
});

test('media metadata reads JPEG SOF dimensions', async () => {
  const path = await fixturePath('minimal.jpg');
  await writeFile(path, Buffer.from([
    0xff, 0xd8,
    0xff, 0xc0, 0x00, 0x11, 0x08, 0x00, 0x02, 0x00, 0x03,
    0x03, 0x01, 0x11, 0x00, 0x02, 0x11, 0x00, 0x03, 0x11, 0x00,
    0xff, 0xd9,
  ]));
  const metadata = await inspectMedia(path);
  assert.equal(metadata.mediaType, 'image/jpeg');
  assert.equal(metadata.width, 3);
  assert.equal(metadata.height, 2);
});

async function fixturePath(name) {
  const root = join(tmpdir(), `mg-media-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  await mkdir(root, { recursive: true });
  return join(root, name);
}
