import { createHash } from 'node:crypto';
import jpeg from 'jpeg-js';
import pngjs from 'pngjs';

const { PNG } = pngjs;

export const STATIC_PIXEL_DECODER_VERSION = 'pngjs@7.0.0+jpeg-js@0.4.4+munjanggun-crop-v1';
export const STATIC_PNG_ENCODER_VERSION = 'pngjs@7.0.0+munjanggun-canonical-png-v1';

export function decodeStaticRegionPixels(bytes, region) {
  const source = decodeStaticImagePixels(bytes);
  const bounds = normalizedBounds(region, source.width, source.height);
  return extractStaticPixelRegion(source, { left: bounds.x, top: bounds.y, width: bounds.width, height: bounds.height });
}

export function decodeStaticPixelRegion(bytes, pixelRegion) {
  return extractStaticPixelRegion(decodeStaticImagePixels(bytes), pixelRegion);
}

export function staticImagePixelFact(bytes) {
  const source = decodeStaticImagePixels(bytes);
  return {
    width: source.width,
    height: source.height,
    pixelSha256: staticPixelDigest(source.width, source.height, source.data),
  };
}

export function staticPixelDigest(width, height, rgba) {
  return createHash('sha256').update(`${width}x${height}\0`).update(rgba).digest('hex');
}

export function extractStaticPixelRegion(source, pixelRegion) {
  const bounds = normalizePixelRegion(pixelRegion, source.width, source.height);
  const rgba = new Uint8Array(bounds.width * bounds.height * 4);
  for (let row = 0; row < bounds.height; row += 1) {
    const sourceStart = ((bounds.top + row) * source.width + bounds.left) * 4;
    const targetStart = row * bounds.width * 4;
    rgba.set(source.data.subarray(sourceStart, sourceStart + bounds.width * 4), targetStart);
  }
  return {
    x: bounds.left,
    y: bounds.top,
    width: bounds.width,
    height: bounds.height,
    sourceWidth: source.width,
    sourceHeight: source.height,
    pixelRegion: bounds,
    data: rgba,
    pixelSha256: staticPixelDigest(bounds.width, bounds.height, rgba),
    decoderVersion: STATIC_PIXEL_DECODER_VERSION,
  };
}

export function decodeStaticImagePixels(bytes) {
  const buffer = Buffer.from(bytes);
  try {
    if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
      const decoded = PNG.sync.read(buffer);
      return { width: decoded.width, height: decoded.height, data: new Uint8Array(decoded.data) };
    }
    if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xd8) {
      const decoded = jpeg.decode(buffer, { useTArray: true, formatAsRGBA: true });
      return applyExifOrientation({ width: decoded.width, height: decoded.height, data: new Uint8Array(decoded.data) }, readJpegExifOrientation(buffer));
    }
  } catch (error) {
    throw new Error(`Static original could not be decoded: ${error.message}`);
  }
  throw new Error('Static original must be a decodable PNG or JPEG');
}

export function readJpegExifOrientation(buffer) {
  let offset = 2;
  while (offset + 4 <= buffer.length && buffer[offset] === 0xff) {
    const marker = buffer[offset + 1];
    if (marker === 0xda || marker === 0xd9) break;
    const length = buffer.readUInt16BE(offset + 2);
    if (length < 2 || offset + 2 + length > buffer.length) break;
    if (marker === 0xe1 && buffer.subarray(offset + 4, offset + 10).toString('ascii') === 'Exif\0\0') {
      const tiff = offset + 10;
      const little = buffer.subarray(tiff, tiff + 2).toString('ascii') === 'II';
      const big = buffer.subarray(tiff, tiff + 2).toString('ascii') === 'MM';
      if (!little && !big) return 1;
      const u16 = (at) => (little ? buffer.readUInt16LE(at) : buffer.readUInt16BE(at));
      const u32 = (at) => (little ? buffer.readUInt32LE(at) : buffer.readUInt32BE(at));
      if (u16(tiff + 2) !== 42) return 1;
      const ifd = tiff + u32(tiff + 4);
      if (ifd + 2 > buffer.length) return 1;
      const count = u16(ifd);
      for (let index = 0; index < count; index += 1) {
        const entry = ifd + 2 + index * 12;
        if (entry + 12 > buffer.length) return 1;
        if (u16(entry) === 0x0112 && u16(entry + 2) === 3 && u32(entry + 4) >= 1) {
          const orientation = u16(entry + 8);
          return orientation >= 1 && orientation <= 8 ? orientation : 1;
        }
      }
    }
    offset += 2 + length;
  }
  return 1;
}

export function applyExifOrientation(source, orientation) {
  if (orientation === 1) return source;
  const swapsAxes = orientation >= 5;
  const width = swapsAxes ? source.height : source.width;
  const height = swapsAxes ? source.width : source.height;
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let sx;
      let sy;
      if (orientation === 2) { sx = source.width - 1 - x; sy = y; }
      else if (orientation === 3) { sx = source.width - 1 - x; sy = source.height - 1 - y; }
      else if (orientation === 4) { sx = x; sy = source.height - 1 - y; }
      else if (orientation === 5) { sx = y; sy = x; }
      else if (orientation === 6) { sx = y; sy = source.height - 1 - x; }
      else if (orientation === 7) { sx = source.width - 1 - y; sy = source.height - 1 - x; }
      else { sx = source.width - 1 - y; sy = x; }
      const sourceOffset = (sy * source.width + sx) * 4;
      const targetOffset = (y * width + x) * 4;
      data.set(source.data.subarray(sourceOffset, sourceOffset + 4), targetOffset);
    }
  }
  return { width, height, data };
}

export function readCropPngPixels(bytes) {
  try {
    const decoded = PNG.sync.read(Buffer.from(bytes));
    const data = new Uint8Array(decoded.data);
    return { width: decoded.width, height: decoded.height, data, pixelSha256: staticPixelDigest(decoded.width, decoded.height, data) };
  } catch (error) {
    throw new Error(`Static text crop must be a valid PNG: ${error.message}`);
  }
}

export function encodeRgbaPng({ width, height, data }) {
  return PNG.sync.write({ width, height, data: Buffer.from(data) }, {
    colorType: 6,
    inputColorType: 6,
    inputHasAlpha: true,
    bitDepth: 8,
    deflateLevel: 9,
    deflateStrategy: 3,
    filterType: 4,
  });
}

function normalizedBounds(region, imageWidth, imageHeight) {
  const x = Math.floor(region.x * imageWidth);
  const y = Math.floor(region.y * imageHeight);
  const right = Math.ceil((region.x + region.width) * imageWidth);
  const bottom = Math.ceil((region.y + region.height) * imageHeight);
  const width = Math.max(1, Math.min(imageWidth, right) - Math.min(imageWidth - 1, x));
  const height = Math.max(1, Math.min(imageHeight, bottom) - Math.min(imageHeight - 1, y));
  return { x: Math.min(imageWidth - 1, x), y: Math.min(imageHeight - 1, y), width, height };
}

function normalizePixelRegion(region, imageWidth, imageHeight) {
  const left = Number(region?.left);
  const top = Number(region?.top);
  const width = Number(region?.width);
  const height = Number(region?.height);
  if (![left, top, width, height].every(Number.isInteger)
    || left < 0 || top < 0 || width < 1 || height < 1
    || left + width > imageWidth || top + height > imageHeight) {
    throw new Error('Static pixel region is outside the decoded source image');
  }
  return { left, top, width, height };
}
