# Lumen

AI-powered sales data analysis for SMB sales managers. Upload a spreadsheet,
ask questions in plain English, get answers from Claude.

Stack: Next.js (App Router) on Vercel, Supabase (Postgres + Auth) for users
and per-user data storage, Anthropic API for natural-language analysis.

The original static prototype is kept at `reference/Lumen_Prototype.html` for
design reference only — it is not part of the running app.

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

## Lumen Territory Decision Engine (`/lumen`)

A separate, self-contained page — does not touch the dataset/query flow above.
Upload a monthly sales export (`.xls`/`.xlsx`) and see per-area cards with the
5 territory decision rules (trend, systemic check, root cause by product
family, transfer opportunities, and a concrete decision per finding).

Before using it, run `supabase/lumen_schema.sql` once in the Supabase SQL
Editor — it only adds the new `lumen_sales_records` table and does not
change `datasets` / `queries` or their policies. No new environment
variables are needed; it reuses the same Supabase project and requires the
same sign-in as the rest of the app.

## Notes on current scope (v1)

- Only `.csv` uploads are supported for now. Excel (`.xlsx`) support can be
  added later via SheetJS's official (security-patched) package.
- Each uploaded file is capped at 5,000 rows / 100 columns to keep storage
  and API costs predictable.
- Claude answers from column statistics plus a data sample, not the full
  raw file on every request — this keeps API costs low as datasets grow.
