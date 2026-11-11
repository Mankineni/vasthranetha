# Boutique store

A phone-first online catalogue for a saree and dress business that sells through
WhatsApp. Customers browse the site and order with one tap on WhatsApp; the two
owners add products from their Android phones, including by sharing photos
straight from a WhatsApp chat into the installed admin app.

- Design: [docs/superpowers/specs/2026-11-11-boutique-store-design.md](docs/superpowers/specs/2026-11-11-boutique-store-design.md)
- Build plan: [docs/superpowers/plans/2026-11-11-boutique-store.md](docs/superpowers/plans/2026-11-11-boutique-store.md)
- Real-phone check: [docs/android-share-check.md](docs/android-share-check.md)

## Stack

Next.js 16 (App Router, TypeScript, Tailwind), SQLite through better-sqlite3 and
Drizzle, sharp for images, argon2 for passwords, Vitest and Playwright for tests.
Everything runs in one Node process; the database is one file and photos live in
a folder on disk.

## Run it locally

Requires Node 22.

```bash
npm install
npm run seed                                   # sample catalogue (30 products, generated photos)
npm run create-owner -- --name "Asha" --login "asha@example.com"   # asks for a password
npm run dev                                    # http://localhost:3000, admin at /admin
```

`npm run seed` refuses to run on a database that already has products; add
`-- --force` to wipe the products and seed again.

## Settings

Copy `.env.example` to `.env.local` and adjust:

| Variable | Default | Meaning |
|---|---|---|
| `DATABASE_PATH` | `./data/store.db` | SQLite file (created on first run, migrations run automatically) |
| `MEDIA_DIR` | `./data/media` | Uploaded photos: originals plus display versions |
| `SITE_URL` | `http://localhost:3000` | Public address, used in WhatsApp messages, link previews and the sitemap. Session cookies are marked Secure when it starts with `https://` |
| `ANTHROPIC_API_KEY` | not set | Optional. Turns on "Fill for me" in the product form |
| `AUTOFILL_MODEL` | `claude-opus-5-5` | Optional. Model for "Fill for me"; `claude-haiku-5-5` costs far less per product |

Brand name, WhatsApp number, categories, price bands and page texts are edited
in the admin under **Settings**, not in code.

## Everyday commands

| Command | What it does |
|---|---|
| `npm test` | Unit and integration tests (Vitest, in-memory database) |
| `npm run e2e` | Browser tests on a Pixel 7 profile: seeds `data/e2e.db`, builds, starts the app on port 3100 and runs Playwright |
| `npm run lint` | ESLint |
| `npm run build` | Production build |
| `npm run purge-uploads` | Deletes photos uploaded but never saved to a product within 24 hours; run daily |
| `npx tsx scripts/make-icons.ts` | Regenerates the admin app icons in `public/icons` |

## Where things are

```
src/lib/            business logic, each unit taking the database as its first argument
  catalogue/        products, categories, codes; public.ts is the only module public pages may read from
  media/            upload checks, image processing, file storage, share handling
  auth/             passwords, sessions, sign-in lockout, owner guard
  settings/ stats/ autofill/ whatsapp/
src/app/(public)/   the shop
src/app/admin/      the owners' area (installable app, share target, settings)
scripts/            seed, create-owner, purge-uploads, e2e preparation
tests/unit/         Vitest
e2e/                Playwright
```

Rules worth knowing before changing code:

- Dealer fields (dealer name, dealer code, dealer price, notes) must never reach a public page or API. Public code reads only through `src/lib/catalogue/public.ts`; `e2e/privacy.spec.ts` checks every public page for them.
- Every admin server action and admin route handler checks the owner itself; `tests/unit/admin-guard.test.ts` fails if one does not.
- Media files can be shared between products. Remove them only through `deleteMediaRows` in `src/lib/media/store.ts`.

## Deployment

Not covered yet. Hosting on the Hetzner server (Docker, Caddy, Cloudflare,
backups) gets its own plan once the domain is chosen.
