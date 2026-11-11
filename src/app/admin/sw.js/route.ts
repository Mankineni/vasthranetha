import { SERVICE_WORKER_SOURCE } from '@/lib/pwa/service-worker'

export function GET() {
  return new Response(SERVICE_WORKER_SOURCE, {
    headers: {
      'Content-Type': 'text/javascript; charset=utf-8',
      'Cache-Control': 'no-cache',
      // The script lives in /admin/ but controls /admin itself too.
      'Service-Worker-Allowed': '/admin',
    },
  })
}
