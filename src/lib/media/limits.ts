// Upload limits and their messages. Browser-safe, so the photo picker can check a file
// on the phone before sending it; the server checks again from the file's content.

export const MAX_PHOTO_BYTES = 25 * 1024 * 1024
export const MAX_VIDEO_BYTES = 20 * 1024 * 1024

export const REASON_TYPE = 'This file type is not supported. Use JPEG, PNG or WebP photos, or MP4 video.'
export const REASON_SITE_TYPE = 'Use a JPEG, PNG or WebP photo.'
export const REASON_PHOTO_SIZE = 'Photo is larger than 25 MB.'
export const REASON_VIDEO_SIZE = 'Video is larger than 20 MB.'
export const REASON_TOO_LARGE = 'This file is too large. Photos can be up to 25 MB and videos up to 20 MB.'

/** Types the picker offers in the file chooser. */
export const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'video/mp4']

/** Image formats the site cannot use. Other image/* names (image/jpg, image/pjpeg, ...) go to the server's content check. */
const UNSUPPORTED_IMAGES = new Set(['image/heic', 'image/heif', 'image/gif', 'image/avif', 'image/bmp', 'image/tiff', 'image/svg+xml'])

type FileLike = { type: string; size: number }

const knownType = (type: string) => type !== '' && type !== 'application/octet-stream'

/**
 * The refusal reason for a product photo or video the phone is about to send, or null
 * if it may be sent. Only refuses what is certain; the server decides from the content.
 */
export function precheckUpload(file: FileLike): string | null {
  const type = file.type.toLowerCase()
  if (!knownType(type)) return file.size > MAX_PHOTO_BYTES ? REASON_TOO_LARGE : null
  if (type.startsWith('video/')) {
    if (type !== 'video/mp4') return REASON_TYPE
    return file.size > MAX_VIDEO_BYTES ? REASON_VIDEO_SIZE : null
  }
  if (!type.startsWith('image/') || UNSUPPORTED_IMAGES.has(type)) return REASON_TYPE
  return file.size > MAX_PHOTO_BYTES ? REASON_PHOTO_SIZE : null
}

/** The same check for a logo, banner, customer photo or category tile (photos only). */
export function precheckSiteImage(file: FileLike): string | null {
  const type = file.type.toLowerCase()
  if (knownType(type) && (!type.startsWith('image/') || UNSUPPORTED_IMAGES.has(type))) return REASON_SITE_TYPE
  return file.size > MAX_PHOTO_BYTES ? REASON_PHOTO_SIZE : null
}
