// Sends the one-time "new account signed up" email to the app owner via
// Resend. Deliberately fire-and-forget from the caller's perspective: a
// failed or unconfigured notification must never block the user's actual
// sign-in/confirmation redirect, so every failure is logged and swallowed
// here rather than thrown.

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const ADMIN_NOTIFY_EMAIL = process.env.ADMIN_NOTIFY_EMAIL;
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? "Lumen <onboarding@resend.dev>";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function notifyAdminOfNewSignup(userEmail: string, signedUpAt: Date): Promise<void> {
  if (!RESEND_API_KEY || !ADMIN_NOTIFY_EMAIL) {
    console.error("New-signup notification skipped: RESEND_API_KEY or ADMIN_NOTIFY_EMAIL is not set.");
    return;
  }

  const timestamp = signedUpAt.toISOString();

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: ADMIN_NOTIFY_EMAIL,
        subject: `New Lumen signup: ${userEmail}`,
        html: `
          <p>A new Lumen account was just verified.</p>
          <p>
            <strong>Email:</strong> ${escapeHtml(userEmail)}<br />
            <strong>Signed up at:</strong> ${timestamp} (UTC)
          </p>
          <p style="color:#888;font-size:12px">This is a one-time notification — you won't be emailed again for this account's future sign-ins.</p>
        `,
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(`New-signup notification email failed (${res.status}): ${body}`);
    }
  } catch (err) {
    console.error("New-signup notification email failed:", err);
  }
}
