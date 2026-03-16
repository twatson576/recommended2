export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { description, photoBase64, photoMimeType, pros } = req.body;
  if (!description && !photoBase64) return res.status(400).json({ error: "Please describe what you're looking for." });
  if (!pros || pros.length === 0) return res.status(400).json({ error: "No pros available to match." });

  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  if (!OPENAI_API_KEY) return res.status(500).json({ error: "Matching service not configured." });

  // Summarise pros — only send fields the AI needs
  const prosSummary = pros.map(p => ({
    id: p.id,
    name: p.name,
    specialty: p.specialty,
    location: p.location,
    bio: p.bio || "",
    tags: (p.tags || []).join(", "),
    overallRating: p.ratings?.serviceOutcome
      ? ((Object.values(p.ratings).filter(v => v > 0).reduce((a, b) => a + b, 0)) /
         (Object.values(p.ratings).filter(v => v > 0).length || 1)).toFixed(1)
      : "0",
    valueRating: p.ratings?.value || 0,
    communicationRating: p.ratings?.communication || 0,
    waitTimeRating: p.ratings?.waitTime || 0,
    reviews: p.reviews || 0,
  }));

  const systemPrompt = `You are a beauty professional matchmaker for "reffered" — a community-powered beauty directory. Match clients to the best-fit beauty pros based on their description and/or inspiration photo.

Return ONLY a valid JSON array of the top 5 matches (or all pros if fewer than 5 exist). No markdown, no explanation — just the array.

Format:
[
  {
    "id": "exact-pro-id-from-list",
    "matchScore": 94,
    "reason": "1-2 specific sentences explaining why this pro is a great fit, referencing their specialty, location, ratings, or style."
  }
]

Tips:
- Match specialty first (hair vs nails vs lash etc.)
- Factor in location if the client mentions a city
- If client mentions budget → weight value rating
- If client mentions punctuality/time → weight wait time rating
- If client mentions communication → weight communication rating
- Reference real details from the pro's bio/tags to make reasons feel personal`;

  const userContent = [];

  const prosText = `Available pros:\n${JSON.stringify(prosSummary, null, 2)}`;

  if (description && photoBase64) {
    userContent.push({ type: "text", text: `Client is looking for: "${description}"\n\nThey also uploaded an inspiration photo — factor the style shown into your matching.\n\n${prosText}` });
    userContent.push({ type: "image_url", image_url: { url: `data:${photoMimeType || "image/jpeg"};base64,${photoBase64}` } });
  } else if (description) {
    userContent.push({ type: "text", text: `Client is looking for: "${description}"\n\n${prosText}` });
  } else {
    userContent.push({ type: "text", text: `Client uploaded an inspiration photo. Match them with the best beauty pro for this style.\n\n${prosText}` });
    userContent.push({ type: "image_url", image_url: { url: `data:${photoMimeType || "image/jpeg"};base64,${photoBase64}` } });
  }

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
        max_tokens: 1200,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const err = await response.json();
      return res.status(500).json({ error: err.error?.message || "OpenAI error" });
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content || "[]";

    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return res.status(500).json({ error: "Could not parse match results." });

    const matches = JSON.parse(jsonMatch[0]);
    return res.status(200).json({ matches });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
