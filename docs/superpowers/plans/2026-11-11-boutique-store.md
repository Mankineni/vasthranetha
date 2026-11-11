# Boutique Online Store Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a phone-first saree and dress catalogue where customers order through WhatsApp and two owners publish products from their Android phones, including by sharing photos straight from WhatsApp.

**Architecture:** One Next.js app serves the public site and the `/admin` area. Business logic lives in small units under `src/lib/` that take a database handle as their first argument, so they are tested against an in-memory SQLite database; pages, server actions and route handlers only call those units. Photos are stored as untouched originals plus high-quality WebP display versions on local disk.

**Tech Stack:** Node 22, Next.js (latest, App Router, TypeScript), Tailwind CSS, SQLite via `better-sqlite3` + Drizzle ORM, `sharp`, `file-type`, `@node-rs/argon2`, `@anthropic-ai/sdk` (optional feature), Vitest, Playwright. Package manager: npm.

**Spec:** `docs/superpowers/specs/2026-11-11-boutique-store-design.md`. Read it before starting any task.

**Scope:** Spec build steps 1 to 4. Step 5 (Docker, Caddy, Cloudflare, backups) gets its own plan once the domain exists and the server check is done; Docker is not installed on the development machine.

## Global Constraints

- Phone-first: every public and admin screen must work at 360 px width with no horizontal scroll.
- Prices are whole rupees stored as integers and displayed as `₹1,850` (Indian digit grouping via `Intl.NumberFormat('en-IN')`).
- Dealer fields (`dealerName`, `dealerCode`, `dealerPrice`, `notes`) never appear in any public page, page data or public API response. Public code may import only from `src/lib/catalogue/public.ts`, never from `admin.ts`.
- Every server action and route handler under `/admin` calls `requireOwner()` itself. The admin layout check alone is not enough.
- No brand name, domain or phone number in code. They come from settings or environment variables. Default brand name in the seed is `Boutique`.
- Units in `src/lib/*` take `db: Db` as first parameter and never call `getDb()` themselves. Only `src/app/**` and `scripts/**` call `getDb()`.
- Environment variables: `DATABASE_PATH` (default `./data/store.db`), `MEDIA_DIR` (default `./data/media`), `SITE_URL` (default `http://localhost:3000`), `ANTHROPIC_API_KEY` (optional). `data/` is git-ignored.
- Photo display widths are exactly 480, 960, 1600, 2400 px on the long side, WebP quality 90. Photos are never enlarged. Originals are always kept.
- Upload limits: photos JPEG/PNG/WebP up to 25 MB each, max 12 per product; video MP4 up to 20 MB, one per product. Type is detected from file content.
- Listings page size is 24. Session length is 90 days. Sign-in lockout is 5 failures per login per 15 minutes. Unattached uploads are purged after 24 hours. Default sold-visibility window is 7 days.
- After any change to products, taxonomy, settings or pages, call `refreshPublicSite()` so cached public pages update.
- TDD: write the failing test first, see it fail, implement, see it pass, commit. Commit after every task at minimum.
- Before using a Next.js API you are not certain about (caching, `revalidatePath`, route handlers, metadata, manifest), read the docs for the installed version in `node_modules/next/dist/docs/` or the official site. Do not rely on memory.

## Review Focus

Inputs the spec implies but does not spell out. Each has a test in the task named.

1. **Files a phone really sends** (HEIC photo, PDF, a 40 MB image, a `.jpg` that is really a PNG): each bad file is rejected with a clear reason, and the other files in the same share still upload. Task 5 and Task 12.
2. **Product names with emoji, Telugu or Hindi text, `&`, `#`, line breaks**: the slug falls back sensibly, the page loads, and the WhatsApp message arrives intact. Task 2 and Task 4.
3. **WhatsApp number typed the way people type it** (`+91 98765 43210`, `098765 43210`, `9876543210`): normalised to `919876543210`; anything else is rejected in settings. Task 2 and Task 3.
4. **Both owners saving at the same moment, or a double-tap on Publish**: no two products ever share a code, and a double submit creates one product. Task 4 and Task 10.
5. **Old or altered links** (right code with an outdated name part, upper-case code, code of a draft or deleted product): the first two redirect to the current address, the last two show the not-found page. Task 8.

---

## File Structure

```
src/
  db/
    schema.ts            Drizzle tables
    client.ts            getDb(), openDb(path), type Db
    migrate.ts           runMigrations(db)
  lib/
    format.ts            formatPrice()
    whatsapp/message.ts  order message + link + number normalising
    settings/settings.ts brand settings
    settings/pages.ts    content pages
    catalogue/
      types.ts           shared types
      taxonomy.ts        categories, fabrics, occasions, price bands
      codes.ts           product code generation, slugify, parseProductPath
      admin.ts           owner-side product CRUD (includes dealer fields)
      public.ts          customer-side reads (no dealer fields)
    media/
      validate.ts        content-based type and size checks
      process.ts         sharp pipeline
      store.ts           save/delete files and media rows, purge orphans
    auth/
      password.ts        hash/verify
      sessions.ts        create/lookup/delete session, lockout
      guard.ts           requireOwner(), getOwner()
    stats/stats.ts       event counters and admin summary
    autofill/autofill.ts dealer text to suggested fields
    refresh.ts           refreshPublicSite()
  app/
    (public)/            layout, home, listings, product, content pages, search
    admin/               login, home, products, settings, share
    media/[...path]/route.ts   serves files from MEDIA_DIR
    api/event/route.ts   records view / order tap
    manifest.ts, sitemap.ts, robots.ts, not-found.tsx
  components/            shared UI (ProductCard, Gallery, OrderButton, ...)
scripts/
  create-owner.ts        npm run create-owner
  seed.ts                npm run seed
  purge-uploads.ts       npm run purge-uploads
tests/
  helpers/db.ts          createTestDb()
  helpers/images.ts      makeImage({width,height,format})
  unit/**                Vitest
e2e/                     Playwright
```

---

### Task 1: Project scaffold, database and test harness

**Files:**
- Create: project root via `npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm` (answer No to anything else it asks)
- Create: `src/db/schema.ts`, `src/db/client.ts`, `src/db/migrate.ts`, `drizzle.config.ts`, `vitest.config.ts`, `tests/helpers/db.ts`, `tests/unit/db.test.ts`, `.env.example`
- Modify: `package.json` (scripts), `.gitignore` (add `data/`, `.env`)

**Interfaces:**
- Produces:
  - `type Db` (Drizzle better-sqlite3 database typed with the schema)
  - `openDb(path: string): Db` (enables `foreign_keys` and WAL), `getDb(): Db` (singleton from `DATABASE_PATH`, runs migrations on first use)
  - `runMigrations(db: Db): void`
  - `createTestDb(): Db` (in-memory, migrated)
  - npm scripts: `test` = `vitest run`, `db:generate` = `drizzle-kit generate`, `create-owner`, `seed`, `purge-uploads` (the last three run with `tsx`)
  - Tables and columns below. All ids are integer autoincrement; all timestamps are integer epoch milliseconds.

| Table | Columns |
|---|---|
| `users` | `id`, `name`, `login` (unique, lower-cased), `passwordHash` |
| `sessions` | `tokenHash` (PK), `userId` → users, `expiresAt` |
| `login_attempts` | `id`, `login`, `at` |
| `categories` | `id`, `name`, `slug` (unique), `codePrefix` (1 to 3 upper-case letters), `tileImage` (nullable path), `position` |
| `fabrics`, `occasions` | `id`, `name`, `slug` (unique) |
| `price_bands` | `id`, `label`, `min`, `max` (nullable = no upper limit), `position` |
| `products` | `id`, `code` (unique), `slug`, `name`, `price`, `status` (`draft`/`available`/`sold`), `categoryId` → categories, `fabricId` (nullable) → fabrics, `length`, `blousePiece` (nullable boolean), `care`, `description`, `sizes` (JSON string array), `colours` (JSON string array), `dealerName`, `dealerCode`, `dealerPrice` (nullable int), `notes`, `submitToken` (nullable, unique), `createdBy`, `updatedBy` → users, `publishedAt` (nullable), `soldAt` (nullable), `createdAt`, `updatedAt` |
| `product_occasions` | `productId` → products (cascade delete), `occasionId` → occasions, PK on both |
| `media` | `id`, `productId` (nullable) → products, `batchId` (nullable text), `kind` (`photo`/`video`), `position`, `originalPath`, `width`, `height`, `variants` (JSON array of `{width, path}`), `createdAt` |
| `settings` | `key` (PK), `value` (JSON text) |
| `pages` | `slug` (PK), `title`, `body` |
| `events` | `productId` → products (cascade delete), `type` (`view`/`order_tap`), `day` (`YYYY-MM-DD`), `count`; PK on (`productId`, `type`, `day`) |

- [ ] **Step 1: Scaffold.** Run the `create-next-app` command above in the repo root (the `docs/` folder stays). Install: `npm i better-sqlite3 drizzle-orm sharp file-type @node-rs/argon2` and `npm i -D drizzle-kit vitest tsx @types/better-sqlite3`. Run `npm run dev`, confirm the default page loads at http://localhost:3000, stop it.

- [ ] **Step 2: Write the failing test** `tests/unit/db.test.ts`:

```ts
import { createTestDb } from '../helpers/db'
import { products, categories } from '@/db/schema'

test('migrated database accepts a category and a product', () => {
  const db = createTestDb()
  const [cat] = db.insert(categories).values({ name: 'Sarees', slug: 'sarees', codePrefix: 'S', position: 0 }).returning().all()
  // insert one user first, then one product with required fields only
  // expect select().from(products) to return 1 row with status 'draft' by default
})

test('two products cannot share a code', () => { /* second insert with same code throws */ })
test('deleting a product removes its product_occasions and events rows', () => {})
```

- [ ] **Step 3: Run** `npm test`. Expected: FAIL, modules not found.

- [ ] **Step 4: Implement** `schema.ts` from the table above, `client.ts`, `migrate.ts` (Drizzle migrator reading `./drizzle`), `tests/helpers/db.ts`, `vitest.config.ts` (alias `@` → `src`, environment `node`). Run `npm run db:generate` to create the first migration.

- [ ] **Step 5: Run** `npm test`. Expected: 3 passed.

- [ ] **Step 6: Commit** `chore: scaffold app, database schema and test harness`.

---

### Task 2: WhatsApp message builder and price format

**Files:**
- Create: `src/lib/whatsapp/message.ts`, `src/lib/format.ts`
- Test: `tests/unit/whatsapp.test.ts`, `tests/unit/format.test.ts`

**Interfaces:**
- Produces:
  - `formatPrice(rupees: number): string` → `'₹1,850'`, `'₹1,25,000'`
  - `normaliseWhatsAppNumber(input: string): string | null`
  - `buildOrderMessage(p: { name: string; code: string; price: number; size?: string; colour?: string; url: string }): string`
  - `buildGreetingMessage(brandName: string): string` → `Hi! I have a question about <brandName>.`
  - `buildSimilarMessage(p: { name: string; code: string; url: string }): string` (for sold products; first line `Hi! This one is sold. Do you have something similar?`, then name, `Code: …`, url)
  - `buildWhatsAppLink(number: string, message: string): string` → `https://wa.me/<number>?text=<encodeURIComponent(message)>`

- [ ] **Step 1: Write the failing tests.**

```ts
test('order message matches the spec layout', () => {
  expect(buildOrderMessage({ name: 'Maroon Soft Silk', code: 'S-1042', price: 1850, url: 'https://x.test/p/s-1042-maroon-soft-silk' }))
    .toBe("Hi! I'd like to order this:\nMaroon Soft Silk\nCode: S-1042\nPrice: ₹1,850\nhttps://x.test/p/s-1042-maroon-soft-silk")
})
test('size and colour lines appear only when given, size before colour', () => {
  // with size 'M', colour 'Teal' → lines 'Size: M' and 'Colour: Teal' sit between Price and the link
})
test('name with emoji, Telugu text, & and # survives the link round trip', () => {
  const msg = buildOrderMessage({ name: 'పట్టు చీర 🌸 Red & Gold #1', code: 'S-1', price: 999, url: 'https://x.test/p/s-1' })
  const link = buildWhatsAppLink('919876543210', msg)
  expect(new URL(link).searchParams.get('text')).toBe(msg)
})
test('a line break inside a product name is flattened to a space', () => {})
test.each([
  ['+91 98765 43210', '919876543210'],
  ['098765 43210', '919876543210'],
  ['9876543210', '919876543210'],
  ['919876543210', '919876543210'],
  ['12345', null], ['', null], ['abc', null],
])('normaliseWhatsAppNumber(%s) → %s', (input, out) => { expect(normaliseWhatsAppNumber(input)).toBe(out) })
test('formatPrice uses Indian grouping', () => { expect(formatPrice(125000)).toBe('₹1,25,000') })
```

- [ ] **Step 2: Run** `npm test -- whatsapp format`. Expected: FAIL.
- [ ] **Step 3: Implement.** Number rule: strip everything but digits; drop one leading `0`; a 10-digit result gets `91` prefixed; accept only a final 12-digit number starting `91`, otherwise `null`.
- [ ] **Step 4: Run** the tests. Expected: PASS.
- [ ] **Step 5: Commit** `feat: whatsapp order message and price formatting`.

---

### Task 3: Settings and content pages units

**Files:**
- Create: `src/lib/settings/settings.ts`, `src/lib/settings/pages.ts`
- Test: `tests/unit/settings.test.ts`

**Interfaces:**
- Consumes: `Db`, `normaliseWhatsAppNumber`
- Produces:
  - `type Settings = { brandName: string; tagline: string; logo: string | null; banner: string | null; whatsappNumber: string | null; soldVisibleDays: number; customerPhotos: string[] }`
  - `getSettings(db): Settings` with defaults `{ brandName: 'Boutique', tagline: '', logo: null, banner: null, whatsappNumber: null, soldVisibleDays: 7, customerPhotos: [] }`
  - `updateSettings(db, patch: Partial<Settings>): { ok: true } | { ok: false; error: string }`
  - `PAGE_SLUGS = ['about', 'how-to-order', 'shipping-returns', 'contact'] as const`
  - `getPage(db, slug): { slug; title; body } | null`, `savePage(db, slug, { title, body }): void`. Body is plain text; a blank line separates paragraphs.

- [ ] **Step 1: Write the failing tests:** defaults returned from an empty database; a patch changes only the given keys; `whatsappNumber: '+91 98765 43210'` is stored as `'919876543210'`; `whatsappNumber: '12345'` returns `{ ok: false }` and stores nothing; `soldVisibleDays` outside 0 to 90 is rejected; `savePage` with a slug not in `PAGE_SLUGS` throws; `getPage` of an unsaved slug returns `null`.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** `feat: settings and content pages units`.

---

### Task 4: Catalogue, owner side (taxonomy, codes, product CRUD)

**Files:**
- Create: `src/lib/catalogue/types.ts`, `taxonomy.ts`, `codes.ts`, `admin.ts`
- Test: `tests/unit/taxonomy.test.ts`, `tests/unit/codes.test.ts`, `tests/unit/catalogue-admin.test.ts`

**Interfaces:**
- Consumes: `Db`
- Produces:

```ts
// codes.ts
slugify(text: string): string                    // lower-case ASCII letters/digits joined by '-', max 60 chars; '' if nothing usable
productPath(p: { code: string; slug: string }): string   // '/p/s-1042-maroon-soft-silk', or '/p/s-1042' when slug is ''
parseProductPath(segment: string): { code: string } | null  // 's-1042-anything' → { code: 'S-1042' }; regex ^([a-z]{1,3})-(\d+)(-.*)?$ case-insensitive
nextCode(db: Db, categoryId: number): string     // '<prefix>-<n>'; n is one global counter starting at 1001, stored in settings key 'nextCodeNumber'

// taxonomy.ts  (each list function returns rows ordered by position, then name)
listCategories(db), createCategory(db, { name, codePrefix }), updateCategory(db, id, patch), deleteCategory(db, id)
listFabrics(db), createFabric(db, name), deleteFabric(db, id)
listOccasions(db), createOccasion(db, name), deleteOccasion(db, id)
listPriceBands(db), savePriceBands(db, bands: { label: string; min: number; max: number | null }[])
// delete* returns { ok: false, error: 'in use' } when any product references the row

// types.ts
type ProductStatus = 'draft' | 'available' | 'sold'
type ProductInput = {
  name: string; price: number; categoryId: number; fabricId: number | null; occasionIds: number[];
  length: string; blousePiece: boolean | null; care: string; description: string;
  sizes: string[]; colours: string[];
  dealerName: string; dealerCode: string; dealerPrice: number | null; notes: string;
  mediaIds: number[]            // photos then video, in display order
  submitToken: string           // random id generated when the form is opened
}
type AdminProduct = ProductInput & { id: number; code: string; slug: string; status: ProductStatus;
  createdBy: number; updatedBy: number; publishedAt: number | null; soldAt: number | null; media: MediaItem[] }
type MediaItem = { id: number; kind: 'photo' | 'video'; originalPath: string; width: number; height: number; variants: { width: number; path: string }[] }

// admin.ts
validateProductInput(input: ProductInput, publish: boolean): string[]   // list of error messages, empty when valid
createProduct(db, input, userId, opts: { publish: boolean; now: number }): AdminProduct
updateProduct(db, id, input, userId, now): AdminProduct
setStatus(db, id, status: ProductStatus, userId, now): void
duplicateProduct(db, id, userId, now): AdminProduct     // new code, status draft, no media, name + ' (copy)'
deleteProduct(db, id): string[]                          // returns file paths of its media for the caller to remove
getAdminProduct(db, id): AdminProduct | null
listAdminProducts(db, f: { q?: string; status?: ProductStatus }): AdminProduct[]   // newest first; q matches name (contains) or code (exact), case-insensitive
```

- [ ] **Step 1: Write the failing tests.** Required cases:
  - `slugify('Maroon Soft Silk!')` → `'maroon-soft-silk'`; `slugify('పట్టు చీర 🌸')` → `''`; `slugify('Red & Gold #1')` → `'red-gold-1'`.
  - `parseProductPath('s-1042-maroon')`, `('S-1042')`, `('s-1042-')` → `{ code: 'S-1042' }`; `('hello')`, `('s1042')`, `('')` → `null`.
  - `nextCode` returns `S-1001` then `D-1002` for categories with prefixes `S` and `D`.
  - **Review Focus 4:** 200 `createProduct` calls in a loop across two categories produce 200 distinct codes; calling `createProduct` twice with the same `submitToken` returns the same product and leaves one row.
  - Validation: name empty, price not a positive whole number, unknown category, more than 12 photos, more than one video, zero photos when `publish` is true → each yields an error; a draft with zero photos is valid.
  - `createProduct` with `publish: true` sets status `available` and `publishedAt = now`; with `false` sets `draft` and `publishedAt` null.
  - `createProduct` attaches the listed media rows (sets `productId`, `position` by order, clears `batchId`); `updateProduct` detaches media no longer listed (returns them to unattached state so the purge removes them).
  - `setStatus('sold')` sets `soldAt = now`; back to `available` clears `soldAt`; first move from `draft` to `available` sets `publishedAt`.
  - `updateProduct` never changes `code`; it does update `slug` when the name changes.
  - `duplicateProduct` copies every field except code, media, status, `submitToken`.
  - `deleteCategory` on a category with a product returns `{ ok: false, error: 'in use' }`.
  - `listAdminProducts({ q: 's-1001' })` finds by code; `{ q: 'silk' }` finds by name; `{ status: 'sold' }` filters.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.** `nextCode` and the product insert run inside one `db.transaction` so the counter cannot be read twice.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** `feat: catalogue owner-side unit`.

---

### Task 5: Media unit

**Files:**
- Create: `src/lib/media/validate.ts`, `process.ts`, `store.ts`, `src/app/media/[...path]/route.ts`, `scripts/purge-uploads.ts`, `tests/helpers/images.ts`
- Test: `tests/unit/media.test.ts`

**Interfaces:**
- Consumes: `Db`, `MediaItem`
- Produces:

```ts
// validate.ts
type UploadKind = 'photo' | 'video'
validateUpload(buf: Buffer): Promise<{ ok: true; kind: UploadKind; ext: 'jpg' | 'png' | 'webp' | 'mp4' } | { ok: false; reason: string }>
// reasons, exact text: 'This file type is not supported. Use JPEG, PNG or WebP photos, or MP4 video.'
//                      'Photo is larger than 25 MB.'   'Video is larger than 20 MB.'

// process.ts
const DISPLAY_WIDTHS = [480, 960, 1600, 2400]
const LOW_RES_LIMIT = 1200
processPhoto(buf: Buffer): Promise<{ width: number; height: number; variants: { width: number; data: Buffer }[] }>
// width/height are after auto-orientation. "width" of a variant means its long side.

// store.ts
savePhoto(db, buf: Buffer, opts: { batchId: string; mediaDir: string; now: number }): Promise<MediaItem & { lowRes: boolean }>
saveVideo(db, buf: Buffer, opts: { batchId: string; mediaDir: string; now: number }): Promise<MediaItem>
saveSiteImage(buf: Buffer, mediaDir: string): Promise<{ path: string; variants: { width: number; path: string }[] }>  // logo, banner, tiles, customer photos; no media row
listBatch(db, batchId: string): MediaItem[]
removeFiles(paths: string[], mediaDir: string): Promise<void>      // ignores files already missing
purgeUnattached(db, mediaDir: string, now: number): Promise<number> // media with productId null and createdAt older than 24 h; returns count
mediaUrl(path: string): string                                      // '/media/' + path
```

- Stored paths are relative to `mediaDir`: `<first 2 hex of sha256>/<sha256>-orig.<ext>` and `<sha256>-<width>.webp`.
- `tests/helpers/images.ts`: `makeImage({ width, height, format: 'jpeg' | 'png' | 'webp', orientation?: number }): Promise<Buffer>` built with sharp.

- [ ] **Step 1: Write the failing tests.** Use a temp directory per test. Required cases:
  - A 3000×4000 JPEG yields variants with long sides `[480, 960, 1600, 2400]`, each a WebP, each keeping the 3:4 ratio.
  - A 1280×960 JPEG yields `[480, 960, 1280]`: listed widths up to the original size, plus one at the original's own long side. Nothing larger than the original is produced.
  - A 300×400 PNG yields exactly `[400]`.
  - A JPEG with EXIF orientation 6 comes out rotated: reported `width`/`height` are swapped relative to the raw pixel size.
  - `savePhoto` writes the original byte-for-byte (compare buffers) and returns `lowRes: true` for long side 1199, `false` for 1200.
  - Saving the same bytes twice produces two media rows pointing at the same files, and deleting one row's product does not break the other (files are removed only when no row references them: put this rule in `removeFiles`' caller, `deleteProduct` flow in Task 10, and test it there).
  - **Review Focus 1:** `validateUpload` rejects a PDF buffer, a HEIC header, and a text file named as JPEG with the "not supported" reason; rejects a 26 MB JPEG and a 21 MB MP4 with the size reasons; accepts a PNG whatever its file name was.
  - `purgeUnattached` removes a 25-hour-old unattached row and its files, keeps a 23-hour-old one, keeps attached rows of any age.
  - Route handler: `GET /media/<path>` returns the file with `Cache-Control: public, max-age=31536000, immutable` and the right `Content-Type`; a path containing `..` returns 404; a missing file returns 404.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.** sharp pipeline per variant: `sharp(buf).rotate().resize({ width: w, height: w, fit: 'inside', withoutEnlargement: true }).toColourspace('srgb').webp({ quality: 90 })`. Variant list: every entry of `DISPLAY_WIDTHS` that is ≤ the long side, plus the long side itself when it is below 2400 and not already listed. `scripts/purge-uploads.ts` calls `purgeUnattached` with `Date.now()` and prints the count.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** `feat: media validation, processing and storage`.

---

### Task 6: Catalogue, customer side

**Files:**
- Create: `src/lib/catalogue/public.ts`
- Test: `tests/unit/catalogue-public.test.ts`

**Interfaces:**
- Consumes: `Db`, `createProduct`, `setStatus`, taxonomy functions, `getSettings`
- Produces:

```ts
type PublicCard = { code: string; path: string; name: string; price: number; sold: boolean; cover: MediaItem | null }
type PublicProduct = PublicCard & {
  category: { name: string; slug: string }; fabric: { name: string; slug: string } | null;
  occasions: { name: string; slug: string }[];
  length: string; blousePiece: boolean | null; care: string; description: string;
  sizes: string[]; colours: string[]; photos: MediaItem[]; video: MediaItem | null; publishedAt: number
}
type ListQuery = { categorySlug?: string; fabricSlug?: string; occasionSlug?: string; priceBandId?: number;
  q?: string; sort?: 'newest' | 'price-asc' | 'price-desc'; offset?: number; limit?: number; now: number }
listPublicProducts(db, query: ListQuery): { items: PublicCard[]; total: number }   // limit default 24, max 48
getPublicProduct(db, code: string): PublicProduct | null     // code match is case-insensitive
relatedProducts(db, code: string, limit?: number): PublicCard[]  // same category, status available, excluding itself, newest first, default 8
```

- [ ] **Step 1: Write the failing tests.** Required cases:
  - Drafts never appear in `listPublicProducts`, `getPublicProduct` or `relatedProducts`.
  - A product sold 6 days ago is listed with `sold: true`; sold 8 days ago is not listed; with `soldVisibleDays: 0` a just-sold product is not listed. `getPublicProduct` still returns the 8-day-old sold product.
  - Each filter narrows correctly, and filters combine (category + fabric + price band).
  - Price band `{ min: 1000, max: 2499 }` includes prices 1000 and 2499, excludes 999 and 2500; a band with `max: null` has no upper limit.
  - `q: 'silk'` matches names containing it in any case; `q: 's-1001'` matches the code.
  - Sort orders: `newest` by `publishedAt` descending; the two price orders; ties broken by newest.
  - `offset: 24` on 30 products returns 6 items and `total: 30`.
  - **Dealer fields:** create a product with `dealerName: 'ZZDEALER'`, `dealerCode: 'ZZCODE'`, `dealerPrice: 777123`, `notes: 'ZZNOTE'`; `JSON.stringify` of the results of all three functions contains none of `ZZDEALER`, `ZZCODE`, `777123`, `ZZNOTE`, `dealer`, `notes`.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.** Select columns explicitly; never spread a full product row into a result.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** `feat: catalogue customer-side reads`.

---

### Task 7: Seed data, public layout, home and listing pages

**Files:**
- Create: `scripts/seed.ts`, `src/lib/refresh.ts`, `src/app/(public)/layout.tsx`, `src/app/(public)/page.tsx`, `src/app/(public)/c/[slug]/page.tsx`, `src/app/(public)/price/[id]/page.tsx`, `src/app/(public)/new/page.tsx`, `src/app/(public)/search/page.tsx`, `src/app/(public)/[page]/page.tsx`, `src/app/api/products/route.ts`, `src/components/{Header,Footer,WhatsAppFab,ProductCard,ProductGrid,FilterBar,ResponsiveImage}.tsx`, `playwright.config.ts`, `e2e/browse.spec.ts`
- Modify: `src/app/globals.css` (theme variables), `src/app/layout.tsx`, `package.json` (script `e2e`)
- Delete: the scaffold's default home page content

**Interfaces:**
- Consumes: everything from Tasks 2 to 6
- Produces:
  - `refreshPublicSite(): void` → `revalidatePath('/', 'layout')`
  - `GET /api/products?<ListQuery fields as query params>` → `{ items: PublicCard[]; total: number }` (used for "load more")
  - `<ResponsiveImage media={MediaItem} sizes="…" alt="…" priority? />` renders a plain `<img>` with `srcset` built from `variants` and `width`/`height` attributes set. Do not use `next/image`; the variants already exist.
  - `<ProductCard card={PublicCard} />`, `<ProductGrid initial={…} query={…} />` (client component; loads 24 more when the end of the list scrolls into view)
  - Routes: `/` home, `/new` all new arrivals, `/c/<categorySlug>`, `/price/<bandId>`, `/search?q=`, `/<about|how-to-order|shipping-returns|contact>`
  - Filter and sort state lives in the query string: `?fabric=<slug>&occasion=<slug>&band=<id>&sort=<newest|price-asc|price-desc>`
  - Seed: categories Sarees (`S`) and Dresses (`D`); fabrics Soft silk, Cotton, Georgette, Chiffon, Banarasi, Linen; occasions Wedding, Festive, Office, Daily wear, Party; price bands `Under ₹999` (0 to 999), `₹1,000 to ₹2,499`, `₹2,500 and above` (max null); 30 products (20 sarees, 10 dresses with sizes S to XL), three of them sold (one 10 days ago), two drafts; the four content pages with placeholder text; `whatsappNumber: '919999999999'`. Product photos are generated with sharp (2 to 4 per product, 1800×2400, solid colour with a simple woven-stripe pattern and the product name drawn on), then stored through `savePhoto`. The seed refuses to run when the products table is not empty unless `--force` is passed.

**Design direction** (logo and colours are an open item; keep everything swappable through CSS variables in `globals.css`): warm off-white background, deep maroon accent, one serif display font for headings and one clean sans for text via `next/font/google`. Photos dominate: 3:4 tiles, small text, generous spacing. The fixed WhatsApp button uses WhatsApp green and sits bottom-right above the safe area.

- [ ] **Step 1: Install Playwright** (`npm i -D @playwright/test`, `npx playwright install chromium`). Configure `playwright.config.ts`: `webServer` runs `npm run build && npm run start` with `DATABASE_PATH=./data/e2e.db MEDIA_DIR=./data/e2e-media`, a `globalSetup` that deletes those and runs the seed, one project using the `Pixel 7` device.

- [ ] **Step 2: Write the failing e2e test** `e2e/browse.spec.ts`:
  - Home shows the brand name, at least 8 product cards under "New arrivals", both category tiles, three price band links, the three "how ordering works" steps.
  - Home has no horizontal scroll at the Pixel 7 viewport (`document.documentElement.scrollWidth <= clientWidth`).
  - Tapping "Sarees" opens `/c/sarees` showing 24 cards; scrolling to the bottom loads more.
  - Choosing fabric "Cotton" changes the URL to include `fabric=cotton` and every remaining card is a cotton product (assert on count against the seed).
  - Sort "Price: low to high" puts the cheapest seeded saree first.
  - A sold product seeded 2 days ago shows a "Sold" label; the one sold 10 days ago is absent; drafts are absent.
  - `/search?q=<a seeded code>` shows exactly that product.
  - `/about` shows the seeded About text; the fixed WhatsApp button's `href` starts with `https://wa.me/919999999999?text=`.
- [ ] **Step 3: Run** `npm run e2e`. Expected: FAIL.
- [ ] **Step 4: Implement** the seed, layout, components and pages. The home sections follow spec 3.1 in that order. When `whatsappNumber` is null, render no WhatsApp button anywhere.
- [ ] **Step 5: Run** `npm run seed` then `npm run dev` and look at `/`, `/c/sarees`, `/search` at 360 px and at desktop width. Fix anything that looks broken.
- [ ] **Step 6: Run** `npm run e2e` and `npm test`. Expected: PASS.
- [ ] **Step 7: Commit** `feat: public home, listings, search and content pages with seed data`.

---

### Task 8: Product page, sharing metadata, sitemap

**Files:**
- Create: `src/app/(public)/p/[slug]/page.tsx`, `src/components/{Gallery,ZoomViewer,OptionPicker,OrderButton,ShareButton}.tsx`, `src/app/sitemap.ts`, `src/app/robots.ts`, `src/app/not-found.tsx`, `e2e/product.spec.ts`

**Interfaces:**
- Consumes: `getPublicProduct`, `relatedProducts`, `parseProductPath`, `productPath`, `buildOrderMessage`, `buildSimilarMessage`, `buildWhatsAppLink`, `getSettings`, `ResponsiveImage`, `SITE_URL`
- Produces: the product page at `/p/<code>-<slug>`; `<OrderButton product={…} number={…} siteUrl={…} />` (client component holding chosen size and colour, with `data-testid="order-button"`).

- [ ] **Step 1: Write the failing e2e test** `e2e/product.spec.ts`:
  - A seeded saree page shows name, formatted price, code, fabric, and all its photos in the gallery; empty detail fields render no label.
  - The order button `href`, decoded, equals `buildOrderMessage` output for that product with `url` = `SITE_URL` + its path.
  - On a seeded dress, the order button is disabled until a size is picked; after picking `M` the decoded message contains the line `Size: M`.
  - Tapping a photo opens the full-screen viewer, whose image `src` is the largest variant; closing returns to the page.
  - A sold product shows "Sold", has no order button, and has a link with text "Ask for something similar on WhatsApp".
  - "More like this" lists up to 8 products, none sold, none the current product.
  - **Review Focus 5:** `/p/<code>-wrong-name` and `/p/<CODE IN UPPER CASE>` both end on the canonical path (permanent redirect); the path of a draft's code and `/p/s-999999` return status 404 and show a link to `/new`.
  - The page `<head>` has `og:title` = product name, `og:image` = absolute URL of the cover's 960-wide variant (or its largest when smaller), `og:description` containing the formatted price, and a JSON-LD `Product` block with `sku` = code, `offers.priceCurrency` = `INR`, `offers.availability` = `InStock` or `SoldOut`.
  - `/sitemap.xml` lists the home page, every category page and every available product, and no draft.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.** Gallery uses CSS scroll-snap for swiping (no carousel library). The zoom viewer supports pinch and double-tap zoom on the 2400 variant. Video renders as `<video controls playsinline preload="metadata" poster=…>` after the photos. `ShareButton` uses `navigator.share` and falls back to copying the link.
- [ ] **Step 4: Run** `npm run e2e`. Expected: PASS. Check the page by eye at 360 px.
- [ ] **Step 5: Commit** `feat: product page with WhatsApp ordering, previews and sitemap`.

**Milestone: this is the first version to show the partners (spec build step 1).**

---

### Task 9: Sign-in and owner guard

**Files:**
- Create: `src/lib/auth/password.ts`, `sessions.ts`, `guard.ts`, `scripts/create-owner.ts`, `src/app/admin/login/page.tsx`, `src/app/admin/login/actions.ts`, `src/app/admin/(app)/layout.tsx`, `src/app/admin/(app)/page.tsx` (placeholder heading "Admin"), `src/app/admin/(app)/logout/route.ts`
- Test: `tests/unit/auth.test.ts`, `e2e/auth.spec.ts`

**Interfaces:**
- Consumes: `Db`
- Produces:

```ts
hashPassword(plain: string): Promise<string>;  verifyPassword(hash: string, plain: string): Promise<boolean>
createOwner(db, { name, login, password }): Promise<{ id: number }>        // login lower-cased and trimmed; throws on duplicate; password min 10 chars
signIn(db, login: string, password: string, now: number): Promise<{ ok: true; token: string; expiresAt: number } | { ok: false; reason: 'invalid' | 'locked' }>
getSessionUser(db, token: string | undefined, now: number): { id: number; name: string } | null
signOut(db, token: string): void
const SESSION_COOKIE = 'bq_session'
// guard.ts (Next-specific, uses cookies() and getDb())
getOwner(): Promise<{ id: number; name: string } | null>
requireOwner(): Promise<{ id: number; name: string }>      // redirects to /admin/login when absent
```

- Cookie: `httpOnly`, `sameSite: 'lax'`, `secure` in production, `path: '/'`, expiry 90 days. The database stores `sha256(token)`, never the token.
- `npm run create-owner -- --name "…" --login "…"` prompts for the password without echo.

- [ ] **Step 1: Write the failing unit tests:** correct password signs in; wrong password and unknown login both return `invalid`; the 6th attempt within 15 minutes after 5 failures returns `locked` even with the right password; after 15 minutes it works again; a successful sign-in does not clear another login's failures; a session is valid at 89 days and `null` at 91; `signOut` invalidates it; the `sessions` table never contains the raw token; login match is case-insensitive.
- [ ] **Step 2: Write the failing e2e test:** `/admin` and `/admin/products` redirect to `/admin/login` when signed out; signing in with an owner created in `globalSetup` (`owner@test.local` / `correct-horse-battery`) lands on `/admin`; a wrong password shows "Wrong login or password."; after logout `/admin` redirects again; `/admin/login` responds with `Cache-Control` containing `no-store`.
- [ ] **Step 3: Run both.** Expected: FAIL.
- [ ] **Step 4: Implement.** The `(app)` layout calls `requireOwner()` and sets `export const dynamic = 'force-dynamic'`. Add `<meta name="robots" content="noindex">` to all admin pages and `Disallow: /admin` to `robots.ts`.
- [ ] **Step 5: Run** `npm test` and `npm run e2e`. Expected: PASS.
- [ ] **Step 6: Commit** `feat: owner sign-in, sessions and admin guard`.

---

### Task 10: Admin product form and upload

**Files:**
- Create: `src/app/admin/(app)/products/new/page.tsx`, `src/app/admin/(app)/products/[id]/page.tsx`, `src/app/admin/(app)/products/actions.ts`, `src/app/admin/upload/route.ts`, `src/components/admin/{ProductForm,PhotoPicker,MarginHint,ChipInput}.tsx`, `tests/fixtures/` (three JPEGs made with `makeImage`: `big.jpg` 2000×2600, `small.jpg` 800×1000, plus `not-an-image.pdf`)
- Test: `tests/unit/product-actions.test.ts`, `e2e/admin-product.spec.ts`

**Interfaces:**
- Consumes: `requireOwner`, `validateUpload`, `savePhoto`, `saveVideo`, `listBatch`, `removeFiles`, `createProduct`, `updateProduct`, `getAdminProduct`, `validateProductInput`, taxonomy lists, `refreshPublicSite`
- Produces:
  - `POST /admin/upload` (multipart: one `file`, one `batchId`) → `200 { media: MediaItem; lowRes: boolean }` or `400 { error: string }` (the `validateUpload` reason) or `401`.
  - Server actions `saveProduct(formData): Promise<{ errors: string[] } | never>` (redirects to `/admin/products` on success) and `removeProduct(id)`.
  - `deleteProductAndFiles(db, id, mediaDir): Promise<void>` in `actions.ts`' helper module `src/lib/catalogue/remove.ts`: deletes the product, then removes only files no other media row references.
  - `/admin/products/new?batch=<id>` opens the form with that batch's uploads already shown (used by Task 12). Without `batch`, the page generates a new batch id.
  - Form field `data-testid`s: `name`, `price`, `category`, `dealer-price`, `margin`, `publish`, `save-draft`, `photo-input`, `photo-<index>`, `lowres-warning`.

- [ ] **Step 1: Write the failing unit tests** for `deleteProductAndFiles`: files are removed from disk; when two media rows share the same files (same bytes uploaded twice, attached to two products), deleting one product keeps the files and deleting the second removes them.
- [ ] **Step 2: Write the failing e2e test** (signed in as the test owner):
  - Add product: choose `big.jpg` and `small.jpg`; both thumbnails appear; `lowres-warning` is visible for the second only. Fill name "Test Teal Cotton", price 1450, category Sarees, dealer price 1100; `margin` shows `₹350`. Tap Publish. The list page shows it; the public page `/p/<its code>…` shows name, price and two photos, and its HTML does not contain `1100`.
  - Dragging is not needed in the test: a "Make cover" control on a photo moves it first; after saving, the public cover is that photo.
  - **Review Focus 1:** choosing `big.jpg` and `not-an-image.pdf` together shows the "not supported" message next to the PDF with a Remove control, while `big.jpg` uploads normally and the form can still be published.
  - Publish with no photo shows "Add at least one photo." and stays on the form with the typed values intact.
  - Save as draft with only a name, price and category succeeds; the product is absent from the public site.
  - **Review Focus 4:** double-clicking Publish creates exactly one product.
  - Edit: change the price; the public page shows the new price after a reload (proves `refreshPublicSite`).
  - `POST /admin/upload` without a session returns 401.
- [ ] **Step 3: Run.** Expected: FAIL.
- [ ] **Step 4: Implement.** Each chosen file uploads on its own request with a per-file progress state (uploading, done, failed with Retry and Remove); a failure never clears other fields. The form carries a hidden `submitToken` generated on page load and the ordered `mediaIds`. The Publish and Save buttons disable while the action runs. Photo reordering: drag handle plus "Make cover" and left/right buttons (touch drag is unreliable; the buttons are the dependable path). Private dealer fields sit in a section titled "Private (only you see this)". Inputs use `inputMode="numeric"` for prices.
- [ ] **Step 5: Run** `npm test` and `npm run e2e`. Expected: PASS. Try the form by hand at 360 px.
- [ ] **Step 6: Commit** `feat: admin product form with photo upload`.

---

### Task 11: Admin product list and one-tap actions

**Files:**
- Create: `src/app/admin/(app)/products/page.tsx`, `src/components/admin/{ProductRow,StatusTabs}.tsx`
- Modify: `src/app/admin/(app)/products/actions.ts` (add `markSold`, `markAvailable`, `duplicate`), `src/app/admin/(app)/layout.tsx` (bottom navigation: Home, Products, Add, Settings)
- Test: `e2e/admin-list.spec.ts`

**Interfaces:**
- Consumes: `listAdminProducts`, `setStatus`, `duplicateProduct`, `deleteProductAndFiles`, `productPath`, `refreshPublicSite`
- Produces: `/admin/products?status=<available|sold|draft>&q=<text>`; row `data-testid="row-<code>"` with controls `mark-sold`, `mark-available`, `edit`, `duplicate`, `delete`, `copy-link`, `share`.

- [ ] **Step 1: Write the failing e2e test:** the list shows cover, name, code, price and status for seeded products; the Sold tab shows only sold ones; searching a code shows one row; Mark sold on an available product makes its public page show "Sold", and Mark available again restores the order button; Duplicate opens the edit form of a new draft named "<name> (copy)" with no photos and a different code; Delete asks "Delete this product? This cannot be undone." and after confirming the row is gone and the public path returns 404; Copy link puts the absolute public URL on the clipboard.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.** Share uses `navigator.share({ title, url })`, falling back to copy.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** `feat: admin product list with status actions`.

**Milestone: spec build step 2 complete.**

---

### Task 12: Installable admin app and share from WhatsApp

**Files:**
- Create: `src/app/manifest.ts`, `src/app/admin/share/route.ts`, `public/sw.js`, `public/icons/{icon-192,icon-512,icon-maskable-512}.png` (generated with sharp from a simple maroon monogram), `src/components/admin/RegisterServiceWorker.tsx`
- Modify: `src/app/admin/(app)/layout.tsx` (register the service worker)
- Test: `tests/unit/share-route.test.ts`, `e2e/share.spec.ts`

**Interfaces:**
- Consumes: `getOwner`, `validateUpload`, `savePhoto`, `saveVideo`
- Produces:
  - Manifest: `name` and `short_name` from settings brand name + " Admin", `start_url: '/admin'`, `scope: '/'`, `display: 'standalone'`, the three icons, and

    ```json
    "share_target": { "action": "/admin/share", "method": "POST", "enctype": "multipart/form-data",
      "params": { "files": [{ "name": "files", "accept": ["image/*", "video/mp4"] }] } }
    ```
  - `POST /admin/share`: with a session, saves every valid file under a new batch id and responds `303` to `/admin/products/new?batch=<id>&rejected=<n>` (`rejected` only when n > 0); without a session responds `303` to `/admin/login?next=share`.
  - `public/sw.js`: a minimal service worker with a `fetch` listener that passes requests through (needed for installability). No offline caching.

- [ ] **Step 1: Write the failing tests.**
  - Unit (call the route handler function directly with a `FormData` request and a stubbed owner): three valid images → 303 with a `batch` param, and `listBatch` returns 3 items in the order sent; **Review Focus 1:** two images plus a PDF → 2 items and `rejected=1`; more than 12 photos → first 12 kept, rest counted as rejected; no session → redirect to login and nothing stored.
  - e2e: `/manifest.webmanifest` contains the `share_target` block above; a multipart POST to `/admin/share` from a signed-in browser context with `big.jpg` lands on the new-product form showing one photo; with `rejected=1` the form shows "1 file could not be used (unsupported type or too large)."; the login page with `next=share` shows "Please sign in, then share the photos again."
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.** Check the installed Next.js docs for the manifest file convention and whether extra keys such as `share_target` pass through its type; if the typed route rejects it, serve the manifest from a route handler at `src/app/manifest.webmanifest/route.ts` instead and link it in the root layout.
- [ ] **Step 4: Run** `npm test` and `npm run e2e`. Expected: PASS.
- [ ] **Step 5: Write** `docs/android-share-check.md`: the manual check for a real phone (open the site over HTTPS, install from Chrome's menu, share 3 photos from a WhatsApp chat, confirm the form opens with them, publish, paste the product link into a chat and confirm the preview shows). This check runs after deployment, since install and share need HTTPS on a real domain.
- [ ] **Step 6: Commit** `feat: installable admin app and share target`.

**Milestone: spec build step 3 complete (real-phone check pending deployment).**

---

### Task 13: Admin settings, taxonomy and content pages

**Files:**
- Create: `src/app/admin/(app)/settings/page.tsx`, `settings/actions.ts`, `settings/{brand,lists,pages}/page.tsx`, `src/components/admin/{ImageField,ListEditor,PriceBandEditor}.tsx`
- Test: `e2e/admin-settings.spec.ts`

**Interfaces:**
- Consumes: `getSettings`, `updateSettings`, taxonomy functions, `getPage`, `savePage`, `saveSiteImage`, `refreshPublicSite`, `requireOwner`
- Produces: settings screens for every item in spec 4.5.

- [ ] **Step 1: Write the failing e2e test:** changing the brand name and tagline changes the public header; uploading a banner shows it on the home page; entering `98765 43210` as the WhatsApp number saves, and the public order link then starts `https://wa.me/919876543210`; entering `12345` shows "Enter a valid Indian mobile number." and keeps the old number; clearing the number hides all WhatsApp buttons on the public site and (after Task 14) is flagged on the admin home; adding category "Kurtis" with prefix `K` adds a tile on the home page and an option in the product form; deleting "Sarees" shows "Sarees is used by products and cannot be deleted."; adding a fabric makes it appear in the public filter; replacing the price bands changes the home page bands; setting sold-visible days to 0 removes a product sold 2 days ago from listings; editing the About text changes `/about`; adding a customer photo shows it on the home page.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.** Category prefix input accepts 1 to 3 letters and upper-cases them; a duplicate category or list name shows an error.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** `feat: admin settings, lists and content pages`.

---

### Task 14: Statistics and admin home

**Files:**
- Create: `src/lib/stats/stats.ts`, `src/app/api/event/route.ts`, `src/components/TrackView.tsx`
- Modify: `src/app/(public)/p/[slug]/page.tsx` (mount `TrackView`), `src/components/OrderButton.tsx` (send tap), `src/app/admin/(app)/page.tsx`
- Test: `tests/unit/stats.test.ts`, `e2e/stats.spec.ts`

**Interfaces:**
- Consumes: `Db`, `getSettings`
- Produces:

```ts
isBot(userAgent: string | null): boolean        // true for null/empty and for anything matching /bot|crawl|spider|slurp|preview|facebookexternalhit|whatsapp/i
recordEvent(db, code: string, type: 'view' | 'order_tap', now: number, userAgent: string | null): boolean  // false when ignored (bot, unknown code, draft)
type Summary = { live: number; addedThisWeek: number; soldThisWeek: number;
  topViewed: { code: string; name: string; count: number }[]; topOrderTaps: { code: string; name: string; count: number }[] }
getSummary(db, now: number): Summary     // "this week" = the last 7 days including today; top lists hold up to 10, highest first
```

- `POST /api/event` body `{ code: string; type: 'view' | 'order_tap' }` → always `204`. The day is computed in `Asia/Kolkata`. Sent from the browser with `navigator.sendBeacon`, so it works on cached pages. Sets no cookie.

- [ ] **Step 1: Write the failing unit tests:** two views on the same day make one row with `count: 2`; a view at 23:50 UTC is counted on the next day's date in India; a bot user agent and a draft's code are ignored; `getSummary` counts live products, products with `publishedAt` in the last 7 days, products with `soldAt` in the last 7 days; events 8 days old do not count in the top lists; top lists are ordered by count and capped at 10.
- [ ] **Step 2: Write the failing e2e test:** open a product page twice and tap the order button once (intercept the `wa.me` navigation); the admin home then shows that product in "Most viewed" with 2 and in "Most order taps" with 1; the response to `/api/event` has no `Set-Cookie`; with the WhatsApp number cleared, the admin home shows "WhatsApp number is not set. Order buttons are hidden."
- [ ] **Step 3: Run.** Expected: FAIL.
- [ ] **Step 4: Implement.**
- [ ] **Step 5: Run** `npm test` and `npm run e2e`. Expected: PASS.
- [ ] **Step 6: Commit** `feat: view and order-tap statistics on admin home`.

---

### Task 15: "Fill for me"

**Files:**
- Create: `src/lib/autofill/autofill.ts`, `src/app/admin/autofill/route.ts`
- Modify: `src/components/admin/ProductForm.tsx`
- Test: `tests/unit/autofill.test.ts`, addition to `e2e/admin-product.spec.ts`

**Interfaces:**
- Consumes: `requireOwner`, fabrics list
- Produces:

```ts
type Suggestion = { name?: string; fabric?: string; length?: string; blousePiece?: boolean; description?: string; dealerPrice?: number }
type AutofillClient = (text: string, fabricNames: string[]) => Promise<unknown>     // returns the model's raw structured output
isAutofillEnabled(): boolean                                   // true when ANTHROPIC_API_KEY is set
parseSuggestion(raw: unknown, fabricNames: string[]): Suggestion   // keeps only known keys with the right types; fabric kept only if it matches a known fabric name, case-insensitive
suggestFields(text: string, fabricNames: string[], client: AutofillClient): Promise<{ ok: true; suggestion: Suggestion } | { ok: false }>
applySuggestion(current: FormValues, s: Suggestion): FormValues    // fills only empty fields; never touches the selling price
```

- `POST /admin/autofill` body `{ text: string }` → `200 { suggestion }`, `503` when disabled or failed, `401` without session. Input text is capped at 2,000 characters.
- Real client: `@anthropic-ai/sdk`, model `claude-haiku-5-5`, forced tool call with a JSON schema matching `Suggestion`, 10-second timeout. **Before writing it, load the `claude-api` skill and follow its current guidance for model id, tool use and timeouts.** The system prompt tells the model the text is a saree or dress dealer's message, that any price in it is the dealer's price, and that it must not invent details absent from the text.

- [ ] **Step 1: Write the failing unit tests** (stub client, no network): for stub output `{ name: 'Soft Silk Saree', fabric: 'soft silk', length: '6.3 m', blousePiece: true, dealerPrice: 1850, price: 2500, extra: 'x' }` the suggestion keeps `fabric: 'Soft silk'` (the stored spelling), keeps `dealerPrice`, and drops `price` and `extra`; an unknown fabric is dropped; wrong types are dropped; a client that throws or exceeds the timeout gives `{ ok: false }`; `applySuggestion` leaves a non-empty name alone, fills an empty description, and never sets the selling price.
- [ ] **Step 2: Add the failing e2e cases:** with no API key the "Fill for me" button and paste box are absent; with `AUTOFILL_FAKE=1` in the e2e environment (the route then uses a built-in stub client returning a fixed suggestion) pasting text and tapping the button fills the empty name and dealer price and leaves a pre-typed description unchanged.
- [ ] **Step 3: Run.** Expected: FAIL.
- [ ] **Step 4: Implement.** `npm i @anthropic-ai/sdk`. On failure the form shows "Could not read that message. Please fill the fields yourself." and stays editable.
- [ ] **Step 5: Run** `npm test` and `npm run e2e`. Expected: PASS.
- [ ] **Step 6: Commit** `feat: optional dealer-message autofill`.

**Milestone: spec build step 4 complete.**

---

### Task 16: Whole-app checks

**Files:**
- Create: `e2e/privacy.spec.ts`, `e2e/journey.spec.ts`, `README.md`
- Modify: whatever the checks show to be broken

- [ ] **Step 1: Write** `e2e/privacy.spec.ts`: as an owner, create a product with dealer name `ZZDEALER`, dealer code `ZZCODE`, dealer price `777123`, notes `ZZNOTE`. Signed out, fetch `/`, `/new`, its category page, its product page, `/search?q=<code>`, `/api/products`, `/sitemap.xml`; none of the response bodies contains any of the four values. Fetch every `/admin/...` page path and `POST` every admin route handler (`/admin/upload`, `/admin/share`, `/admin/autofill`) signed out; each redirects to login or returns 401.
- [ ] **Step 2: Write** `e2e/journey.spec.ts`: one end-to-end run of spec section 7's owner and customer journeys (sign in, add with two photos, publish, find it under New arrivals, open it, order link correct, mark sold, public page shows Sold).
- [ ] **Step 3: Run** `npm test`, `npm run e2e`, `npm run lint`, `npm run build`. Expected: all pass with no warnings about dynamic server usage on public pages.
- [ ] **Step 4: Measure** the built home page and a product page with Chrome's Lighthouse (mobile preset) against `npm run start`. Target: performance 90 or above, no image without `width`/`height`, largest contentful paint image marked `priority`. Fix what misses.
- [ ] **Step 5: Write** `README.md`: what the project is, how to run it locally (`npm i`, `npm run seed`, `npm run create-owner`, `npm run dev`), the environment variables, the test commands, and that deployment is covered by a separate plan.
- [ ] **Step 6: Commit** `test: privacy and full-journey checks, readme`.

---

## Not in this plan

- Deployment (Docker Compose, Caddy, Cloudflare, backups, restore test, scheduled `purge-uploads`, real-phone share check): separate plan, needs the domain and the server check.
- Checkout, payments, orders, customer accounts (spec section 10).
