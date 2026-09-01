# Lumen — Territory Decision Engine

Upload a monthly sales export and get territory-level decisions, not just
numbers: which areas really moved, whether a drop is one area's problem or
a cluster-wide pattern, which item is driving it, and a concrete action for
each finding.

Every upload is its own **dataset** — uploading a new file never overwrites
or mixes with another dataset, and a dropdown above the dashboard switches
between them. You can select multiple files at once (e.g. a month per file)
to add them all to the same dataset in one go, using the same column
mapping. The app makes no assumption about your file's column names:
the first time you upload a new format, you're asked to map its columns
(Area/Region, Item/Product, Value, Quantity, Month, and the optional Rep and
Cluster) to what they mean; that mapping is saved with the dataset, so
adding more months to the same dataset later never asks again. When a
dataset has a Cluster column, the systemic-drop check (rule 2 below) runs
separately inside each cluster instead of across the whole dataset.

Stack: Next.js (App Router) on Vercel, Supabase (Postgres + Auth).

The original static prototype is kept at `reference/Lumen_Prototype.html` for
design reference only — it is not part of the running app.

## 1. Create a Supabase project

1. Go to [supabase.com](https://supabase.com), sign up, and create a new project.
2. In the project dashboard, open **SQL Editor -> New query**, paste the
   contents of `supabase/lumen_schema.sql`, and run it. This creates the
   `lumen_sales_records` table with Row Level Security so only signed-in
   users can read or write it.
3. Then run `supabase/lumen_datasets_migration.sql` the same way. This adds
   the `lumen_datasets` table and the dataset/rep/cluster columns on
   `lumen_sales_records` — safe to run even if you already have data, since
   it backfills any existing rows into a "Legacy data" dataset automatically.
4. Then run `supabase/lumen_user_isolation_migration.sql` the same way. This
   makes every dataset private to the user who created it — anyone can still
   sign up and use the app, but users can no longer see or touch each
   other's data. Datasets created before this migration (e.g. "Legacy data")
   stay shared and usable by everyone, exactly as before, but can no longer
   be deleted through the app.
5. Then run `supabase/lumen_targets_migration.sql`. This adds the Targets
   file support described below (a `lumen_targets` table, plus the
   `target_column_mapping` column and its missing UPDATE policy on
   `lumen_datasets`).
6. Then run `supabase/lumen_rep_assignments_migration.sql`. This adds the
   `lumen_rep_assignments` table used by the rep history timeline described
   below.
7. Then run `supabase/lumen_linked_files_migration.sql`. This adds the
   `lumen_dataset_files` and `lumen_dataset_records` tables used by linked
   files, described below. Purely additive — it does not touch
   `lumen_datasets` or `lumen_sales_records`, so every existing dataset
   keeps working exactly as it does today.
8. Then run `supabase/lumen_corrections_migration.sql`. This adds the
   `lumen_corrections` table used by the flag-issue / correction log
   feature described below.
9. Open **Settings -> API** and copy the **Project URL** and the **anon
   public** key.
10. Open **Authentication -> Sign In / Providers** and make sure **Email**
   is enabled (it is by default). For local development, under
   **Authentication -> URL Configuration**, you can leave the defaults —
   we'll add your real domain there once deployed.

## 2. Configure environment variables

```bash
cp .env.local.example .env.local
```

Fill in `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` with
the values from step 1.

## 3. Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Sign up with an email
and password, confirm the email (Supabase sends a confirmation link), sign
in, then upload a monthly sales export — `.xlsx`, `.xls`, `.xlsm`, `.csv`,
`.tsv`, `.txt`, or `.ods` — and see the analysis.

## 4. Deploy to Vercel (free, permanent URL)

1. Push this repository to GitHub (already done if you're reading this on
   the deployed branch).
2. Go to [vercel.com](https://vercel.com), sign up, and click **Add New ->
   Project**, then import this GitHub repo.
3. In the project's **Environment Variables** settings, add the same two
   variables from your `.env.local`.
4. Click **Deploy**. Vercel gives you a free `your-project.vercel.app` URL
   immediately. A custom domain can be added later under **Settings ->
   Domains**.
5. Back in Supabase, under **Authentication -> URL Configuration**, set the
   **Site URL** to your Vercel URL so email confirmation links redirect
   correctly.

## The 5 decision rules

1. **Trend** — compare against the last 3 months, not just one, before
   calling anything a real move.
2. **Systemic check** — if most areas moved the same direction together,
   the cause is cluster-wide, not one area's fault (scoped to each cluster
   when the dataset has one, otherwise across all areas).
3. **Root cause** — break the change down by item to find what's actually
   driving it.
4. **Transfer opportunity** — flag an item growing unusually well in one
   area, as a candidate to replicate elsewhere.
5. **Decision, not description** — every finding ends in one concrete
   action, never a bare observation.

## Rep performance (optional)

If a dataset's column mapping includes a **Rep** column, the dashboard adds
a rep dimension alongside area and item: a rep comparison chart, a per-rep
trend against the all-reps average, and a **Rep leaderboard** ranking reps
by their sales (or by % of target, once a targets file is uploaded — see
below). Datasets with no Rep column are completely unaffected.

## Target vs Actual (optional)

A dataset can have a separate **Targets** file uploaded alongside its sales
data (the "+ Upload targets" button in the sidebar, once a dataset is
selected). Like the sales file, its columns are mapped once — Month and
Target value are required, plus at least one of Area, Rep, or Item so a
target can be matched back to an actual. Uploading a targets file replaces
every existing target for that dataset and year; it's meant to hold the
current plan, not a history of edits.

Once targets exist for the latest month, the dashboard shows **% of
target** next to each area's and rep's raw numbers, with a clear "Under
target by X%" alert when either falls below an adjustable threshold
(70% by default). Datasets with no targets file work exactly as before.

## Rep assignment history (optional)

Each area's details include a **Rep history** timeline — who was
responsible for that area during which months, including "Vacant" stretches
with no rep at all (add/remove periods inline). This is purely informational:
an area's trend, systemic-drop, and root-cause analysis always treats it as
one continuous unit, regardless of rep handoffs recorded here. When a period
covers the latest month, the area's details also note who that was (or
"Vacant") next to its numbers. Areas with no recorded history are
unaffected.

## Linked files (optional)

A dataset's primary Sales file can have extra **linked files** attached —
Achievement, KPIs, or anything else ("+ Add linked file" in the sidebar,
once a dataset is selected). Uploading one guesses its file type and which
columns (Area/Rep/Cluster/Month) connect it back to the same areas and
months as the sales data, based on its column names — always shown for
review and edit before saving, never applied silently. A file can be
replaced (re-upload with a corrected mapping, wholesale replacing its old
rows) or deleted independently, without touching the dataset's other files.

This is a **linked view**, not a fused one: each file is stored and
matched on its own terms. In an area's details, any linked file with a
matching Area + latest-month row shows up as a "Linked data" block next to
that area's finding and decision — e.g. an Achievement file's % and a KPIs
file's numbers appear together as context for the same drop, without
changing the underlying sales analysis itself. A file whose join keys
don't include Area won't appear there. Datasets with no linked files are
completely unaffected.

## Correcting mistakes in-app

Every area, item row, and decision has a 🚩 **Flag issue** button — pick
what's wrong (a wrong number, files linked incorrectly, a decision that
doesn't make sense, or something else) and describe it in a sentence. Every
flag is saved to that dataset's **Correction log** (sidebar), showing what
was flagged, when, and whether it's still open or marked resolved.

Two things can be fixed without deleting and re-uploading a whole dataset:

- **Which columns feed the sales mapping** (⚙ next to the dataset name) —
  useful when the wrong column was picked (e.g. "Zone" instead of "Area").
  This only affects new uploads to that dataset going forward; numbers
  already uploaded aren't retroactively changed (re-upload the affected
  month instead, using the existing overlap-replace flow).
- **Which dimensions link a file back to the sales data** (⚙ next to a
  linked file) — if the system picked the wrong join (e.g. joined by Rep
  only when it should also join by Area), correcting it takes effect
  immediately with no re-upload, since the area/rep/cluster/month values
  were already extracted from that file when it was uploaded.

Fixing which *source column* feeds a linked file (as opposed to which
already-extracted dimension it joins by) does require re-uploading that
file — use "Replace" on it, which shows the same editable mapping.

## Troubleshooting

- **Re-uploading a month you already uploaded** into the same dataset asks
  for confirmation before replacing that month's rows, instead of silently
  duplicating them. If you already have duplicate rows from before this
  existed (numbers look implausibly large, e.g. an area showing +250%
  growth), run `supabase/lumen_dedupe.sql` in the Supabase SQL Editor to
  check for and remove them.
- If you created the `lumen_sales_records` table before the DELETE policy
  was added to `lumen_schema.sql`, run `supabase/lumen_add_delete_policy.sql`
  once — without it, re-uploading a month fails silently.
- **"This file doesn't match this dataset's saved column mapping"** means
  the file you're adding doesn't have the same column names as the ones
  originally mapped for that dataset. Either pick the dataset that actually
  matches this file's format, or choose "Create new dataset" instead.

## Notes on current scope

- Excel parsing uses the `xlsx` npm package, which carries a known
  high-severity advisory (Prototype Pollution / ReDoS) with no fix
  published to the npm registry — mitigated by the app being sign-in gated
  (internal use only). SheetJS's own patched build is a good follow-up.
