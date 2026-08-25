# Lumen

AI-powered sales-ops dashboard. Upload a spreadsheet in any of four
categories (Sales, Doctors, Call Rate, IMS Market) and Claude figures out
which category it is and how its columns map to the dashboard's schema —
no fixed file format required. Ask questions about any category in plain
English and get answers from Claude.

Stack: Next.js (App Router) on Vercel, Supabase (Postgres + Auth) for a
shared team dashboard, Anthropic API for file classification and
natural-language analysis.

The original static prototype is kept at `reference/Lumen_Prototype.html` for
design reference only — it is not part of the running app.

## How uploads work (v1)

1. You upload a `.csv` or `.xlsx` file from the dashboard.
2. Claude reads the column headers and ~20 sample rows and decides which of
   the four categories it belongs to, plus a best-guess mapping from the
   file's actual column names to the dashboard's internal fields (e.g. a
   "Territory" column is recognized as "Area").
3. You always see a confirmation screen before anything is saved — you can
   change the detected category or fix any column mapping, especially if
   Claude flags low confidence or a required field it couldn't map.
4. On confirm, rows are merged into the right table by a natural key (e.g.
   rep + area + item + customer + month for Sales) — re-uploading a file
   updates matching rows instead of wiping out other reps' or months' data.

**v1 scope, on purpose:** every signed-in user sees the same shared
dashboard (no per-rep data restrictions yet); a file must belong to a
single category (no auto-splitting of mixed files); there's no import
undo beyond deleting rows directly in Supabase. These are reasonable
follow-ups once the basics are working, not blockers for v1.

## 1. Create a Supabase project

1. Go to [supabase.com](https://supabase.com), sign up, and create a new project.
2. In the project dashboard, open **SQL Editor -> New query**, paste the
   contents of `supabase/schema.sql`, and run it. This creates the
   `datasets` and `queries` tables with Row Level Security so each user can
   only ever see their own data.
3. Open **Settings -> API** and copy the **Project URL** and the **anon
   public** key.
4. Open **Authentication -> Sign In / Providers** and make sure **Email**
   is enabled (it is by default). For local development, under
   **Authentication -> URL Configuration**, you can leave the defaults —
   we'll add your real domain there once deployed.

## 2. Get an Anthropic API key

This is separate from a claude.ai subscription. Go to
[console.anthropic.com](https://console.anthropic.com), create an account,
add a small amount of billing credit (pay-as-you-go), and generate an API
key under **API Keys**.

## 3. Configure environment variables

```bash
cp .env.local.example .env.local
```

Fill in `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and
`ANTHROPIC_API_KEY` with the values from steps 1 and 2.

## 4. Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Sign up with an email
and password, confirm the email (Supabase sends a confirmation link), then
sign in, upload a `.csv` file, and start asking questions.

## 5. Deploy to Vercel (free, permanent URL)

1. Push this repository to GitHub (already done if you're reading this on
   the deployed branch).
2. Go to [vercel.com](https://vercel.com), sign up, and click **Add New ->
   Project**, then import this GitHub repo.
3. In the project's **Environment Variables** settings, add the same three
   variables from your `.env.local`.
4. Click **Deploy**. Vercel gives you a free `your-project.vercel.app` URL
   immediately. A custom domain can be added later under **Settings ->
   Domains**.
5. Back in Supabase, under **Authentication -> URL Configuration**, set the
   **Site URL** to your Vercel URL so email confirmation links redirect
   correctly.

## Notes on current scope (v1)

- `.csv` and `.xlsx` uploads are both supported. Excel parsing uses
  `@e965/xlsx`, an npm-published mirror of the official SheetJS
  security-patched release (0.20.3) — the plain `xlsx` package on the npm
  registry is stuck on an old, vulnerable 0.18.x release, so don't swap
  back to it. If your own environment can reach `cdn.sheetjs.com`, you can
  install directly from SheetJS instead; the API is identical.
- Each uploaded file is capped at 5,000 rows / 100 columns to keep storage
  and API costs predictable.
- Claude answers from column statistics plus a data sample, not the full
  raw file on every request — this keeps API costs low as datasets grow.
- File classification samples ~20 rows per upload, not the whole file, to
  keep classification fast and cheap.
