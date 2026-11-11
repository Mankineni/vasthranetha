import { MAX_PHOTO_BYTES, MAX_VIDEO_BYTES, precheckUpload, REASON_PHOTO_SIZE, REASON_TYPE, REASON_VIDEO_SIZE } from '@/lib/media/limits'

const MB = 1024 * 1024

test.each([
  [{ type: 'image/jpeg', size: 5 * MB }, null],
  [{ type: 'image/png', size: MAX_PHOTO_BYTES }, null],
  [{ type: 'image/webp', size: MAX_PHOTO_BYTES + 1 }, REASON_PHOTO_SIZE],
  [{ type: 'video/mp4', size: MAX_VIDEO_BYTES }, null],
  [{ type: 'video/mp4', size: MAX_VIDEO_BYTES + 1 }, REASON_VIDEO_SIZE],
  [{ type: 'video/mp4', size: 80 * MB }, REASON_VIDEO_SIZE],
  [{ type: 'application/pdf', size: 1000 }, REASON_TYPE],
  [{ type: 'image/heic', size: 3 * MB }, REASON_TYPE],
  [{ type: 'video/quicktime', size: 3 * MB }, REASON_TYPE],
  // No type or a generic one: the server decides from the content.
  [{ type: '', size: 3 * MB }, null],
  [{ type: 'application/octet-stream', size: 3 * MB }, null],
  [{ type: '', size: 30 * MB }, REASON_PHOTO_SIZE],
])('precheckUpload(%j) → %s', (file, reason) => {
  expect(precheckUpload(file)).toBe(reason)
})
