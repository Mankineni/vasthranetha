// Removes metadata from an MP4 without re-encoding it.
//
// Phones write the recording location (QuickTime ©xyz, Apple location keys, XMP GPS)
// and the device make and model into metadata boxes. Those boxes are not needed to play
// the video, so each one is turned into a "free" box of the same size and its contents
// are zeroed. Box sizes and all media offsets stay exactly the same, so players are not
// affected and the media data is never touched.

/** Box types that only carry metadata. */
const METADATA = new Set(['udta', 'meta', 'uuid'])
/** Containers whose children may include metadata boxes. */
const CONTAINERS = new Set(['moov', 'trak'])
const MAX_DEPTH = 4

function walk(buf: Buffer, start: number, end: number, depth: number): void {
  let pos = start
  while (pos + 8 <= end) {
    let size = buf.readUInt32BE(pos)
    const type = buf.toString('latin1', pos + 4, pos + 8)
    let header = 8
    if (size === 1) {
      if (pos + 16 > end) return
      const big = buf.readBigUInt64BE(pos + 8)
      if (big > BigInt(end - pos)) return
      size = Number(big)
      header = 16
    } else if (size === 0) {
      size = end - pos // box runs to the end of its parent
    }
    if (size < header || pos + size > end) return // malformed: leave the rest alone

    if (METADATA.has(type)) {
      buf.write('free', pos + 4, 'latin1')
      buf.fill(0, pos + header, pos + size)
    } else if (CONTAINERS.has(type) && depth < MAX_DEPTH) {
      walk(buf, pos + header, pos + size, depth + 1)
    }
    pos += size
  }
}

/** A copy of `input` with its metadata boxes blanked. Never throws; junk comes back unchanged. */
export function stripMp4Metadata(input: Buffer): Buffer {
  const out = Buffer.from(input)
  try {
    walk(out, 0, out.length, 0)
  } catch {
    return Buffer.from(input)
  }
  return out
}
