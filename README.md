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
8. Then run `supabase/lumen_inline_edits_migration.sql`. This adds the
   `lumen_data_edits` table plus the missing UPDATE policies used by
   in-app inline editing (the **Correction log** described below).
9. Then run `supabase/lumen_undo_migration.sql`. This adds the `is_undo`
   column used to flag an Undo entry in the Correction log.
10. Open **Settings -> API** and copy the **Project URL** and the **anon
   public** key.
11. Open **Authentication -> Sign In / Providers** and make sure **Email**
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

Every item's value inside an area (its number for the compared and latest
month) is directly editable — click it, type the corrected number, and
press Enter. There's no need to re-upload anything: saving updates the
underlying row(s) right away, and the whole dashboard recalculates from
that new number automatically — the area's total, its cluster's average
and systemic-drop check, targets vs actual, the rep leaderboard, and every
finding/decision all reflect the edit the moment it's saved, with no manual
refresh. The same click-to-edit works on any linked file's values
(Achievement, KPIs, or other), though those only affect that file's own
display, per the "linked view" scope described above. An edited value shows
a small ✎ next to it — hover it to see who made the edit and when.

Right after saving an edit, an **Undo** toast appears at the bottom of the
screen for a few seconds — click it (or press **Ctrl+Z** / **Cmd+Z** on a
computer) to instantly restore the exact previous value, with the same
automatic recalculation running in reverse. Undo only steps back the single
most recent edit; the toast (and the Ctrl+Z shortcut) goes away once you
make another edit, switch dataset or year, or a few seconds pass.

Every edit is recorded automatically in that dataset's **Correction log**
(sidebar) under "Edit history": what changed, from what value to what
value, who made the change, and when — an Undo shows up there too, as its
own "↺ Undone" entry, so the original edit stays in the log rather than
being erased.

Two more things can be fixed without deleting and re-uploading a whole
dataset:

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

## Export to PDF / PowerPoint

The **Export** button (top of the dashboard) opens a checklist of every
exportable piece of the current report — overview stats, each area, each
decision, each chart, and Rep Leaderboard / Target vs Actual when present
— all checked by default, with Select all / Deselect all. Pick PDF or
PowerPoint and only the checked items are included; nothing in the output
hints that anything was left out. If the dataset has open (unresolved)
flagged issues, the export adds a short "some findings are still under
review" notice. Everything renders in whichever language is active
(English or Arabic, right-to-left) at export time. Generation happens
entirely in the browser — no data is sent anywhere to build the file.

## Notes on current scope

- Excel parsing uses the `xlsx` npm package, which carries a known
  high-severity advisory (Prototype Pollution / ReDoS) with no fix
  published to the npm registry — mitigated by the app being sign-in gated
  (internal use only). SheetJS's own patched build is a good follow-up.
- PPTX export uses `pptxgenjs`, whose `image-size` dependency has an open
  advisory for a few uncommon image formats (ICNS/JXL/HEIF parsing) — not
  reachable here, since the export flow never feeds it a user-supplied
  image, only text and chart data.
- The manual "flag an issue" report feature (and its `lumen_corrections`
  table) has been replaced by direct inline editing — the app no longer
  reads or writes that table. If you ran `lumen_corrections_migration.sql`
  on an older setup, the table is harmless to leave in place; it just isn't
  used anymore.
