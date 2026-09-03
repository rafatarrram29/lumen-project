import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { notifyAdminOfNewSignup } from "@/lib/notifyAdmin";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";
  // Only the signup-confirmation link is tagged this way (see login/page.tsx)
  // — the password-reset link is not, so clicking it can never trigger a
  // "new signup" notification for an existing account.
  const isSignupConfirmation = searchParams.get("type") === "signup";

  if (code) {
    const supabase = await createClient();
    const { data } = await supabase.auth.exchangeCodeForSession(code);

    if (isSignupConfirmation && data.user?.email) {
      // The table's primary key on user_id is what actually guarantees
      // "only once ever" — this insert succeeds only the very first time
      // for this account; every later attempt (a re-clicked link, a race
      // between two near-simultaneous requests) hits a unique-violation
      // and is skipped here without emailing again.
      const { error: alreadyNotified } = await supabase
        .from("lumen_signup_notifications")
        .insert({ user_id: data.user.id, email: data.user.email });

      if (!alreadyNotified) {
        await notifyAdminOfNewSignup(data.user.email, new Date());
      }
    }
  }

  return NextResponse.redirect(`${origin}${next}`);
}
