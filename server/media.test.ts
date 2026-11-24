import test from 'node:test';
import assert from 'node:assert/strict';
import { detectMagicMediaType, stripMetadataFromBuffer } from './media';

test('detectMagicMediaType identifies JPEG and PNG and rejects spoofed buffers', () => {
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
  assert.equal(detectMagicMediaType(jpeg), 'image/jpeg');

  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);
  assert.equal(detectMagicMediaType(png), 'image/png');

  const textSpoof = Buffer.from('not really an image');
  assert.equal(detectMagicMediaType(textSpoof), null);
});

test('stripMetadataFromBuffer removes JPEG APP1 EXIF/GPS segment while preserving SOI and SOS', () => {
  // SOI (FF D8) + APP1 EXIF (FF E1 len=8 "Exif\0\0") + SOS (FF DA 00 02) + EOI (FF D9)
  const jpegWithExif = Buffer.from([
    0xff, 0xd8,
    0xff, 0xe1, 0x00, 0x08, 0x45, 0x78, 0x69, 0x66, 0x00, 0x00,
    0xff, 0xda, 0x00, 0x02,
    0xff, 0xd9,
  ]);
  const stripped = stripMetadataFromBuffer(jpegWithExif, 'image/jpeg');
  assert.equal(stripped.includes(Buffer.from('Exif')), false);
  assert.equal(stripped[0], 0xff);
  assert.equal(stripped[1], 0xd8);
  assert.equal(stripped[2], 0xff);
  assert.equal(stripped[3], 0xda);
});
