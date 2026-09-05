// The signed-in-user guard every Lumen API route starts with.
//
// It was written out by hand in 23 route files — the same nine lines,
// twenty-eight times. That is not just noise: a guard copied by hand is a
// guard that can be copied slightly wrong, or forgotten entirely on the
// next route, and nothing would fail loudly if it were. One shared version
// means one place to read, and one place to change.
//
// Returns either the client and user to work with, or the 401 to return:
//
//   const auth = await requireUser();
//   if (auth.response) return auth.response;
//   const { supabase, user } = auth;

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;
type User = NonNullable<Awaited<ReturnType<SupabaseServerClient["auth"]["getUser"]>>["data"]["user"]>;

type Authenticated = { response?: undefined; supabase: SupabaseServerClient; user: User };
type Rejected = { response: NextResponse; supabase?: undefined; user?: undefined };

export async function requireUser(): Promise<Authenticated | Rejected> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { response: NextResponse.json({ error: "Not authenticated" }, { status: 401 }) };
  }

  return { supabase, user };
}
