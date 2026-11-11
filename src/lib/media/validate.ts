import { fileTypeFromBuffer } from 'file-type'
import { MAX_PHOTO_BYTES, MAX_VIDEO_BYTES, REASON_PHOTO_SIZE, REASON_TYPE, REASON_VIDEO_SIZE } from './limits'

export { MAX_PHOTO_BYTES, MAX_VIDEO_BYTES, REASON_PHOTO_SIZE, REASON_TYPE, REASON_VIDEO_SIZE } from './limits'

export type UploadKind = 'photo' | 'video'
export type UploadExt = 'jpg' | 'png' | 'webp' | 'mp4'

const KINDS: Record<string, { kind: UploadKind; ext: UploadExt }> = {
  jpg: { kind: 'photo', ext: 'jpg' },
  png: { kind: 'photo', ext: 'png' },
  webp: { kind: 'photo', ext: 'webp' },
  mp4: { kind: 'video', ext: 'mp4' },
}

/** Decides the file type from its content, never from its name. */
export async function validateUpload(
  buf: Buffer,
): Promise<{ ok: true; kind: UploadKind; ext: UploadExt } | { ok: false; reason: string }> {
  const detected = await fileTypeFromBuffer(buf)
  const match = detected && KINDS[detected.ext]
  if (!match) return { ok: false, reason: REASON_TYPE }
  if (match.kind === 'photo' && buf.length > MAX_PHOTO_BYTES) return { ok: false, reason: REASON_PHOTO_SIZE }
  if (match.kind === 'video' && buf.length > MAX_VIDEO_BYTES) return { ok: false, reason: REASON_VIDEO_SIZE }
  return { ok: true, ...match }
}
