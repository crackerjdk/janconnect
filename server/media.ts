import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const storageRoot = path.resolve(process.cwd(), 'storage');
export const pendingStorageDir = path.join(storageRoot, 'pending');
export const publishedStorageDir = path.join(storageRoot, 'published');
export const restrictedKycStorageDir = path.join(storageRoot, 'restricted-kyc');

for (const dir of [storageRoot, pendingStorageDir, publishedStorageDir, restrictedKycStorageDir]) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export type SupportedMediaType = 'image/jpeg' | 'image/png' | 'image/webp' | 'video/mp4';

export function detectMagicMediaType(buf: Buffer): SupportedMediaType | null {
  if (buf.length < 12) return null;
  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return 'image/jpeg';
  }
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a
  ) {
    return 'image/png';
  }
  // WebP: RIFF....WEBP
  if (buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WEBP') {
    return 'image/webp';
  }
  // MP4: ....ftyp
  if (buf.subarray(4, 8).toString('ascii') === 'ftyp') {
    return 'video/mp4';
  }
  return null;
}

/**
 * Strips EXIF / GPS / XMP / Comment metadata segments from JPEG and PNG buffers
 * so uploaded civic photos never leak camera serials or residential GPS coordinates.
 */
export function stripMetadataFromBuffer(buf: Buffer, mediaType: SupportedMediaType): Buffer {
  if (mediaType === 'image/jpeg') {
    return stripJpegMetadata(buf);
  }
  if (mediaType === 'image/png') {
    return stripPngMetadata(buf);
  }
  return buf;
}

function stripJpegMetadata(buf: Buffer): Buffer {
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return buf;
  const chunks: Buffer[] = [buf.subarray(0, 2)]; // SOI
  let offset = 2;

  while (offset + 1 < buf.length) {
    if (buf[offset] !== 0xff) {
      chunks.push(buf.subarray(offset));
      break;
    }
    const marker = buf[offset + 1];
    // SOS (Start of Scan) or EOI: copy rest verbatim
    if (marker === 0xda || marker === 0xd9) {
      chunks.push(buf.subarray(offset));
      break;
    }
    // Standalone markers (RSTn, TEM)
    if ((marker >= 0xd0 && marker <= 0xd7) || marker === 0x01 || marker === 0x00) {
      chunks.push(buf.subarray(offset, offset + 2));
      offset += 2;
      continue;
    }
    if (offset + 4 > buf.length) break;
    const segLen = buf.readUInt16BE(offset + 2);
    const segEnd = offset + 2 + segLen;
    if (segEnd > buf.length || segLen < 2) {
      chunks.push(buf.subarray(offset));
      break;
    }
    // Drop APP1 (EXIF/XMP), APP2..APP15 (except APP0 JFIF & APP14 Adobe), and COM (0xFE)
    const isMetadataSegment = (marker >= 0xe1 && marker <= 0xef && marker !== 0xee) || marker === 0xfe;
    if (!isMetadataSegment) {
      chunks.push(buf.subarray(offset, segEnd));
    }
    offset = segEnd;
  }

  return Buffer.concat(chunks);
}

function stripPngMetadata(buf: Buffer): Buffer {
  if (buf.length < 8) return buf;
  const chunks: Buffer[] = [buf.subarray(0, 8)];
  let offset = 8;
  const stripTypes = new Set(['eXIf', 'tEXt', 'iTXt', 'zTXt', 'tIME']);

  while (offset + 8 <= buf.length) {
    const length = buf.readUInt32BE(offset);
    const type = buf.subarray(offset + 4, offset + 8).toString('ascii');
    const totalChunkLen = 12 + length;
    if (offset + totalChunkLen > buf.length) break;
    if (!stripTypes.has(type)) {
      chunks.push(buf.subarray(offset, offset + totalChunkLen));
    }
    offset += totalChunkLen;
    if (type === 'IEND') break;
  }

  return Buffer.concat(chunks);
}

const EXT_MAP: Record<SupportedMediaType, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'video/mp4': 'mp4',
};

export function savePendingMedia(rawBuffer: Buffer): { storagePath: string; mediaType: SupportedMediaType } {
  const mediaType = detectMagicMediaType(rawBuffer);
  if (!mediaType) {
    throw new Error('Unsupported or corrupted media file. Allowed: JPEG, PNG, WebP, MP4.');
  }
  const cleanBuffer = stripMetadataFromBuffer(rawBuffer, mediaType);
  const fileName = `${crypto.randomUUID()}.${EXT_MAP[mediaType]}`;
  const fullPath = path.resolve(pendingStorageDir, fileName);
  if (!fullPath.startsWith(pendingStorageDir + path.sep)) {
    throw new Error('Invalid storage path');
  }
  fs.writeFileSync(fullPath, cleanBuffer);
  return { storagePath: fileName, mediaType };
}

export function promotePendingToPublished(storageFileName: string): void {
  const safeName = path.basename(storageFileName);
  const src = path.resolve(pendingStorageDir, safeName);
  const dest = path.resolve(publishedStorageDir, safeName);
  if (!src.startsWith(pendingStorageDir + path.sep) || !dest.startsWith(publishedStorageDir + path.sep)) {
    throw new Error('Invalid storage boundary');
  }
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
  }
}

export function resolveSafeMediaPath(bucket: 'pending' | 'published', storageFileName: string): string | null {
  const baseDir = bucket === 'pending' ? pendingStorageDir : publishedStorageDir;
  const safeName = path.basename(storageFileName);
  const resolved = path.resolve(baseDir, safeName);
  if (!resolved.startsWith(baseDir + path.sep)) return null;
  if (!fs.existsSync(resolved)) return null;
  return resolved;
}

export function saveRestrictedKycDocument(rawBuffer: Buffer): { storagePath: string; mediaType: SupportedMediaType } {
  const mediaType = detectMagicMediaType(rawBuffer);
  if (!mediaType || mediaType === 'video/mp4') {
    throw new Error('ID document must be a valid JPEG, PNG, or WebP image.');
  }
  const cleanBuffer = stripMetadataFromBuffer(rawBuffer, mediaType);
  const fileName = `${crypto.randomUUID()}.${EXT_MAP[mediaType]}`;
  const fullPath = path.resolve(restrictedKycStorageDir, fileName);
  if (!fullPath.startsWith(restrictedKycStorageDir + path.sep)) {
    throw new Error('Invalid restricted KYC storage path');
  }
  fs.writeFileSync(fullPath, cleanBuffer);
  return { storagePath: fileName, mediaType };
}

export function resolveRestrictedKycPath(storageFileName: string): string | null {
  const safeName = path.basename(storageFileName);
  const resolved = path.resolve(restrictedKycStorageDir, safeName);
  if (!resolved.startsWith(restrictedKycStorageDir + path.sep)) return null;
  if (!fs.existsSync(resolved)) return null;
  return resolved;
}
