import sharp from 'sharp'

let seed = 0

/**
 * Builds a test image. Each call gets a slightly different colour so two
 * calls never produce identical bytes unless the caller reuses the buffer.
 */
export async function makeImage(opts: {
  width: number
  height: number
  format: 'jpeg' | 'png' | 'webp'
  orientation?: number
}): Promise<Buffer> {
  seed = (seed + 37) % 200
  let img = sharp({
    create: { width: opts.width, height: opts.height, channels: 3, background: { r: 120 + seed / 4, g: 20, b: 40 } },
  })
  if (opts.orientation) img = img.withMetadata({ orientation: opts.orientation })
  return img.toFormat(opts.format).toBuffer()
}

/** Pads a real file header out to `bytes` so it is detected as that type but exceeds a size limit. */
export function padTo(buf: Buffer, bytes: number): Buffer {
  return Buffer.concat([buf, Buffer.alloc(Math.max(0, bytes - buf.length))])
}

/** Minimal ISO-BMFF header that file-type recognises as MP4. */
export function mp4Header(): Buffer {
  const ftyp = Buffer.from([
    0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d, 0x00, 0x00, 0x02, 0x00, 0x69, 0x73, 0x6f,
    0x6d, 0x6d, 0x70, 0x34, 0x31,
  ])
  return Buffer.concat([ftyp, Buffer.alloc(64)])
}

/** Minimal HEIC header (ftypheic). */
export function heicHeader(): Buffer {
  const ftyp = Buffer.from([
    0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63, 0x00, 0x00, 0x00, 0x00, 0x6d, 0x69, 0x66,
    0x31, 0x68, 0x65, 0x69, 0x63,
  ])
  return Buffer.concat([ftyp, Buffer.alloc(64)])
}
