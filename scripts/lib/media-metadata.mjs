import { readFile } from 'node:fs/promises';

export async function inspectMedia(filePath) {
  const buffer = await readFile(filePath);
  if (isPng(buffer)) return inspectPng(buffer);
  if (isGif(buffer)) return inspectGif(buffer);
  if (isJpeg(buffer)) return inspectJpeg(buffer);
  throw new Error(`Unsupported or invalid media signature: ${filePath}`);
}

export function canonicalExtensionForMediaType(mediaType) {
  return ({
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'image/webp': '.webp',
    'video/mp4': '.mp4',
    'video/quicktime': '.mov',
  })[mediaType];
}

function inspectPng(buffer) {
  if (buffer.length < 24 || buffer.toString('ascii', 12, 16) !== 'IHDR') throw new Error('Invalid PNG IHDR');
  return {
    mediaType: 'image/png',
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
    frameCount: null,
    durationMs: null,
    loopCount: null,
  };
}

function inspectJpeg(buffer) {
  let offset = 2;
  while (offset + 4 <= buffer.length) {
    while (offset < buffer.length && buffer[offset] !== 0xff) offset += 1;
    while (offset < buffer.length && buffer[offset] === 0xff) offset += 1;
    if (offset >= buffer.length) break;
    const marker = buffer[offset];
    offset += 1;
    if (marker === 0xd8 || marker === 0xd9 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (offset + 2 > buffer.length) break;
    const length = buffer.readUInt16BE(offset);
    if (length < 2 || offset + length > buffer.length) break;
    if (isStartOfFrame(marker)) {
      if (length < 7) throw new Error('Invalid JPEG SOF segment');
      return {
        mediaType: 'image/jpeg',
        width: buffer.readUInt16BE(offset + 5),
        height: buffer.readUInt16BE(offset + 3),
        frameCount: null,
        durationMs: null,
        loopCount: null,
      };
    }
    offset += length;
  }
  throw new Error('JPEG dimensions not found');
}

function inspectGif(buffer) {
  if (buffer.length < 13) throw new Error('Invalid GIF header');
  const width = buffer.readUInt16LE(6);
  const height = buffer.readUInt16LE(8);
  let offset = 13;
  if (buffer[10] & 0x80) offset += 3 * (2 ** ((buffer[10] & 0x07) + 1));
  let frameCount = 0;
  let durationMs = 0;
  let pendingDelayMs = 0;
  let loopCount = null;

  while (offset < buffer.length) {
    const introducer = buffer[offset++];
    if (introducer === 0x3b) break;
    if (introducer === 0x2c) {
      if (offset + 9 > buffer.length) throw new Error('Truncated GIF image descriptor');
      const packed = buffer[offset + 8];
      offset += 9;
      if (packed & 0x80) offset += 3 * (2 ** ((packed & 0x07) + 1));
      if (offset >= buffer.length) throw new Error('Truncated GIF image data');
      offset += 1;
      offset = skipSubBlocks(buffer, offset);
      frameCount += 1;
      durationMs += pendingDelayMs;
      pendingDelayMs = 0;
      continue;
    }
    if (introducer !== 0x21 || offset >= buffer.length) throw new Error('Unknown GIF block');
    const label = buffer[offset++];
    if (label === 0xf9) {
      const blockSize = buffer[offset++];
      if (blockSize !== 4 || offset + blockSize >= buffer.length) throw new Error('Invalid GIF graphic control extension');
      pendingDelayMs = buffer.readUInt16LE(offset + 1) * 10;
      offset += blockSize;
      if (buffer[offset++] !== 0x00) throw new Error('Invalid GIF graphic control terminator');
      continue;
    }
    if (label === 0xff) {
      const blockSize = buffer[offset++];
      if (offset + blockSize > buffer.length) throw new Error('Truncated GIF application extension');
      const application = buffer.toString('ascii', offset, offset + blockSize);
      offset += blockSize;
      if ((application === 'NETSCAPE2.0' || application === 'ANIMEXTS1.0')
        && offset + 5 <= buffer.length && buffer[offset] === 3 && buffer[offset + 1] === 1) {
        loopCount = buffer.readUInt16LE(offset + 2);
      }
      offset = skipSubBlocks(buffer, offset);
      continue;
    }
    const blockSize = buffer[offset++];
    if (offset + blockSize > buffer.length) throw new Error('Truncated GIF extension');
    offset += blockSize;
    offset = skipSubBlocks(buffer, offset);
  }

  if (frameCount === 0) throw new Error('GIF contains no image frames');
  return { mediaType: 'image/gif', width, height, frameCount, durationMs, loopCount };
}

function skipSubBlocks(buffer, startOffset) {
  let offset = startOffset;
  while (offset < buffer.length) {
    const size = buffer[offset++];
    if (size === 0) return offset;
    offset += size;
    if (offset > buffer.length) throw new Error('Truncated GIF sub-block');
  }
  throw new Error('GIF sub-block terminator not found');
}

function isPng(buffer) {
  return buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
}

function isGif(buffer) {
  return buffer.length >= 6 && ['GIF87a', 'GIF89a'].includes(buffer.toString('ascii', 0, 6));
}

function isJpeg(buffer) {
  return buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xd8;
}

function isStartOfFrame(marker) {
  return [0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker);
}
