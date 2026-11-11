import { fileTypeFromBuffer } from 'file-type'

export type UploadKind = 'photo' | 'video'
export type UploadExt = 'jpg' | 'png' | 'webp' | 'mp4'

export const MAX_PHOTO_BYTES = 25 * 1024 * 1024
export const MAX_VIDEO_BYTES = 20 * 1024 * 1024

export const REASON_TYPE = 'This file type is not supported. Use JPEG, PNG or WebP photos, or MP4 video.'
export const REASON_PHOTO_SIZE = 'Photo is larger than 25 MB.'
export const REASON_VIDEO_SIZE = 'Video is larger than 20 MB.'

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
