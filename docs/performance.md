# Speed on slow phones and poor networks

## What the app does for a slow connection
- **Skeleton at once.** Every page without its own loading screen shows one (`src/app/loading.tsx`) the moment a link is tapped, so a slow server never leaves a blank page.
- **Images load as they are scrolled to** (`loading="lazy"`, `decoding="async"`) in the feed, lists, profiles, ads and galleries.
- **The play card is a 30 KB still** (`/growth/play-card-still.webp`) instead of the 528 KB PNG. Its video, and a video ad, are only downloaded on a good connection: on 2G/3G or Data Saver the card stays a still and a video ad waits for a press (`src/lib/useLiteConnection.ts`).
- **Browsers keep fixed public files for a day** (`/growth`, `/icons`, logos, patterns) instead of re-checking them on every visit; the service worker already keeps the app's scripts, styles and fonts.
- Smaller scripts: only the icons and chart parts a page uses are bundled (`optimizePackageImports`); the `X-Powered-By` header is dropped.

## What to check on the hosting side (these decide most of the real-world delay)
1. **Database region.** The Vercel Functions region (Project Settings > Functions > Region) should be the same region as the Neon database. A function in one continent and a database in another adds a delay to every query, and a page runs several.
2. **Pooled connection string.** Use Neon's pooled address (the host with `-pooler`) for `DATABASE_URL` so each function call does not open a fresh connection.
3. **Database cold starts.** On Neon's free tier the database sleeps when idle and the first request after a pause can take a few seconds. Turn off auto-suspend (paid plans) or keep it warm.
4. **Vercel Analytics / Speed Insights** shows which pages are slow for real visitors.

## Pictures people upload
The picture editor (profile photos, organization logos, covers, course flyers) now saves what it cuts out as **WebP** and no larger than needed: 480 px for a profile photo or logo, 1280 px for a flyer, 1600 px for a cover banner (a browser that cannot write WebP gets a JPG). A 6 MB phone photo becomes a few dozen KB. Pictures uploaded before this change keep their old size until they are chosen again.

## The number on the app icon
Every push to a trainee's phone (a challenge, a chat, a wallet or event note) now carries the full count waiting for them: unread group chats + unread messages + a challenge waiting on them (`src/lib/arena/attention.ts`, the same count the page uses). Answering a challenge refreshes the icon number straight away.
