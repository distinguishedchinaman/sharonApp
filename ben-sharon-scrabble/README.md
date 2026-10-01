# One More Game

A personal Scrabble journal for Ben and Sharon. Record two scores in a few taps, keep the game’s story and a photo, and watch your friendly rivalry grow. The design uses warm cream, original letter-tile illustrations, and muted green, with bottom navigation on phones.

## Shared cloud journal

Shared Supabase storage, invited email sign-in, private photos, live refresh, and local-data import are implemented. Follow [the activation guide](supabase/README.md) to configure the existing project and Vercel deployment. Until both public Supabase environment variables are supplied, the app retains its original local mode described below.

## Run it

Use Node.js 22.13 or newer (Node 24 is recommended). From the repository:

```bash
cd ben-sharon-scrabble
npm ci
npm run dev
```

Open `http://localhost:3000` in your browser. If your terminal is already in `ben-sharon-scrabble`, skip the `cd` line. No accounts, API keys, or Supabase configuration are needed for local mode.

For the production version:

```bash
npm run build
npm start
```

The production server listens on all network interfaces so a phone on the same trusted Wi-Fi can use the computer’s LAN address, followed by `:3000`. Development origins are limited to localhost and 127.0.0.1; use the production commands above for LAN phone testing. Each browser still has its own independent data. Use HTTPS when deploying it publicly and adding it to a phone’s home screen. Installation and service-worker caching depend on HTTPS (or localhost); basic online use works without installation.

## What’s included

- A Ben vs Sharon dashboard with head-to-head wins, ties, total games, and understated ratings.
- Fast recording, details with their own URLs, editing, and confirmed deletion.
- Dates, location suggestions from saved games, game types, first player, notes, and optional photos.
- History with outcome and game-type filters, search, and five sort orders.
- Score averages and extrema; margins; last 5/10 records; current and longest streaks; month, year, location, and type records.
- Factual milestones and observations. Ties break a winning streak. Winning percentages include ties in the denominator. The average winning margin excludes ties.
- Player profiles, manual ratings, and a cached server-side Cross-Tables service.
- Validated JSON backups with safe merging and separately confirmed replacement.
- Ten visibly marked **sample games** on the first visit. They are not Ben and Sharon’s actual history. **More → Delete sample data** removes just the sample entries; real games and profiles stay. Samples are not re-added after deletion.
- A web app manifest, home-screen icons, and basic offline caching in production after an online visit. Visit each page online first; ratings require a connection. Development mode does not register a service worker.

## Where your data lives in local mode

Games, player ratings, and embedded photos are stored in this browser’s `localStorage` under `one-more-game:journal:v1`. They survive refreshing and closing the browser. They do **not** automatically synchronize between Ben’s phone and Sharon’s phone, different browsers, deployments, or port numbers. Private browsing may discard data when closed. Clearing site data deletes the journal.

Photos are decoded and resized to at most 1,200 pixels on the longer edge, converted to JPEG, and bounded to approximately 700 KB of encoded text. This is practical for a prototype, but browser storage is usually limited to a few MB. The app reports failed saves rather than claiming a change was saved. Export often. There is no cloud backup in Version 1.

The UI updates only after a successful storage write. Invalid saved data is not silently overwritten. Another tab’s edits are loaded automatically; stale writes are rejected to avoid overwriting those edits.

## Backups

In **More**, select **Export data** to download JSON containing all games (including samples), profiles, ratings, notes, and photos. Keep a copy somewhere safe.

**Import data** checks the entire file before showing a review dialog. It validates dates, whole-number scores, player profiles, IDs, and embedded photo formats. Nothing changes until you choose an action:

- **Merge new games** adds previously unseen IDs, keeps existing games and profiles, and reports skipped IDs. Different records of the same game with different IDs are treated as separate games.
- **Replace the entire journal** requires an additional explicit confirmation. It replaces games and profiles with the backup. You can export the current journal from that confirmation screen first.

Backups have `version: 1`. Winners, margins, and statistics are calculated from scores instead of duplicated in storage. Sample status is preserved during imports.

## Cross-Tables ratings

Ben: <https://www.cross-tables.com/results.php?playerid=15872>

Sharon: <https://www.cross-tables.com/results.php?p=22923>

**More → Update ratings** calls `/api/ratings`; the Next.js server requests only these two fixed URLs. No client-side scraping or secret credentials are involved. Concurrent requests are coalesced. Successes are cached for 24 hours and failures for one hour, including when the refresh control is tapped again. This cache is in server memory and resets when the server restarts; a persistent cache can be added for a multi-instance deployment.

Parsing lives in `src/lib/ratings-parser.ts`. It deliberately accepts only clearly labeled current/latest NASPA/NWL or WGPO ratings, and rejects ambiguous or historical numbers. Cross-Tables HTML may need an adapter update once its live markup can be inspected. A failed or unrecognized response never clears existing ratings; a partial response preserves the other saved rating. Manual entry is available per player.

**Validation in this cloud environment:** Cross-Tables requests were rejected by the environment’s egress proxy (HTTP 403). Automatic retrieval is therefore not verified here. Manual ratings and preservation after failed refreshes are tested. Allowing `www.cross-tables.com` in environment settings permits a future live check, but does not guarantee the parser will match the site’s current HTML.

## Checks

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

The data tests cover statistics, ties/streaks, milestones, backup validation and merging, local persistence, conflict protection, and conservative ratings parsing.

Browser tests exercise recording with a photo, refresh persistence, editing, confirmed deletion, history filters/sorting, backup export/merge/replace, manual ratings, refresh failure handling, corruption protection, storage-full errors, offline startup, and desktop/phone layouts:

```bash
# One-time, unless Chromium is already installed:
npx playwright install chromium
npm run test:e2e
```

The browser runner starts a fresh built production server on port 3100 (run `npm run build` first), separate from your development server. It uses `/usr/bin/chromium` when available; otherwise it uses Playwright’s installed Chromium. An alternative executable can be selected with `PLAYWRIGHT_CHROMIUM_EXECUTABLE`. Browser tests create isolated test journals, not changes to your personal browser data.

## Technology and structure

Next.js App Router, React, TypeScript, Tailwind CSS with a custom design stylesheet, Lucide icons, and locally packaged DM Sans/Fraunces fonts. No remote fonts or branded board-game artwork are required.

- `src/lib/model.ts`: game and player types, derived winner/margin helpers.
- `src/lib/storage.ts`: `JournalRepository` adapter for local persistence.
- `src/lib/photos.ts`: replaceable photo preparation/storage interface.
- `src/lib/validation.ts`: data validation and non-destructive merging.
- `src/lib/statistics.ts`: pure statistics and milestone calculations.
- `src/lib/ratings-parser.ts` / `ratings-service.ts`: isolated parsing and server retrieval.
- `src/components/`: reusable UI, game entry/details, dashboard, history, statistics, and More.
- `src/app/`: pages and ratings API.
- `tests/`: data tests and Playwright browser workflows.

## The next single step

Add **one private Supabase household** shared by Ben and Sharon, with PostgreSQL games, email magic-link accounts, row-level security, and Storage for photos. Swap the local repository/photo adapter for Supabase-backed implementations, migrate a reviewed JSON backup, and retain export/import. Then deploy over HTTPS for both phones.

Supabase migration has not been started. Version 1 has no authentication, shared database, automatic cloud backup, turn-by-turn scores, or comeback claims. It is an independent personal journal and is not affiliated with Scrabble or its owners.
