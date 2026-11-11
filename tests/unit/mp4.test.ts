import { stripMp4Metadata } from '@/lib/media/mp4'
import { validateUpload } from '@/lib/media/validate'

/** One ISO BMFF box: 4-byte size, 4-byte type, payload. */
function box(type: string, ...payload: Buffer[]): Buffer {
  const body = Buffer.concat(payload)
  const head = Buffer.alloc(8)
  head.writeUInt32BE(8 + body.length, 0)
  head.write(type, 4, 'latin1')
  return Buffer.concat([head, body])
}

/** A box with a 64-bit size (size field 1, then the real size). */
function bigBox(type: string, payload: Buffer): Buffer {
  const head = Buffer.alloc(16)
  head.writeUInt32BE(1, 0)
  head.write(type, 4, 'latin1')
  head.writeBigUInt64BE(BigInt(16 + payload.length), 8)
  return Buffer.concat([head, payload])
}

const GPS = '+12.9716+077.5946/'
const ftyp = box('ftyp', Buffer.from('isom\0\0\x02\0isommp41', 'latin1'))
const location = box('\xa9xyz', Buffer.from(`\0\x12\x15\xc7${GPS}`, 'latin1'))
const make = box('\xa9mak', Buffer.from('\0\x07\x15\xc7Samsung', 'latin1'))
const appleKeys = box('meta', Buffer.alloc(4), box('keys', Buffer.from('com.apple.quicktime.location.ISO6709', 'latin1')))
const xmp = box('uuid', Buffer.from('be7acfcb97a942e89c71999491e3afac', 'hex'), Buffer.from(`<exif:GPSLatitude>${GPS}</exif:GPSLatitude>`, 'latin1'))
const trak = box('trak', box('tkhd', Buffer.alloc(84)), box('udta', box('\xa9xyz', Buffer.from(GPS, 'latin1'))), box('mdia', Buffer.alloc(32)))
const mvhd = box('mvhd', Buffer.alloc(100, 7))
const mdat = box('mdat', Buffer.alloc(256, 0xab))

test('removes location, device and XMP metadata but keeps every box size and the media bytes', () => {
  const file = Buffer.concat([ftyp, box('moov', mvhd, trak, box('udta', location, make), appleKeys), xmp, mdat])
  const out = stripMp4Metadata(file)
  expect(out.length).toBe(file.length)
  const text = out.toString('latin1')
  expect(text).not.toContain(GPS)
  expect(text).not.toContain('Samsung')
  expect(text).not.toContain('com.apple.quicktime.location')
  // Playback-relevant parts are untouched.
  expect(out.subarray(0, ftyp.length).equals(ftyp)).toBe(true)
  expect(out.includes(mvhd)).toBe(true)
  expect(out.subarray(out.length - mdat.length).equals(mdat)).toBe(true)
  expect(text).toContain('free')
})

test('handles the moov box after mdat (usual for phone recordings) and 64-bit sizes', async () => {
  const file = Buffer.concat([ftyp, bigBox('mdat', Buffer.alloc(300, 0xcd)), box('moov', mvhd, box('udta', location))])
  const out = stripMp4Metadata(file)
  expect(out.length).toBe(file.length)
  expect(out.toString('latin1')).not.toContain(GPS)
  expect(await validateUpload(out)).toMatchObject({ ok: true, kind: 'video' })
})

test('leaves a file without metadata byte-for-byte unchanged, and never throws on junk', () => {
  const clean = Buffer.concat([ftyp, box('moov', mvhd, box('trak', box('tkhd', Buffer.alloc(84)))), mdat])
  expect(stripMp4Metadata(clean).equals(clean)).toBe(true)
  const truncated = Buffer.concat([ftyp, box('moov', mvhd, box('udta', location))]).subarray(0, 60)
  expect(() => stripMp4Metadata(truncated)).not.toThrow()
  expect(() => stripMp4Metadata(Buffer.from('not an mp4 at all'))).not.toThrow()
})
