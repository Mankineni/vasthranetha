'use client'

import { useRef, useState } from 'react'
import type { MediaItem } from '@/lib/catalogue/types'
import { mediaUrl, variantAtLeast } from '@/lib/media/urls'
import { ResponsiveImage } from './ResponsiveImage'
import { ZoomViewer } from './ZoomViewer'

type Props = { photos: MediaItem[]; video: MediaItem | null; name: string; sold: boolean }

/** Swipeable photos (CSS scroll-snap, no carousel library). Tap a photo to open the zoom viewer. */
export function Gallery({ photos, video, name, sold }: Props) {
  const [current, setCurrent] = useState(0)
  const [zoomAt, setZoomAt] = useState<number | null>(null)
  const track = useRef<HTMLDivElement>(null)
  const slides = photos.length + (video ? 1 : 0)

  function onScroll() {
    const el = track.current
    if (el) setCurrent(Math.round(el.scrollLeft / el.clientWidth))
  }

  function scrollTo(i: number) {
    const el = track.current
    if (el) el.scrollTo({ left: i * el.clientWidth, behavior: 'smooth' })
  }

  const poster = photos[0] ? variantAtLeast(photos[0], 960) : null

  return (
    <div className="relative">
      <div
        ref={track}
        onScroll={onScroll}
        data-testid="gallery"
        className="scroll-row flex snap-x snap-mandatory overflow-x-auto rounded-none bg-accent-soft sm:rounded-lg"
        aria-label={`${name} photos`}
      >
        {photos.map((m, i) => (
          <button
            key={m.id}
            type="button"
            onClick={() => setZoomAt(i)}
            aria-label={`Zoom photo ${i + 1} of ${photos.length}`}
            className="relative aspect-[3/4] w-full shrink-0 snap-center snap-always cursor-zoom-in"
          >
            <ResponsiveImage
              media={m}
              alt={i === 0 ? name : `${name}, photo ${i + 1}`}
              sizes="(min-width: 1024px) 55vw, 100vw"
              priority={i === 0}
              className={`h-full w-full object-cover ${sold ? 'opacity-70' : ''}`}
            />
          </button>
        ))}
        {video && (
          <div className="flex aspect-[3/4] w-full shrink-0 snap-center items-center bg-black">
            <video
              controls
              playsInline
              preload="metadata"
              poster={poster ?? undefined}
              className="h-full w-full object-contain"
              src={mediaUrl(video.originalPath)}
            >
              Your browser cannot play this video.
            </video>
          </div>
        )}
      </div>

      {slides > 1 && (
        <div className="mt-3 flex justify-center gap-1.5" aria-hidden>
          {Array.from({ length: slides }, (_, i) => (
            <button
              key={i}
              type="button"
              tabIndex={-1}
              onClick={() => scrollTo(i)}
              className={`h-1.5 rounded-full transition-all ${i === current ? 'w-5 bg-accent' : 'w-1.5 bg-line'}`}
            />
          ))}
        </div>
      )}

      {zoomAt !== null && (
        <ZoomViewer photos={photos} start={zoomAt} alt={name} onClose={() => setZoomAt(null)} />
      )}
    </div>
  )
}
