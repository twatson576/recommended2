export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  if (!OPENAI_API_KEY) return res.status(500).json({ error: "No OPENAI_API_KEY configured" });

  const { pro, message, history } = req.body;
  if (!pro || !message) return res.status(400).json({ error: "Missing pro or message" });

  const systemPrompt = `You are a business advisor for beauty professionals. You give practical, specific, actionable advice to help them grow their client base, improve their reputation, and run a better business.

Here is the pro's profile data:
- Name: ${pro.name}
- Specialty: ${pro.specialty}
- Location: ${pro.location}
- Bio: ${pro.bio || "Not set"}
- Instagram: ${pro.instagram || "Not set"}
- Booking link: ${pro.booking || "Not set"}
- Overall rating: ${pro.ratings?.overall || "N/A"} / 5
- Wait time rating: ${pro.ratings?.waitTime || "N/A"} / 5
- Value rating: ${pro.ratings?.value || "N/A"} / 5
- Communication rating: ${pro.ratings?.communication || "N/A"} / 5
- Total reviews: ${pro.reviews || 0}

Give advice that is specific to their specialty and location. Be direct and helpful. Keep responses concise — 2-4 short paragraphs max. Use plain language, no corporate jargon.`;

  const messages = [
    { role: "system", content: systemPrompt },
    ...(history || []),
    { role: "user", content: message },
  ];

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages,
        max_tokens: 600,
        temperature: 0.7,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      console.error("OpenAI error:", data);
      return res.status(500).json({ error: data.error?.message || "AI error" });
    }

    res.status(200).json({ reply: data.choices[0].message.content });
  } catch (err) {
    console.error("Advisor error:", err.message);
    res.status(500).json({ error: err.message });
  }
}
