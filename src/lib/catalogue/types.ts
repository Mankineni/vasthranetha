export type ProductStatus = 'draft' | 'available' | 'sold'

export type MediaItem = {
  id: number
  kind: 'photo' | 'video'
  originalPath: string
  width: number
  height: number
  variants: { width: number; path: string }[]
  previewPath: string | null
}

export type ProductInput = {
  name: string
  price: number
  categoryId: number
  fabricId: number | null
  occasionIds: number[]
  length: string
  blousePiece: boolean | null
  care: string
  description: string
  sizes: string[]
  colours: string[]
  dealerName: string
  dealerCode: string
  dealerPrice: number | null
  notes: string
  /** Photos then video, in display order. */
  mediaIds: number[]
  /** Random id generated when the form is opened; makes a double submit harmless. */
  submitToken: string
}

export type AdminProduct = Omit<ProductInput, 'mediaIds'> & {
  id: number
  code: string
  slug: string
  status: ProductStatus
  createdBy: number
  updatedBy: number
  publishedAt: number | null
  soldAt: number | null
  createdAt: number
  updatedAt: number
  media: MediaItem[]
}

export const MAX_PHOTOS = 12
export const MAX_VIDEOS = 1

/** Thrown by catalogue writes for problems the owner can fix; `message` is shown to them. */
export class ProductError extends Error {}
