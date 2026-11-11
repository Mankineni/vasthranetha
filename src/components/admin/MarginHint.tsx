import { marginOf } from '@/lib/catalogue/form'
import { formatPrice } from '@/lib/format'

export function MarginHint({ price, dealerPrice }: { price: string; dealerPrice: string }) {
  const margin = marginOf(price, dealerPrice)
  if (margin === null) return null
  return (
    <p data-testid="margin" className={`mt-1 text-sm font-medium ${margin < 0 ? 'text-danger' : 'text-whatsapp'}`}>
      {margin < 0 ? `Loss: ${formatPrice(-margin)}` : `Your margin: ${formatPrice(margin)}`}
    </p>
  )
}
