export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { email, firstName } = req.body;
  if (!email || !firstName) return res.status(400).json({ error: "Missing email or firstName" });

  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_API_KEY) {
    // Silently succeed if no key configured — don't block the signup flow
    return res.status(200).json({ sent: false, reason: "No RESEND_API_KEY configured" });
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "reffered <hello@reffered.com>",
        to: [email],
        subject: `Welcome to reffered, ${firstName} ✦`,
        html: `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f4f2ff;font-family:sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f2ff;padding:48px 20px;">
    <tr><td align="center">
      <table width="540" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:20px;border:2px solid #1A00B9;overflow:hidden;box-shadow:6px 6px 0 #1A00B9;">
        <!-- Header -->
        <tr>
          <td style="background:#1A00B9;padding:28px 40px;">
            <p style="color:#B7CF4F;font-size:11px;font-weight:800;letter-spacing:3px;text-transform:uppercase;margin:0 0 6px;">Community Powered</p>
            <h1 style="color:#fff;font-size:28px;font-weight:900;margin:0;letter-spacing:-1px;">reffered ✦</h1>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:40px 40px 32px;">
            <p style="font-size:22px;font-weight:900;color:#1A00B9;margin:0 0 16px;font-family:Georgia,serif;">Hey ${firstName}, you're in! 🎉</p>
            <p style="font-size:15px;color:#444;line-height:1.7;margin:0 0 20px;">
              Thanks for joining reffered — the community-powered beauty professional directory. Your profile is now live and searchable by clients in your city.
            </p>
            <div style="background:#f4f2ff;border-radius:12px;border:1.5px solid #e0ddf5;padding:20px 24px;margin:0 0 24px;">
              <p style="font-size:11px;font-weight:800;letter-spacing:2px;text-transform:uppercase;color:#9B8AFB;margin:0 0 12px;">What's next</p>
              <table cellpadding="0" cellspacing="0" width="100%">
                <tr><td style="padding:6px 0;">
                  <span style="color:#1A00B9;font-weight:800;margin-right:10px;">✓</span>
                  <span style="font-size:14px;color:#333;">Complete your dashboard — add your bio, social links &amp; booking URL</span>
                </td></tr>
                <tr><td style="padding:6px 0;">
                  <span style="color:#1A00B9;font-weight:800;margin-right:10px;">✓</span>
                  <span style="font-size:14px;color:#333;">Share your reffered profile link with clients</span>
                </td></tr>
                <tr><td style="padding:6px 0;">
                  <span style="color:#1A00B9;font-weight:800;margin-right:10px;">✓</span>
                  <span style="font-size:14px;color:#333;">Ask happy clients to leave a referral — every review builds your reputation</span>
                </td></tr>
              </table>
            </div>
            <table cellpadding="0" cellspacing="0">
              <tr><td style="background:#1A00B9;border-radius:30px;box-shadow:4px 4px 0 #B7CF4F;">
                <a href="https://recommended2-chi.vercel.app/?page=dashboard" style="display:inline-block;padding:14px 32px;color:#fff;font-size:14px;font-weight:800;text-decoration:none;letter-spacing:0.5px;">Go to My Dashboard →</a>
              </td></tr>
            </table>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="background:#f9f8ff;border-top:1.5px solid #e0ddf5;padding:20px 40px;">
            <p style="font-size:11px;color:#aaa;margin:0;line-height:1.6;">
              You're receiving this because you just created a reffered account.<br>
              Questions? Reply to this email or reach us at <a href="mailto:hello@reffered.com" style="color:#1A00B9;font-weight:700;">hello@reffered.com</a>
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
        `.trim(),
      }),
    });

    const result = await response.json();
    if (!response.ok) {
      console.error("Resend error:", result);
      return res.status(200).json({ sent: false, reason: result.message });
    }
    res.status(200).json({ sent: true, id: result.id });
  } catch (err) {
    console.error("Welcome email error:", err.message);
    // Don't fail the signup — just log it
    res.status(200).json({ sent: false, reason: err.message });
  }
}
