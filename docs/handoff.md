# Handover: Vastranetha store

Last updated 2026-11-12. Read this first when continuing in a new Claude Code session
(for example on the server). Then read the spec and the plan it points to.

## What this is

A phone-first online catalogue for a two-person saree and dress business that sells
through WhatsApp. Customers browse and order with one tap on WhatsApp; the owners add
products from Android phones, including by sharing photos from a WhatsApp chat into
the installed admin app.

- Spec (binding): `docs/superpowers/specs/2026-11-11-boutique-store-design.md`
- Build plan: `docs/superpowers/plans/2026-11-11-boutique-store.md`
- How to run and test: `README.md`
- Real-phone check list: `docs/android-share-check.md`

## Where things stand

- All 16 tasks of the build plan (spec build steps 1 to 4) are done on branch
  **`build/store`**. `master` holds only the spec and plan. Merge `build/store` into
  `master` when the owners are happy.
- Last full run: 216 unit tests, 95 browser tests (Playwright, Pixel 7 profile), lint
  and production build all green.
- A whole-branch code review was done, then two rounds of fixes (commits `cd4e732`
  and `483d9c9`). The first round was checked again by independent reviewers; the
  second round (`483d9c9`: video metadata stripping, exact-name media serving,
  offline-safe admin forms, Back on the edit page, band ids, legacy phone logins)
  has tests but has **not** had an independent review yet. Worth one before launch.
- Not built yet: **deployment** (spec build step 5). It needs its own plan.

## Decisions made after the spec

| Topic | Decision |
|---|---|
| Domain | `vastranetha.com`; the shop lives at **`studio.vastranetha.com`**. Send `vastranetha.com` and `www` there too. |
| Brand name on the site | Not confirmed: "Vastranetha" or "Vastranetha Studio". It is a setting (Admin → Settings), not code. |
| Rendering | Every public page is rendered per request from SQLite (`cacheComponents: false`, `dynamic = 'force-dynamic'`). Nothing is prerendered. |
| Share from WhatsApp | The admin service worker receives the share, keeps the files on the phone (Cache API) and the form uploads them. The server route `/admin/share` is the fallback. Manifest scope is `/admin`. |
| Photo originals | Kept on disk, never served (they carry GPS/EXIF). Only processed WebP sizes and a preview JPEG are public. Video metadata (location, device) is blanked at upload. `/media` serves only exact app-written file names. |
| "Fill for me" | Uses the Claude API, off unless `ANTHROPIC_API_KEY` is set. Default model `claude-opus-5-5` (about $1 per 100 products); `AUTOFILL_MODEL=claude-haiku-5-5` costs about $0.02 per 100. **The owners have not chosen yet.** The spec's cost line ("well under €1 per month") was left as approved. |

## The server (checked 2026-11-12)

Hetzner Cloud, Ubuntu 24.04, 2 vCPU, 4 GB RAM (2.6 GB available), 23 GB disk free,
Docker 29 and Compose v5.

Already running, as Compose project `app`:
- `app-app-1`: the owner's personal agent, on `127.0.0.1:3000`
- `app-caddy-1`: Caddy on ports **80 and 443** (admin API on `127.0.0.1:2019`)

`ufw` is inactive; both apps listen on 127.0.0.1 only. No server upgrade needed.

Deployment approach agreed in principle (to be written up as a plan):
1. The store runs as its own container on another local port, e.g. `127.0.0.1:3001`,
   with `data/` (SQLite file and media folder) on a host volume.
2. The existing Caddy gets one more site block: `studio.vastranetha.com` →
   `127.0.0.1:3001` (or the store container over a shared Docker network). Caddy
   gets the HTTPS certificate automatically. Do **not** add a second Caddy; it would
   clash on 80/443.
3. Cloudflare (free) in front for caching in India, if the owners move DNS there.
   With Cloudflare proxying, use "Full (strict)" TLS.
4. Environment: `DATABASE_PATH`, `MEDIA_DIR`, `SITE_URL=https://studio.vastranetha.com`,
   optional `ANTHROPIC_API_KEY`. Never set `AUTOFILL_FAKE` in production.
5. Create the two owners with `npm run create-owner -- --name "…" --login "…"`
   (inside the container). Reset a password with `--login "…" --reset`.
6. Daily cron: `npm run purge-uploads`. Nightly backup of the SQLite file and media
   folder off the server (Hetzner Storage Box or Object Storage), kept 30 days; test
   one restore. Switch on Hetzner backups.
7. Add a Hetzner Cloud firewall allowing only 22, 80, 443.
8. Once `studio.vastranetha.com` works over HTTPS, run `docs/android-share-check.md`
   on a real Android phone (install the admin app, share from WhatsApp).

Be careful not to disturb the personal agent or its Caddy config; back up the Caddyfile
before editing and reload Caddy rather than restarting the whole Compose project.

## Still needed from the owners

1. Brand name shown on the site, logo and colours (maroon and gold are placeholders;
   all colours are CSS variables in `src/app/globals.css`; icons via
   `npx tsx scripts/make-icons.ts`).
2. The new WhatsApp Business number.
3. Categories (with code letters), fabrics, occasions and price bands, or keep the samples.
4. Texts for About us, How to order, Shipping and returns, Contact.
5. 5 to 10 real product photos exactly as dealers send them (one with WhatsApp HD, one
   as a Document) to check image quality on real sarees.
6. "Fill for me": yes or no, which model, and an API key.
7. Where `vastranetha.com` is registered and whether DNS may move to Cloudflare.
8. GST registration (with their CA) and, later, payment gateway KYC for online checkout
   (spec section 10, not built).

## Known small gaps (deferred on purpose)

- The 30-second video limit is not enforced (only 20 MB).
- No drag-to-reorder for photos; "Make cover" and arrow buttons do it.
- A stray `%` in a `/media` URL gives 500 instead of 404.
- Low-res warning is not shown for photos arriving through the server share fallback.
- Shared photos are cleared from the phone before their uploads finish.
- Customer photos beyond 12 silently drop the oldest.
- Category/fabric/occasion names need at least one English letter or digit.
- `AUTOFILL_FAKE=1` is honoured in production builds (just never set it there).
- Offset paging can skip one item if a product is published mid-scroll.
- The server share fallback has no total size cap (owner-only).
- A password reset racing a sign-in already being checked can leave one old session.
- Sessions are a fixed 90 days, not sliding.
- Searching a bare number like `1042` matches names only (`S1042` works).

## Working on the server

- `npm ci`, then `npm test` (fast). The full browser suite (`npm run e2e`) builds the
  app and runs headless Chrome; on 2 vCPUs it is slow and competes with the personal
  agent, so run it sparingly. `npx playwright install --with-deps chromium` first.
- Next.js 16 differs from older versions: read `node_modules/next/dist/docs/` before
  changing framework code (see `AGENTS.md`).
- Rules that matter (also in `README.md`): dealer fields never reach public code
  (`src/lib/catalogue/public.ts` only); every admin action/handler checks the owner
  itself (`tests/unit/admin-guard.test.ts`); remove media files only via
  `deleteMediaRows`.
