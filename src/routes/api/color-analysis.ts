import { createFileRoute } from "@tanstack/react-router";

const PALETTES = [
  "Neutrals",
  "Earth tones",
  "Black & white",
  "Blush & rose",
  "Deep jewel tones",
  "Navy & cobalt",
  "Warm reds",
  "Olive & sage",
];

export const Route = createFileRoute("/api/color-analysis")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const key = process.env.LOVABLE_API_KEY;
        if (!key) {
          return Response.json({ error: "LOVABLE_API_KEY not configured" }, { status: 500 });
        }

        let body: { image?: string };
        try {
          body = (await request.json()) as { image?: string };
        } catch {
          return Response.json({ error: "Invalid JSON" }, { status: 400 });
        }

        const image = body.image?.trim();
        if (!image || !image.startsWith("data:image/")) {
          return Response.json({ error: "Missing or invalid image data URL" }, { status: 400 });
        }
        if (image.length > 8_000_000) {
          return Response.json({ error: "Image too large (max ~6MB)" }, { status: 413 });
        }

        const systemPrompt = `You are a professional seasonal color analyst. Analyze the person's skin undertone, hair, and eye color from the photo to determine which color palettes flatter them most.

Return ONLY a JSON object with this exact shape:
{
  "season": "Spring" | "Summer" | "Autumn" | "Winter",
  "undertone": "warm" | "cool" | "neutral",
  "palettes": string[],
  "rationale": string
}

"palettes" must be a subset of: ${PALETTES.map((p) => `"${p}"`).join(", ")}.
Pick 2-4 palettes that would flatter them. "rationale" is one short sentence (max 25 words).`;

        const upstream = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${key}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              { role: "system", content: systemPrompt },
              {
                role: "user",
                content: [
                  { type: "text", text: "Analyze this photo and recommend flattering color palettes." },
                  { type: "image_url", image_url: { url: image } },
                ],
              },
            ],
            response_format: { type: "json_object" },
          }),
        });

        if (!upstream.ok) {
          const text = await upstream.text();
          if (upstream.status === 429) {
            return Response.json({ error: "Rate limit hit. Try again in a minute." }, { status: 429 });
          }
          if (upstream.status === 402) {
            return Response.json({ error: "AI credits exhausted." }, { status: 402 });
          }
          console.error("AI gateway error", upstream.status, text);
          return Response.json({ error: "AI service error" }, { status: 502 });
        }

        const data = (await upstream.json()) as {
          choices?: Array<{ message?: { content?: string } }>;
        };
        const raw = data.choices?.[0]?.message?.content ?? "{}";

        let parsed: {
          season?: string;
          undertone?: string;
          palettes?: unknown;
          rationale?: string;
        };
        try {
          parsed = JSON.parse(raw);
        } catch {
          return Response.json({ error: "AI returned invalid response" }, { status: 502 });
        }

        const palettes = Array.isArray(parsed.palettes)
          ? (parsed.palettes as unknown[]).filter(
              (p): p is string => typeof p === "string" && PALETTES.includes(p),
            )
          : [];

        return Response.json({
          season: parsed.season ?? null,
          undertone: parsed.undertone ?? null,
          palettes,
          rationale: parsed.rationale ?? "",
        });
      },
    },
  },
});
