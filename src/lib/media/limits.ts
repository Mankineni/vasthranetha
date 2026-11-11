// Upload limits and their messages. Browser-safe, so the photo picker can check a file
// on the phone before sending it; the server checks again from the file's content.

export const MAX_PHOTO_BYTES = 25 * 1024 * 1024
export const MAX_VIDEO_BYTES = 20 * 1024 * 1024

export const REASON_TYPE = 'This file type is not supported. Use JPEG, PNG or WebP photos, or MP4 video.'
export const REASON_PHOTO_SIZE = 'Photo is larger than 25 MB.'
export const REASON_VIDEO_SIZE = 'Video is larger than 20 MB.'
export const REASON_TOO_LARGE = 'This file is too large. Photos can be up to 25 MB and videos up to 20 MB.'

/** Types the picker accepts. Files with no type (or a generic one) are left for the server to judge. */
export const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'video/mp4']

/** The refusal reason for a file the phone is about to send, or null if it may be sent. */
export function precheckUpload(file: { type: string; size: number }): string | null {
  const type = file.type.toLowerCase()
  const known = type !== '' && type !== 'application/octet-stream'
  if (known && !ACCEPTED_TYPES.includes(type)) return REASON_TYPE
  if (type.startsWith('video/')) return file.size > MAX_VIDEO_BYTES ? REASON_VIDEO_SIZE : null
  return file.size > MAX_PHOTO_BYTES ? REASON_PHOTO_SIZE : null
}
