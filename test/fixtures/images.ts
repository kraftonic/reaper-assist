import { crc32 } from "node:zlib";
import { PNG } from "pngjs";

/** Test images built in memory (no files from anywhere else). */

/** A real PNG (pngjs) with metadata chunks spliced in after IHDR. */
export function pngWith(width: number, height: number, extra: [string, string][] = []): Buffer {
  const png = new PNG({ width, height });
  for (let i = 0; i < png.data.length; i += 4) png.data.set([200, 40, 90, 255], i);
  const base = PNG.sync.write(png);
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type, "latin1"), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(td));
    return Buffer.concat([len, td, crc]);
  };
  const ihdrEnd = 8 + 12 + 13;
  return Buffer.concat([base.subarray(0, ihdrEnd), ...extra.map(([t, d]) => chunk(t, Buffer.from(d, "latin1"))), base.subarray(ihdrEnd)]);
}

/** A minimal JPEG byte stream: JFIF, EXIF with GPS, a comment, ICC, a frame header and scan data. */
export function jpegWith(width: number, height: number): Buffer {
  const seg = (marker: number, body: Buffer) => {
    const head = Buffer.from([0xff, marker, 0, 0]);
    head.writeUInt16BE(body.length + 2, 2);
    return Buffer.concat([head, body]);
  };
  const sof = Buffer.alloc(15);
  sof[0] = 8;
  sof.writeUInt16BE(height, 1);
  sof.writeUInt16BE(width, 3);
  sof[5] = 3;
  return Buffer.concat([
    Buffer.from([0xff, 0xd8]),
    seg(0xe0, Buffer.from("JFIF\0\x01\x01\0\0\x01\0\x01\0\0", "latin1")),
    seg(0xe1, Buffer.from("Exif\0\0GPSLatitude 52.5 secret-camera-serial", "latin1")),
    seg(0xe1, Buffer.from("http://ns.adobe.com/xap/1.0/\0<x:xmpmeta>owner@example.com</x:xmpmeta>", "latin1")),
    seg(0xed, Buffer.from("Photoshop 3.0\0IPTC author name", "latin1")),
    seg(0xfe, Buffer.from("a comment with a name", "latin1")),
    seg(0xe2, Buffer.from("ICC_PROFILE\0\x01\x01profiledata", "latin1")),
    seg(0xc0, sof),
    seg(0xda, Buffer.from([1, 1, 0, 0, 63, 0])),
    Buffer.from([0x12, 0x34, 0xff, 0x00, 0x56, 0xff, 0xd9]),
  ]);
}
