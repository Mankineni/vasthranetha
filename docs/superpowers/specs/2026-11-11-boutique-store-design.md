# Boutique online store: design

Date: 2026-11-11
Status: awaiting review

## 1. Purpose

Two partners sell sarees and dresses in India as sub-dealers. Today the whole business runs in WhatsApp: a customer picks a design, the partner orders it from the main dealer, the dealer ships it to the customer, and the customer pays the partner. They hold no stock and have no shop.

They want their own website so the business can grow beyond WhatsApp groups. The website is a catalogue: customers browse there and still place the order in WhatsApp. Online payment on the site may come later.

Success means:

- A customer on a phone in India can browse new arrivals quickly and reach the partners on WhatsApp with one tap, with the product already named in the message.
- Either partner can put a new product online from her Android phone in about a minute, starting from the photos a dealer sent her on WhatsApp.
- Photos look as good as the source allows. Image quality is the top selling point and takes priority over saving disk space.

## 2. Decisions already made

| Topic | Decision |
|---|---|
| Ordering at launch | Catalogue plus "order on WhatsApp". No cart, no payment on the site. |
| Later direction | Cart and online payment may be added. The design must allow this without a rebuild. |
| WhatsApp number | One shared WhatsApp Business number, new for the website. Entered in settings. |
| Stock | None held. A product is "Available" until a partner marks it "Sold". No quantities. |
| Catalogue size | Small (under about 200 live products) but changing daily. |
| Owners' phones | Android. |
| Build approach | Custom-built app, not a shop engine or CMS. |
| Hosting | Existing Hetzner server in Europe (2 vCPU, 4 GB RAM, 40 GB disk), shared with a personal agent. Cloudflare in front. |
| Brand name and domain | Not chosen yet. Both are settings, not built into the code. |

## 3. What customers see

The site is designed for phones first and must stay fast on mobile data.

### 3.1 Home page

1. Brand name, logo and one line about the business.
2. Banner image (set in admin).
3. New arrivals, newest first.
4. Category tiles (Sarees, Dresses, and any others the partners create).
5. Shop by price: bands set by the partners, for example under ₹999, ₹1,000 to ₹2,499, ₹2,500 and above.
6. How ordering works, in three steps.
7. Shipping and returns in brief, with a link to the full page.
8. A few customer photos (uploaded by the partners).

A WhatsApp button stays fixed at the bottom of every page. Outside a product page it opens the chat with a general greeting.

### 3.2 Listing pages

- One listing page per category, per price band, and one for all new arrivals.
- Photo grid, two columns on phones, more on wider screens.
- Filters: category, fabric, occasion, price band.
- Sorting: newest (default), price low to high, price high to low.
- Each tile shows the cover photo, name, price, and a "Sold" label if sold.
- More products load as the customer scrolls, 24 at a time.

### 3.3 Product page

- Swipeable photos. Tapping a photo opens a full-screen view that can be zoomed.
- Optional short video.
- Name, price in rupees, product code.
- Details: fabric, length, blouse piece included or not, care instructions, free-text description. Empty fields are not shown.
- Size and colour choices, only when the product has them.
- Main button: **Check availability & order on WhatsApp**.
- Share button (uses the phone's share menu).
- "More like this": up to eight available products from the same category.

### 3.4 The WhatsApp order message

The order button opens `https://wa.me/<business number>?text=<message>`. The message is:

```
Hi! I'd like to order this:
<Product name>
Code: <code>
Price: ₹<price>
Size: <size>          (only if chosen)
Colour: <colour>      (only if chosen)
<link to the product page>
```

If the product has sizes or colours, the customer must choose before the button works.

### 3.5 Sold products

- A sold product keeps its page and shows "Sold". The order button is replaced by "Ask for something similar on WhatsApp".
- It stays in listings with the "Sold" label for 7 days (number set in settings), then leaves listings.
- Its page stays reachable by direct link, so old links shared in WhatsApp do not break.

### 3.6 Other pages

- About us, How to order, Shipping and returns, Contact. The partners edit the text in admin.
- Search by product name or code.
- A "not found" page that links to new arrivals.

### 3.7 Sharing and search engines

- Every product page carries preview information, so a link pasted into WhatsApp or Instagram shows the cover photo, name and price.
- Pages are rendered on the server so Google can read them. The site provides a sitemap and product structured data.

### 3.8 Not included at launch

Cart, checkout, online payment, customer accounts, wishlist, customer-submitted reviews, multiple languages, order tracking.

## 4. What the partners use

A private admin area under `/admin` on the same site. It is installable on the phone as an app (PWA).

### 4.1 Signing in

- Two accounts, one per partner, created by a setup command on the server. There is no public sign-up.
- Sign-in by email or phone number plus password. The session lasts 90 days on that device.
- Both accounts have full rights. Each product records who created it and who last changed it.

### 4.2 Adding a product

Starting from WhatsApp:

1. In the dealer's chat, select the photos, tap Share, choose the store app.
2. The new-product form opens with those photos attached.

Starting from the admin: tap "Add product" and pick photos from the gallery or camera.

The form, in order:

| Field | Required | Notes |
|---|---|---|
| Photos | Yes, at least one | Reorder by dragging. The first is the cover. Up to 12. |
| Video | No | One file, up to 30 seconds and 20 MB. |
| Dealer's message | No | Paste box with a "Fill for me" button (see 4.3). |
| Name | Yes | |
| Selling price (₹) | Yes | Whole rupees. |
| Category | Yes | |
| Fabric | No | Pick from list. |
| Occasions | No | Pick any number from list. |
| Length, blouse piece, care | No | |
| Description | No | |
| Sizes | No | Tick from S, M, L, XL, XXL, or type custom ones. |
| Colours | No | Type names. |
| Dealer name | No | Private. |
| Dealer's code | No | Private. |
| Dealer price (₹) | No | Private. The form shows the margin next to the selling price. |
| Notes | No | Private. |

Buttons: **Publish** and **Save as draft**.

The product code is generated on first save: a category prefix (set per category, for example `S` for sarees) and a running number, for example `S-1042`. It never changes afterwards.

If a photo is under 1,200 pixels on its long side, the form shows a warning that it may look soft. The partner can still publish.

### 4.3 "Fill for me"

The partner pastes the dealer's text, for example "Soft silk, 6.3 m with blouse, ₹1,850". The site suggests name, fabric, length, blouse piece and description. Suggestions fill only empty fields and can be edited. The selling price is never filled automatically; a price found in the text goes into the private dealer price.

This uses the Claude API. The button appears only when an API key is configured. Without a key, everything else works normally.

### 4.4 Managing products

- List with cover photo, name, code, price and status.
- Search by name or code. Filter by status: Available, Sold, Draft.
- One-tap actions: Mark sold, Mark available again.
- Edit, Duplicate (copies everything except photos and code), Delete (asks for confirmation; removes the product and its files).
- Copy link, and Share (opens the phone's share menu with the product link).

### 4.5 Settings

- Brand name, logo, tagline, home page banner.
- WhatsApp business number.
- Categories (name, code prefix, tile image, order).
- Fabrics and occasions lists.
- Price bands.
- Days a sold product stays in listings.
- Text of About us, How to order, Shipping and returns, Contact.
- Customer photos for the home page.

### 4.6 Numbers on the admin home screen

- Products live, added this week, marked sold this week.
- Top 10 products by views in the last 7 days.
- Top 10 products by taps on the WhatsApp order button in the last 7 days.

### 4.7 Not included at launch

Order records, customer records, tracking of payments to dealers, invoices. These belong to the later checkout phase.

## 5. Images and video

Quality comes first.

- **Originals are kept.** Every uploaded file is stored unchanged. Display versions can be regenerated from it at any time.
- **Display versions.** For each photo the site makes WebP versions at 480, 960, 1600 and 2400 pixels on the long side, at quality 90. A size larger than the original is not generated; photos are never enlarged.
- **Colour.** Photos are converted to the standard sRGB colour space so colours look the same on every phone. Orientation from the camera is applied.
- **Right size per screen.** Pages list all available sizes and the browser picks the one that fits. Listing tiles use the 480 or 960 version; the product page uses 960 or 1600; the zoom view uses 2400.
- **Video.** Stored as uploaded (MP4), with a poster image taken from the first photo. No conversion on the server.
- **Storage estimate.** About 2 to 4 MB per photo including the original. At 6 photos per product, 1,000 products need about 12 to 24 GB. The 40 GB disk covers launch; a Hetzner volume is attached when the disk passes 60% full.

### Source quality

The site cannot show more detail than the photo it receives. WhatsApp reduces photos sent the normal way. Dealers should be asked to send photos with WhatsApp's HD option on, or as a Document, which sends the original file. Both work with the share-to-store flow.

## 6. Technical design

### 6.1 Overview

```
Customer / partner phone
        |
   Cloudflare (CDN, HTTPS, cache)
        |
   Caddy (web server, HTTPS to origin)
        |
   Next.js app (public site + admin)
      |              |
   SQLite file    media folder (originals + display versions)
```

Everything except Cloudflare runs in Docker on the Hetzner server, separate from the personal agent.

### 6.2 Stack

- Next.js (App Router) with TypeScript, running as a Node server.
- SQLite through `better-sqlite3`, with Drizzle ORM and migrations.
- `sharp` for image processing.
- Password hashing with argon2. Sessions as random tokens in a database table, sent as a secure, http-only cookie.
- Tests: Vitest for unit and integration tests, Playwright for browser tests.
- Docker Compose with two services: `app` and `caddy`.

### 6.3 Units

Each unit has one job and a small interface. Pages and API routes call these units; they hold no business logic themselves.

| Unit | Job | Depends on |
|---|---|---|
| `catalogue` | Create, edit, list, filter, search products; categories, fabrics, occasions, price bands; sold-visibility rule; code generation. | database |
| `media` | Accept uploads, validate, store originals, make display versions, delete files, report image size warnings. | file system, sharp |
| `auth` | Sign-in, sessions, sign-in rate limit, "is this request from an owner". | database |
| `whatsapp` | Build the order message and link from a product, chosen options and the configured number. Pure function. | none |
| `settings` | Read and write brand settings and content pages. | database |
| `stats` | Record product views and order-button taps; produce the admin summary. | database |
| `autofill` | Turn pasted dealer text into suggested fields. | Claude API (optional) |

`catalogue` has two read paths: a public one that returns only customer-visible fields, and an admin one that includes dealer fields. Public pages can only call the public one.

### 6.4 Data

| Table | Main contents |
|---|---|
| `users` | name, login (email or phone), password hash |
| `sessions` | token hash, user, expiry |
| `categories` | name, slug, code prefix, tile image, order |
| `fabrics`, `occasions` | name, slug |
| `price_bands` | label, min, max, order |
| `products` | code, slug, name, price, status (draft, available, sold), category, fabric, length, blouse piece, care, description, sizes, colours, dealer name, dealer code, dealer price, notes, created by, updated by, published at, sold at, timestamps |
| `product_occasions` | product, occasion |
| `media` | product, kind (photo, video), position, original file, width, height, generated sizes |
| `settings` | key, value |
| `pages` | slug, title, body |
| `events` | product, type (view, order tap), day, count |

Sizes and colours are stored as simple lists on the product. They are choices the customer names in the message, not separately stocked items.

Product addresses have the form `/p/<code>-<name-slug>`, for example `/p/s-1042-maroon-soft-silk`. The code alone identifies the product, so renaming it does not break old links.

### 6.5 Share from WhatsApp

- The admin's web app manifest declares a share target that accepts image and video files by POST to `/admin/share`.
- That route requires an owner session, stores the files through `media` as an unsaved draft, and redirects to the new-product form for that draft.
- If the session has expired, the partner is sent to sign in and must share again. The 90-day session makes this rare.
- Drafts that were never saved are deleted, with their files, after 24 hours.

### 6.6 Caching and speed

- Media files have names that include a content hash and are served with a one-year cache lifetime, so Cloudflare and phones keep them.
- Public pages are built fresh from the local database on each visit, which takes a few milliseconds, so a newly published product appears at once. Whether Cloudflare also caches pages for a short time is decided at deployment.
- Each photo also gets one JPEG of up to 1,200 pixels, used only for link previews in WhatsApp and Instagram, which do not reliably show WebP.
- Admin pages are never cached.

### 6.7 Statistics

- A product view and an order-button tap each add one to a per-product, per-day counter.
- No cookies and no third-party analytics. Known bots are ignored by user-agent.

### 6.8 Security

- All `/admin` pages and admin API routes require an owner session.
- Sign-in is limited to 5 failed attempts per login per 15 minutes.
- Uploads: owners only; images (JPEG, PNG, WebP) up to 25 MB each; video (MP4) up to 20 MB; file type checked from the file content, not the name.
- Dealer fields never appear in public pages, page data or API responses. An automated test checks this.
- The server accepts web traffic only from Cloudflare.
- Secrets (session key, API key) come from environment variables and are not stored in the repository.

### 6.9 Errors

- A failed photo upload shows which photo failed and lets the partner retry it without losing the rest of the form.
- If "Fill for me" fails or times out, the form says so and stays editable.
- If the WhatsApp number is not set, order buttons are hidden and the admin home shows a warning.
- Public pages show a friendly error page with a link to new arrivals.

### 6.10 Hosting and backups

- Docker Compose on the Hetzner server. Caddy handles HTTPS between Cloudflare and the server.
- If the personal agent already uses ports 80 and 443, the store is placed behind the existing web server instead of running its own Caddy. This is decided after the server check (see section 9).
- Nightly backup of the database and media folder to off-server storage (Hetzner Storage Box or Object Storage), kept for 30 days. Hetzner server backups are switched on as well.
- A restore is tested once before launch.

## 7. Testing

- **Unit and integration tests:** catalogue rules (filters, sorting, sold-visibility window, code generation), WhatsApp message builder, media processing (sizes, no enlarging, orientation, type and size limits), auth and access rules, public reads never containing dealer fields, autofill with the API replaced by a stub.
- **Browser tests:** customer journey (home, listing, filter, product, order link has the right content) and owner journey (sign in, add product with photos, publish, see it on the site, mark sold).
- **Manual checks on a real Android phone:** install the admin app, share photos from WhatsApp into it, publish, open the product link preview in WhatsApp.

## 8. Build order

1. Project setup, database, public catalogue with sample products. First version to show the partners.
2. Admin: sign-in, add and edit products, media handling, mark sold.
3. Installable admin app and share from WhatsApp.
4. Settings, content pages, statistics, "Fill for me".
5. Deployment to Hetzner with Cloudflare, backups, and launch checks. Needs the domain.

## 9. Open items

| Item | Needed by | Owner |
|---|---|---|
| Brand name and domain | Step 5 | Partners |
| New WhatsApp Business number | Step 5 | Partners |
| Server check: free RAM, disk use, what uses ports 80/443 | Step 5 | Pavan |
| Initial categories, fabrics, occasions, price bands | Step 4 (sample values until then) | Partners |
| Logo, colours and overall look | Step 1 review | Partners |
| Text for About, How to order, Shipping and returns | Step 4 | Partners |
| GST registration | Before taking payment online | Partners, with their CA |
| Payment gateway and KYC | Later checkout phase | Partners |

## 10. Later phase: checkout (not part of this build)

Recorded so the current design leaves room for it:

- Cart, address form, online payment through an Indian gateway, order records, order status messages.
- The product, media and settings structures above stay as they are. Orders, customers and payments are added as new tables and a new `orders` unit.
- Sizes and colours may need to become separately tracked variants at that point.

## 11. Estimated running costs

Estimates, to be confirmed against current price lists before launch.

| Item | Cost |
|---|---|
| Domain | about $30 to $35 per year (as quoted) |
| Hetzner server | €6.53 per month, already paid |
| Server backups | about €1.30 per month |
| Off-server backup storage | about €4 to €7 per month |
| Cloudflare, HTTPS certificates | free |
| Extra disk when needed | about €3 per month per 50 GB |
| "Fill for me" (optional) | about $1 per 100 products with the default model (Claude Opus 5.5 at low effort); about $0.02 per 100 with `AUTOFILL_MODEL=claude-haiku-5-5` |
