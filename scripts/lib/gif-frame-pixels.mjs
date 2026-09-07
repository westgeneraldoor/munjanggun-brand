import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { parseGIF, decompressFrames } from 'gifuct-js';
import pngjs from 'pngjs';

const { PNG } = pngjs;
export const GIF_PIXEL_DECODER_VERSION = 'gifuct-js@2.1.2+munjanggun-compositor-v1';

export function decodeGifFramePixels(bytes, selectedFrameIndices) {
  const parsed = parseGIF(bytes);
  const frames = decompressFrames(parsed, true);
  const width = parsed.lsd.width;
  const height = parsed.lsd.height;
  const wanted = new Set(selectedFrameIndices);
  const result = new Map();
  let canvas = new Uint8ClampedArray(width * height * 4);

  frames.forEach((frame, frameIndex) => {
    const before = frame.disposalType === 3 ? canvas.slice() : null;
    compositePatch(canvas, width, height, frame);
    if (wanted.has(frameIndex)) {
      result.set(frameIndex, { width, height, pixelSha256: pixelDigest(width, height, canvas) });
    }
    if (frame.disposalType === 2) clearFrameRect(canvas, width, height, frame.dims);
    else if (frame.disposalType === 3 && before) canvas = before;
  });
  return { frameCount: frames.length, width, height, frames: result };
}

export async function readPngPixelFact(path) {
  try {
    const png = PNG.sync.read(await readFile(path));
    return { width: png.width, height: png.height, pixelSha256: pixelDigest(png.width, png.height, png.data) };
  } catch (error) {
    throw new Error(`GIF sample evidence must be a valid PNG frame: ${error.message}`);
  }
}

function compositePatch(canvas, canvasWidth, canvasHeight, frame) {
  const { left, top, width, height } = frame.dims;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const sourceOffset = (y * width + x) * 4;
      const targetX = left + x;
      const targetY = top + y;
      if (targetX < 0 || targetY < 0 || targetX >= canvasWidth || targetY >= canvasHeight) continue;
      const alpha = frame.patch[sourceOffset + 3];
      if (alpha === 0) continue;
      const targetOffset = (targetY * canvasWidth + targetX) * 4;
      canvas[targetOffset] = frame.patch[sourceOffset];
      canvas[targetOffset + 1] = frame.patch[sourceOffset + 1];
      canvas[targetOffset + 2] = frame.patch[sourceOffset + 2];
      canvas[targetOffset + 3] = alpha;
    }
  }
}

function clearFrameRect(canvas, canvasWidth, canvasHeight, dims) {
  for (let y = 0; y < dims.height; y += 1) {
    for (let x = 0; x < dims.width; x += 1) {
      const targetX = dims.left + x;
      const targetY = dims.top + y;
      if (targetX < 0 || targetY < 0 || targetX >= canvasWidth || targetY >= canvasHeight) continue;
      const offset = (targetY * canvasWidth + targetX) * 4;
      canvas.fill(0, offset, offset + 4);
    }
  }
}

function pixelDigest(width, height, rgba) {
  return createHash('sha256')
    .update(Buffer.from(`${width}x${height}\0`, 'utf8'))
    .update(Buffer.from(rgba.buffer, rgba.byteOffset, rgba.byteLength))
    .digest('hex');
}
