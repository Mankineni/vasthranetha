import { formatPrice } from '@/lib/format'

/** Collapse line breaks and repeated spaces so one value stays on one message line. */
function oneLine(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

/**
 * Accepts the ways people type an Indian mobile number and returns the
 * wa.me form (country code, no plus, no spaces), or null if it is not one.
 */
export function normaliseWhatsAppNumber(input: string): string | null {
  let digits = input.replace(/\D/g, '')
  if (digits.startsWith('0')) digits = digits.slice(1)
  if (digits.length === 10) digits = `91${digits}`
  return /^91\d{10}$/.test(digits) ? digits : null
}

export function buildOrderMessage(p: {
  name: string
  code: string
  price: number
  size?: string
  colour?: string
  url: string
}): string {
  const lines = ["Hi! I'd like to order this:", oneLine(p.name), `Code: ${p.code}`, `Price: ${formatPrice(p.price)}`]
  if (p.size) lines.push(`Size: ${oneLine(p.size)}`)
  if (p.colour) lines.push(`Colour: ${oneLine(p.colour)}`)
  lines.push(p.url)
  return lines.join('\n')
}

export function buildGreetingMessage(brandName: string): string {
  return `Hi! I have a question about ${oneLine(brandName)}.`
}

export function buildSimilarMessage(p: { name: string; code: string; url: string }): string {
  return ['Hi! This one is sold. Do you have something similar?', oneLine(p.name), `Code: ${p.code}`, p.url].join('\n')
}

export function buildWhatsAppLink(number: string, message: string): string {
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`
}
