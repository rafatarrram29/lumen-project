# Lumen — Territory Decision Engine

Upload a monthly sales export and get territory-level decisions, not just
numbers: which areas really moved, whether a drop is one area's problem or
a cluster-wide pattern, which item is driving it, and a concrete action for
each finding.

Every upload is its own **dataset** — uploading a new file never overwrites
or mixes with another dataset, and a dropdown above the dashboard switches
between them. The app makes no assumption about your file's column names:
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
4. Open **Settings -> API** and copy the **Project URL** and the **anon
   public** key.
5. Open **Authentication -> Sign In / Providers** and make sure **Email**
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
in, then upload a monthly `.xls`/`.xlsx` sales export and see the analysis.

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
