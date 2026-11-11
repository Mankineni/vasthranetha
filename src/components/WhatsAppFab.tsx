import { buildGreetingMessage, buildWhatsAppLink } from '@/lib/whatsapp/message'
import { WhatsAppIcon } from './WhatsAppIcon'

/** Floating chat button on every public page. Renders nothing when no number is set. */
export function WhatsAppFab({ number, brandName }: { number: string | null; brandName: string }) {
  if (!number) return null
  return (
    <a
      href={buildWhatsAppLink(number, buildGreetingMessage(brandName))}
      target="_blank"
      rel="noopener"
      data-testid="whatsapp-fab"
      aria-label="Chat with us on WhatsApp"
      className="fixed z-40 flex h-14 w-14 items-center justify-center rounded-full bg-whatsapp text-white shadow-lg shadow-black/20"
      style={{ right: 16, bottom: 'calc(16px + env(safe-area-inset-bottom))' }}
    >
      <WhatsAppIcon size={28} />
    </a>
  )
}
