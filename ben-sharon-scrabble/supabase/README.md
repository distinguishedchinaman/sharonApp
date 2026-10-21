# Activate the shared journal

Use this app's existing Supabase project. No service-role key belongs in Vercel or the browser.

1. Open Supabase → SQL Editor → New query. Run `migrations/20261001000000_shared_journal.sql`. It creates one private household, transactional game/profile editing, private photos, and the Realtime revision subscription. It does not import or delete your existing browser data. Rerunning it preserves existing games and profiles.
2. Run `migrations/20261001010000_categories_bingos_photos.sql` to enable the new categories, bingo words and photo galleries. It converts existing legacy categories to **In Person - Evening**, preserving all other saved fields. Then run `migrations/20261004211041_allow_phony_bingos.sql` to permit the optional trailing `*` on a bingo. Apply every migration once, in filename order, on a fresh project. Then copy `invite-players.sql.example`, replace the two email placeholders with Ben's and Sharon's sign-in emails, and run it. These are the only invited accounts. Invitations are checked against the verified email in each Supabase session, including after membership creation.
3. Supabase → Authentication → URL Configuration: set Site URL to `https://sharon-app.vercel.app` and add `https://sharon-app.vercel.app/` to Redirect URLs. Add your development URL separately if testing locally.
4. Authentication → Email Templates → Magic Link: include both `{{ .Token }}` (the one-time sign-in code) and `{{ .ConfirmationURL }}` (the optional link). The code works inside the installed phone app. For example: `<h2>One More Game</h2><p>Your sign-in code: {{ .Token }}</p><p><a href="{{ .ConfirmationURL }}">Open our journal</a></p>`. Keep email sign-in and new email registrations enabled. Uninvited registrations cannot read the journal or photos.
5. Configure a verified custom SMTP sender under Authentication email/SMTP settings. Supabase's default sender can restrict recipients to project team members and impose small email limits; verify delivery to both invited addresses. Test email delivery yourself; this repository's tests never email real users.
6. Vercel → sharon-app → Settings → Environment Variables: add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` from Supabase's Connect/API Keys screen. These are public browser configuration, not the database password or service-role/secret key. Apply them to Production (and Preview only if wanted). Root Directory stays `ben-sharon-scrabble`; framework stays Next.js. Redeploy after setting these variables because Next.js embeds them at build time.
7. Open the deployed app on both phones. Sign in with your own invited email and code. Under **More → Import this phone’s saved games**, review then choose **Merge new games** on each phone. Samples are excluded; original localStorage is untouched. If your old journal is in another browser/origin, export JSON there and use **More → Import data** here instead. Merging skips existing IDs and preserves cloud profiles. Enter ratings manually afterward, or use explicitly confirmed full replacement if you intend to replace profiles and all games.
8. Verify with both phones online: add a game/photo on one and see it appear on the other, then edit/delete it and verify again. Check that export includes the photo. The SQL, browser configuration, SMTP, Storage, and Realtime must all be active before claiming production synchronization works.

Changes use per-record before/after comparisons inside a locked database transaction. Independent additions and edits survive; simultaneous edits to the same record fail with an explicit conflict. Full replacement also checks the global revision. Realtime refreshes while open, and foreground/reconnection plus a 30-second fallback refresh cover mobile sleep and signed-photo URL renewal. Shared writes require internet; there is no offline upload queue.

The database stores private object paths, never public photos or temporary signed URLs. Signed URLs expire in one hour. Portable JSON exports download and embed photos. Failed uploads do not save a game; an uncertain response after posting asks the user to reload before retrying. Old/replaced/unconfirmed photo objects may remain in the private bucket: retain them until you can confirm they are unreferenced rather than risk deleting a successfully saved photo.

## Validation

`npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, `npm run test:e2e` validate the app in unconfigured local mode; cloud repository tests cover photo writes and failure/conflict handling.

For a fresh, disposable PostgreSQL 17 or newer database, run the following from `ben-sharon-scrabble` using a superuser connection. Set `TEST_DATABASE_URL` to that disposable database. The fixture creates cluster roles and emulates Supabase auth claims/storage tables; it must **never** run on a hosted Supabase project or an existing database. Use a fresh disposable cluster for each run.

```bash
set -e
: "${TEST_DATABASE_URL:?Set this to a fresh disposable local test database}"
psql "$TEST_DATABASE_URL" -X -v ON_ERROR_STOP=1 -f tests/database/platform-fixture.sql
for migration in supabase/migrations/*.sql; do
  psql "$TEST_DATABASE_URL" -X -v ON_ERROR_STOP=1 -f "$migration"
done
for test in data-api-grants shared-journal categories-bingos-photos; do
  psql "$TEST_DATABASE_URL" -X -v ON_ERROR_STOP=1 -f "tests/database/$test.sql"
done
```

The fixture deliberately has no Supabase-style automatic grants on new `public` tables or sequences. `data-api-grants.sql` verifies that baseline with a rolled-back probe, then checks the final grants after all migrations, RLS, private invitations, and the Realtime publication. The other assertions exercise real SQL transactions, invitations, conflicts, independent additions, storage policies, malformed data, and anonymous/outsider denial. These tests do not exercise PostgREST HTTP, hosted Auth email transport, Storage HTTP, or Realtime websocket delivery; complete step 8 when validating a deployment.

## Data API grants and the October 30, 2026 change

Supabase's [announced change](https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically) removes automatic Data API grants from newly created `public` tables. Existing tables keep their permissions. The current migrations already supply the grants this app uses; no extra table grants are needed.

| App operation | Access path | Required permissions already in the migrations |
| --- | --- | --- |
| Sign in to the journal | `cloud-provider.tsx` calls `join_household()` | `authenticated` EXECUTE; the security-definer function checks the session's invited email and creates membership |
| Read games and profiles | `CloudRepository.load()` calls `get_journal(uuid)` | `authenticated` EXECUTE; the security-definer function checks household membership |
| Save, edit, delete, import or replace | `CloudRepository.save()` calls `apply_journal_changes(uuid,jsonb,jsonb,bigint)` | `authenticated` EXECUTE; membership checks, validation and conflict checks run inside the function |
| Refresh after a shared change | Realtime UPDATE subscription on `public.households` | Explicit `authenticated` SELECT, household RLS and publication membership |
| Read/upload/delete private photos | Storage API on `game-photos` | Policies on `storage.objects` call explicitly granted `can_access_game_photo(text)`; the `storage` schema is outside this change |

All five public tables have RLS enabled. Authenticated users have SELECT on `households`, `household_members`, `games` and `players`, with no direct table write grants. **`household_invites` intentionally has no client table grant or client policy.** Invitations are managed by the project owner through SQL; privileged functions read them after checking the caller. Do not add a SELECT grant to fix an unrelated error. No application query uses a service-role key, GraphQL, or direct public-table REST writes.

The two later migrations replace the existing game-validation function and retain its ownership and grants. They create no tables, views or sequences. The current schema uses UUIDs, not serial/identity sequences. Run migrations as the project owner (`postgres` in the normal Supabase setup), so security-definer functions retain the intended table-owner privileges.

| Environment or change | Expected result |
| --- | --- |
| Existing deployment or frontend-only redeployment | No permissions change from this announcement |
| Fresh installation, full database reset, or isolated preview database | Compatible when **all** migrations are replayed in order and invitations are configured |
| Frontend preview pointing to the existing database | Uses that database's existing permissions; a frontend preview does not create database isolation |
| Future migration that adds or drops/recreates a table | Must explicitly grant only the access its callers need and recreate RLS/policies; old grants do not transfer to a new table |

For future migrations, review table creation, RLS/policies and grants together. Keep internal invitation-like tables inaccessible to clients. For new client-facing functions, explicitly revoke unwanted PUBLIC/anon EXECUTE and grant only the required callers; check any policy helper too. Add sequence privileges only if a client actually needs a new sequence. Extend the SQL tests for new objects and run the complete suite without automatic grants. Do not use `GRANT ALL ON ALL TABLES`, broad default grants, or a service-role client to work around `42501` errors.

## Updating an already configured project

Apply only migrations that the target project has not already applied, in filename order. A project with only the original shared-journal migration needs `20261001010000_categories_bingos_photos.sql`, followed by `20261004211041_allow_phony_bingos.sql`. The latter expects the previous validator and is not intended to be rerun after it has already been applied. No additional permissions migration is required for the October 30 change.

The categories migration does not recategorize games already using the new choices. Existing single photos stay intact. New games support up to 12 photos and up to 50 bingo words per player, with commas separating words in the entry form. History/Stats filter by main category or individual subtype; the Bingo Book shows each player’s words with links to games. Original local journals and imported old backups convert legacy categories to In Person - Evening; local migration retains the original bytes under `one-more-game:journal:v1:before-categories`.
