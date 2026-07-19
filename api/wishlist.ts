const GEMINI = "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent";

function hostBrand(url: string): string | undefined {
  try {
    const h = new URL(url).hostname.replace(/^www\./, "").split(".")[0];
    return h.charAt(0).toUpperCase() + h.slice(1);
  } catch {
    return undefined;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { action, ...data } = req.body as Record<string, unknown>;

  try {
    // ── Scrape: microlink.io (no API key needed) ──────────────────────────────
    if (action === "scrape") {
      const url = data.url as string;
      try {
        const TRACKING = /^(utm_|gclid|gclsrc|gbraid|wbraid|gad_|fbclid|msclkid)/i;
        let cleanUrl = url;
        try {
          const u = new URL(url);
          for (const key of [...u.searchParams.keys()]) {
            if (TRACKING.test(key)) u.searchParams.delete(key);
          }
          cleanUrl = u.toString();
        } catch { /* keep original */ }

        const mlRes = await fetch(`https://api.microlink.io?url=${encodeURIComponent(cleanUrl)}`);
        const json = (await mlRes.json()) as {
          data?: { title?: string; description?: string; image?: { url?: string }; publisher?: string };
        };
        const d = json.data ?? {};
        let imageUrl: string | undefined = d.image?.url ?? undefined;

        // If microlink returned no image, try to extract og:image directly
        if (!imageUrl) {
          try {
            const pageRes = await fetch(cleanUrl, {
              headers: { "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1)" },
              signal: AbortSignal.timeout(5000),
            });
            const html = await pageRes.text();
            const ogMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
              ?? html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
            if (ogMatch?.[1]) imageUrl = ogMatch[1];
          } catch { /* keep no image */ }
        }

        return res.json({
          url,
          title: (d.title ?? hostBrand(url) ?? "Saved item").slice(0, 140),
          image: imageUrl,
          brand: d.publisher ?? hostBrand(url),
          description: d.description?.slice(0, 200),
        });
      } catch {
        return res.json({ url, title: hostBrand(url) ?? "Saved item", brand: hostBrand(url) });
      }
    }

    // ── Search: Gemini with Google Search grounding ───────────────────────────
    if (action === "search") {
      const query = data.query as string;
      const k = process.env.VITE_GEMINI_API_KEY;
      if (!k) return res.status(500).json({ error: "VITE_GEMINI_API_KEY missing" });

      const searchRes = await fetch(`${GEMINI}?key=${k}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            role: "user",
            parts: [{ text: `Find fashion products to buy for: "${query}". Return a JSON array of up to 8 real purchasable products from actual retailers: [{"url":"<product page URL>","title":"<product name>","brand":"<brand>","description":"<brief description>"}]. Only include items with valid https URLs.` }],
          }],
          tools: [{ googleSearch: {} }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 1024 },
        }),
      });

      if (!searchRes.ok) return res.json([]);
      const json = (await searchRes.json()) as {
        candidates?: Array<{
          content?: { parts?: Array<{ text?: string }> };
          groundingMetadata?: { groundingChunks?: Array<{ web?: { uri?: string; title?: string } }> };
        }>;
      };

      const raw = json.candidates?.[0]?.content?.parts?.[0]?.text ?? "[]";
      const chunks = json.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];

      type Product = { url: string; title: string; brand?: string; description?: string };
      let products: Product[] = [];
      try {
        const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
        const parsed = JSON.parse(cleaned) as Product[];
        products = Array.isArray(parsed) ? parsed.filter((p) => p.url?.startsWith("http")) : [];
      } catch { /* ignore */ }

      // Fall back to grounding chunks if JSON parse fails or empty
      if (products.length === 0) {
        products = chunks
          .filter((c) => c.web?.uri?.startsWith("http"))
          .map((c) => ({ url: c.web!.uri!, title: c.web!.title ?? "Product", brand: hostBrand(c.web!.uri!) }));
      }

      // Fetch images for top 3 results in parallel via microlink
      const top3 = products.slice(0, 3);
      const withImages = await Promise.all(
        top3.map(async (p) => {
          try {
            const mlRes = await fetch(`https://api.microlink.io?url=${encodeURIComponent(p.url)}`, {
              signal: AbortSignal.timeout(4000),
            });
            const ml = (await mlRes.json()) as { data?: { image?: { url?: string } } };
            return {
              url: p.url,
              title: (p.title || "Product").slice(0, 140),
              brand: p.brand ?? hostBrand(p.url),
              description: (p.description ?? "").slice(0, 200),
              image: ml.data?.image?.url ?? undefined,
            };
          } catch {
            return {
              url: p.url,
              title: (p.title || "Product").slice(0, 140),
              brand: p.brand ?? hostBrand(p.url),
              description: (p.description ?? "").slice(0, 200),
            };
          }
        }),
      );

      return res.json(withImages);
    }

    // ── Identify: Gemini vision ───────────────────────────────────────────────
    if (action === "identify") {
      const image = data.image as string;
      const k = process.env.VITE_GEMINI_API_KEY;
      if (!k) return res.status(500).json({ error: "VITE_GEMINI_API_KEY missing" });

      const [header, base64] = image.split(",");
      const mimeMatch = header?.match(/data:([^;]+)/);
      const mimeType = mimeMatch?.[1] ?? "image/jpeg";

      const aiRes = await fetch(`${GEMINI}?key=${k}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            role: "user",
            parts: [
              { text: 'You identify fashion garments in photos. Look at the single most prominent clothing or accessory item. Reply ONLY with compact JSON: {"query":"<6-10 word web search query to find this exact piece — include garment type, colour, fabric, silhouette, notable details>","description":"<one short sentence describing the piece>"}. No prose, no markdown.' },
              { inline_data: { mime_type: mimeType, data: base64 ?? image } },
            ],
          }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 200, responseMimeType: "application/json" },
        }),
      });

      if (aiRes.status === 429) return res.status(429).json({ error: "Rate limited — try again in a moment." });
      if (!aiRes.ok) return res.status(aiRes.status).json({ error: `identify ${aiRes.status}` });

      const json = (await aiRes.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
      const raw = json.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
      const cleaned = raw.replace(/```json|```/g, "").trim();
      try {
        const parsed = JSON.parse(cleaned) as { query?: string; description?: string };
        const query = (parsed.query ?? "").slice(0, 120).trim();
        if (!query) throw new Error("empty");
        return res.json({ query, description: (parsed.description ?? "").slice(0, 200).trim() });
      } catch {
        return res.json({ query: cleaned.slice(0, 120) || "clothing item", description: "" });
      }
    }

    return res.status(400).json({ error: "Unknown action" });
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : "Server error" });
  }
}
