'use client'

import { useState } from 'react'
import { buildOrderMessage, buildSimilarMessage, buildWhatsAppLink } from '@/lib/whatsapp/message'
import { WhatsAppIcon } from './WhatsAppIcon'

type Props = {
  number: string | null
  product: { name: string; code: string; price: number; sizes: string[]; colours: string[]; sold: boolean }
  /** Absolute address of this product page, included in the message. */
  url: string
}

function Choices({ label, values, value, onChange }: { label: string; values: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <fieldset className="mt-5">
      <legend className="mb-2 text-sm font-medium text-ink">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {values.map((v) => (
          <label key={v} className="cursor-pointer">
            <input
              type="radio"
              name={label}
              value={v}
              checked={value === v}
              onChange={() => onChange(v)}
              className="peer sr-only"
            />
            <span className="inline-block min-w-11 rounded-md border border-line bg-surface px-3 py-2 text-center text-sm text-ink peer-checked:border-accent peer-checked:bg-accent peer-checked:text-accent-ink peer-focus-visible:outline-2 peer-focus-visible:outline-accent">
              {v}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}

/** Size/colour choice and the WhatsApp order button. */
export function OrderPanel({ number, product, url }: Props) {
  const [size, setSize] = useState('')
  const [colour, setColour] = useState('')

  if (!number) {
    return <p className="mt-6 rounded-md bg-accent-soft px-4 py-3 text-sm text-ink">Ordering opens soon. Please check back.</p>
  }

  if (product.sold) {
    return (
      <a
        href={buildWhatsAppLink(number, buildSimilarMessage({ ...product, url }))}
        target="_blank"
        rel="noopener"
        className="mt-6 flex items-center justify-center gap-2 rounded-full border-2 border-whatsapp px-5 py-3.5 text-center font-medium text-whatsapp"
      >
        <WhatsAppIcon />
        Ask for something similar on WhatsApp
      </a>
    )
  }

  const missing = product.sizes.length > 0 && !size ? 'size' : product.colours.length > 0 && !colour ? 'colour' : null
  const href = buildWhatsAppLink(
    number,
    buildOrderMessage({ ...product, size: size || undefined, colour: colour || undefined, url }),
  )

  return (
    <div>
      {product.sizes.length > 0 && <Choices label="Size" values={product.sizes} value={size} onChange={setSize} />}
      {product.colours.length > 0 && (
        <Choices label="Colour" values={product.colours} value={colour} onChange={setColour} />
      )}
      {missing ? (
        <button
          type="button"
          disabled
          data-testid="order-button"
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-line px-5 py-3.5 font-medium text-muted"
        >
          Choose a {missing} to order
        </button>
      ) : (
        <a
          href={href}
          target="_blank"
          rel="noopener"
          data-testid="order-button"
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-whatsapp px-5 py-3.5 text-center font-medium text-white shadow-sm"
        >
          <WhatsAppIcon />
          Check availability &amp; order on WhatsApp
        </a>
      )}
      <p className="mt-2 text-center text-xs text-muted">We reply on WhatsApp to confirm availability and payment.</p>
    </div>
  )
}
