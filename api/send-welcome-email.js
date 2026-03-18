export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { email, firstName } = req.body;
  if (!email || !firstName) return res.status(400).json({ error: "Missing email or firstName" });

  const LOOPS_API_KEY = process.env.LOOPS_API_KEY;
  if (!LOOPS_API_KEY) {
    return res.status(200).json({ sent: false, reason: "No LOOPS_API_KEY configured" });
  }

  try {
    const response = await fetch("https://app.loops.so/api/v1/transactional", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOOPS_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        transactionalId: "cmmvaw9710tke0hx20mri974m",
        email,
        dataVariables: { firstName },
      }),
    });

    const result = await response.json();
    if (!response.ok) {
      console.error("Loops error:", result);
      return res.status(200).json({ sent: false, reason: result.message });
    }
    res.status(200).json({ sent: true });
  } catch (err) {
    console.error("Welcome email error:", err.message);
    res.status(200).json({ sent: false, reason: err.message });
  }
}
