'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { PublicPhoto } from '@/lib/catalogue/public'
import { largestVariant } from '@/lib/media/urls'

type Props = { photos: PublicPhoto[]; start: number; alt: string; onClose: () => void }
type View = { s: number; tx: number; ty: number }

const MAX_SCALE = 4
const TAP_ZOOM = 2.5
const FULL: View = { s: 1, tx: 0, ty: 0 }

/**
 * Full-screen photo viewer on the largest stored version. Pinch or double-tap
 * to zoom, drag to look around, swipe sideways to change photo.
 */
export function ZoomViewer({ photos, start, alt, onClose }: Props) {
  const [index, setIndex] = useState(start)
  const [view, setView] = useState<View>(FULL)
  const [loaded, setLoaded] = useState(false)
  const [dragging, setDragging] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const img = useRef<HTMLImageElement>(null)
  const closeBtn = useRef<HTMLButtonElement>(null)
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const gesture = useRef<{ dist: number; mid: { x: number; y: number }; view: View } | null>(null)
  const swipe = useRef<{ x: number; y: number; t: number } | null>(null)
  const lastTap = useRef<{ t: number; x: number; y: number } | null>(null)

  const photo = photos[index]
  const src = largestVariant(photo)

  const go = useCallback(
    (delta: number) => {
      setIndex((i) => (i + delta + photos.length) % photos.length)
      setView(FULL)
      setLoaded(false)
    },
    [photos.length],
  )

  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeBtn.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight') go(1)
      if (e.key === 'ArrowLeft') go(-1)
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = previous
      window.removeEventListener('keydown', onKey)
    }
  }, [go, onClose])

  /** Untransformed (scale 1) size of the photo inside the box; offset sizes ignore CSS transforms. */
  function fitted() {
    const r = box.current!.getBoundingClientRect()
    const el = img.current
    if (el && el.offsetWidth) return { r, w: el.offsetWidth, h: el.offsetHeight }
    const aspect = photo.width && photo.height ? photo.width / photo.height : 3 / 4
    const w = Math.min(r.width, r.height * aspect)
    return { r, w, h: w / aspect }
  }

  function clamp(v: View): View {
    const { r, w, h } = fitted()
    const s = Math.min(MAX_SCALE, Math.max(1, v.s))
    const maxX = Math.max(0, (w * s - r.width) / 2)
    const maxY = Math.max(0, (h * s - r.height) / 2)
    return { s, tx: Math.min(maxX, Math.max(-maxX, v.tx)), ty: Math.min(maxY, Math.max(-maxY, v.ty)) }
  }

  /** Zoom to scale s keeping the screen point (px, py) over the same spot of the photo. */
  function zoomAt(from: View, s: number, px: number, py: number): View {
    const { r } = fitted()
    const cx = r.left + r.width / 2
    const cy = r.top + r.height / 2
    const k = s / from.s
    return clamp({ s, tx: px - cx - k * (px - cx - from.tx), ty: py - cy - k * (py - cy - from.ty) })
  }

  const points = () => [...pointers.current.values()]
  const distance = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y)

  function onPointerDown(e: React.PointerEvent) {
    // Buttons inside the box (previous/next) handle their own clicks.
    if ((e.target as HTMLElement).closest('button')) return
    e.currentTarget.setPointerCapture(e.pointerId)
    setDragging(true)
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const p = points()
    if (p.length === 2) {
      gesture.current = { dist: distance(p[0], p[1]), mid: { x: (p[0].x + p[1].x) / 2, y: (p[0].y + p[1].y) / 2 }, view }
      swipe.current = null
    } else if (p.length === 1) {
      gesture.current = { dist: 0, mid: { x: e.clientX, y: e.clientY }, view }
      swipe.current = { x: e.clientX, y: e.clientY, t: Date.now() }
    }
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!pointers.current.has(e.pointerId)) return
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const g = gesture.current
    if (!g) return
    const p = points()
    if (p.length === 2 && g.dist > 0) {
      const mid = { x: (p[0].x + p[1].x) / 2, y: (p[0].y + p[1].y) / 2 }
      const zoomed = zoomAt(g.view, (g.view.s * distance(p[0], p[1])) / g.dist, g.mid.x, g.mid.y)
      setView(clamp({ ...zoomed, tx: zoomed.tx + mid.x - g.mid.x, ty: zoomed.ty + mid.y - g.mid.y }))
    } else if (p.length === 1 && g.view.s > 1) {
      setView(clamp({ ...g.view, tx: g.view.tx + e.clientX - g.mid.x, ty: g.view.ty + e.clientY - g.mid.y }))
    }
  }

  function onPointerUp(e: React.PointerEvent) {
    if (!pointers.current.delete(e.pointerId)) return
    const remaining = points()
    if (remaining.length === 1) {
      // One finger lifted from a pinch: continue as a drag from where the other finger is.
      gesture.current = { dist: 0, mid: remaining[0], view }
      return
    }
    gesture.current = null
    setDragging(false)
    if (e.type === 'pointercancel') return

    const sw = swipe.current
    swipe.current = null
    if (!sw) return
    const dx = e.clientX - sw.x
    const dy = e.clientY - sw.y
    const quick = Date.now() - sw.t < 500
    if (view.s === 1 && quick && Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) && photos.length > 1) {
      go(dx < 0 ? 1 : -1)
      return
    }
    if (Math.abs(dx) < 10 && Math.abs(dy) < 10) {
      const last = lastTap.current
      const now = Date.now()
      if (last && now - last.t < 300 && Math.hypot(e.clientX - last.x, e.clientY - last.y) < 30) {
        setView(view.s > 1 ? FULL : zoomAt(view, TAP_ZOOM, e.clientX, e.clientY))
        lastTap.current = null
      } else {
        lastTap.current = { t: now, x: e.clientX, y: e.clientY }
      }
    }
  }

  function onWheel(e: React.WheelEvent) {
    setView(zoomAt(view, view.s * (e.deltaY < 0 ? 1.15 : 1 / 1.15), e.clientX, e.clientY))
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${alt}, photo ${index + 1} of ${photos.length}`}
      data-testid="zoom-viewer"
      className="fixed inset-0 z-50 flex flex-col bg-black"
    >
      <div className="flex items-center justify-between px-3 py-2 text-sm text-white/80">
        <span>
          {index + 1} / {photos.length}
          <span className="ml-3 hidden sm:inline">Pinch or double-tap to zoom</span>
        </span>
        <button
          ref={closeBtn}
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="flex h-11 w-11 items-center justify-center rounded-full text-2xl text-white hover:bg-white/10"
        >
          ×
        </button>
      </div>
      <div
        ref={box}
        className="relative flex-1 overflow-hidden"
        style={{ touchAction: 'none' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={onWheel}
      >
        {!loaded && <p className="absolute inset-0 flex items-center justify-center text-sm text-white/60">Loading…</p>}
        {src && (
          // eslint-disable-next-line @next/next/no-img-element -- full-size stored variant for zooming
          <img
            ref={img}
            key={src}
            src={src}
            alt={alt}
            draggable={false}
            onLoad={() => setLoaded(true)}
            className="absolute inset-0 m-auto max-h-full max-w-full select-none object-contain"
            style={{
              transform: `translate(${view.tx}px, ${view.ty}px) scale(${view.s})`,
              transition: dragging ? 'none' : 'transform 120ms ease-out',
            }}
          />
        )}
        {photos.length > 1 && (
          <>
            <button
              type="button"
              aria-label="Previous photo"
              onClick={() => go(-1)}
              className="absolute left-2 top-1/2 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-2xl text-white sm:flex"
            >
              ‹
            </button>
            <button
              type="button"
              aria-label="Next photo"
              onClick={() => go(1)}
              className="absolute right-2 top-1/2 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-2xl text-white sm:flex"
            >
              ›
            </button>
          </>
        )}
      </div>
    </div>
  )
}
