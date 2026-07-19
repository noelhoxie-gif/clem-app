const REPLICATE_API_KEY = process.env.REPLICATE_API_KEY;
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

const CLEAN_SUFFIX = " Remove any visible spots, stains, lint, or blemishes from the fabric so the item looks pristine.";
const BG = "warm linen (#F0E2CE) background";

type StudioStyle = "studio" | "editorial" | "luxe" | "casual";

const PROMPTS: Record<StudioStyle, Record<string, string>> = {
  studio: {
    garment: `Professional e-commerce product photography of this clothing item. Show it shaped and structured on a ghost mannequin — invisible body form, no visible person. ${BG}. Centered, even studio lighting, sharp fabric details.`,
    bottoms: `Professional flat lay product photography. The clothing item laid perfectly flat on a ${BG}. Centered, top-down view, even overhead lighting, studio quality.`,
    product: `Professional luxury e-commerce product photography on a ${BG}. The item centered with a subtle soft shadow beneath. Warm, even studio lighting. Clean, minimal, sharp details.`,
    default: `Professional e-commerce product photography on a ${BG}. Centered, even studio lighting, clean and minimal.`,
  },
  editorial: {
    garment: `High-fashion editorial photography. This garment shaped on a ghost mannequin at a slightly dynamic angle. ${BG}. Dramatic side lighting with soft fill — bold, structured, aspirational. Fashion magazine quality.`,
    bottoms: `Editorial fashion flat lay photography. The garment artfully arranged with fabric texture prominent and a touch of asymmetry. ${BG}. Dramatic overhead lighting. Fashion magazine quality.`,
    product: `Fashion editorial product photography on a ${BG}. The item at a dynamic 3/4 angle with dramatic accent lighting. Bold and striking. Fashion magazine quality.`,
    default: `High-fashion editorial clothing photography on a ${BG}. Dynamic angle, dramatic lighting. Fashion magazine quality.`,
  },
  luxe: {
    garment: `Luxury fashion house product photography. Ghost mannequin — invisible body form, no visible person. ${BG}. Dramatic chiaroscuro lighting — rich shadows, precise fabric highlights. Premium catalog quality.`,
    bottoms: `Luxury flat lay photography on a ${BG}. Precise architectural fold with moody, dramatic overhead lighting and deep shadows. Premium fashion catalog quality.`,
    product: `Luxury product photography on a ${BG}. Dramatic accent lighting with deep moody shadows. High-end retail advertisement style — exquisite and aspirational.`,
    default: `Luxury fashion house product photography on a ${BG}. Dramatic chiaroscuro lighting, rich shadows. Premium catalog quality.`,
  },
  casual: {
    garment: `Casual everyday clothing photography. The garment on a ghost mannequin or relaxed natural fold. ${BG}. Soft, warm natural window light. Approachable and authentic — like a well-curated Instagram post.`,
    bottoms: `Casual lifestyle flat lay photography. Garment laid naturally with relaxed folds on a ${BG}. Soft natural side lighting, warm tones. Clean everyday aesthetic.`,
    product: `Casual lifestyle product photography on a ${BG}. Soft natural light, warm tones. Relatable and clean everyday style.`,
    default: `Casual lifestyle clothing photography on a ${BG}. Soft natural light, warm tones. Approachable everyday aesthetic.`,
  },
};

function buildPrompt(category: string, style: StudioStyle = "studio", description?: string): string {
  const set = PROMPTS[style] ?? PROMPTS.studio;
  let prompt: string;
  switch (category) {
    case "Tops": case "Sweaters": case "Outerwear": case "Dresses":
      prompt = set.garment; break;
    case "Bottoms":
      prompt = set.bottoms; break;
    case "Shoes": case "Accessories":
      // For small items like belts, necklaces, shoes — lead with the specific item name
      prompt = description
        ? `Product photography of this ${description}. ${set.product}`
        : set.product;
      break;
    default:
      prompt = set.default;
  }
  return prompt + CLEAN_SUFFIX;
}

/**
 * Upload base64 image to Supabase Storage so Grok gets a public HTTPS URL
 * with a proper file extension (.jpg/.png/.webp) — Grok validates the extension.
 */
async function uploadTempImage(base64DataUrl: string): Promise<{ url: string; path: string }> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) throw new Error("Supabase credentials not configured");

  const [header, base64] = base64DataUrl.split(",");
  const mimeMatch = header?.match(/data:([^;]+)/);
  const mimeType = mimeMatch?.[1] ?? "image/jpeg";
  const ext = mimeType === "image/jpeg" ? "jpg" : (mimeType.split("/")[1] ?? "jpg");
  const buffer = Buffer.from(base64, "base64");

  const path = `studio-temp/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/closet-images/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      apikey: SUPABASE_ANON_KEY,
      "Content-Type": mimeType,
      "x-upsert": "true",
    },
    body: buffer,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Temp image upload failed ${res.status}: ${err.slice(0, 200)}`);
  }

  return {
    url: `${SUPABASE_URL}/storage/v1/object/public/closet-images/${path}`,
    path,
  };
}

/** Delete temp image from Supabase after processing (best-effort cleanup). */
async function deleteTempImage(path: string): Promise<void> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return;
  await fetch(`${SUPABASE_URL}/storage/v1/object/closet-images/${path}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      apikey: SUPABASE_ANON_KEY,
    },
  }).catch(() => { /* ignore cleanup errors */ });
}

/** Download the Grok output URL server-side and return as a base64 data URL. */
async function downloadAsBase64(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to download output image: ${res.status}`);
  const contentType = res.headers.get("content-type") ?? "image/jpeg";
  const buffer = Buffer.from(await res.arrayBuffer());
  return `data:${contentType};base64,${buffer.toString("base64")}`;
}

interface Prediction {
  id: string;
  status: string;
  output?: string[] | string;
  error?: string;
  urls?: { get: string };
}

function extractOutputUrl(output: string[] | string | undefined): string | undefined {
  if (!output) return undefined;
  if (typeof output === "string") return output || undefined;
  return output[0] || undefined;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function handler(req: any, res: any) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { imageBase64, category, style, description } = req.body as { imageBase64?: string; category?: string; style?: string; description?: string };
  if (!imageBase64) return res.status(400).json({ error: "imageBase64 required" });
  if (!REPLICATE_API_KEY) return res.status(500).json({ error: "REPLICATE_API_KEY not configured on server" });

  const prompt = buildPrompt(category ?? "", (style as StudioStyle) ?? "studio", description);

  // Upload to Supabase to get a public HTTPS URL with file extension for Grok
  let tempPath: string;
  let imageUrl: string;
  try {
    ({ url: imageUrl, path: tempPath } = await uploadTempImage(imageBase64));
  } catch (e) {
    return res.status(500).json({ error: e instanceof Error ? e.message : "Image upload failed" });
  }

  // Call Grok Imagine Image
  let prediction: Prediction;
  try {
    const createRes = await fetch("https://api.replicate.com/v1/models/xai/grok-imagine-image/predictions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${REPLICATE_API_KEY}`,
        "Content-Type": "application/json",
        Prefer: "wait",
      },
      body: JSON.stringify({
        input: { prompt, image: imageUrl },
      }),
    });

    if (!createRes.ok) {
      const err = await createRes.text();
      deleteTempImage(tempPath);
      return res.status(createRes.status).json({ error: `Replicate error ${createRes.status}: ${err.slice(0, 300)}` });
    }

    prediction = (await createRes.json()) as Prediction;
  } catch (e) {
    deleteTempImage(tempPath);
    return res.status(500).json({ error: `Network error: ${e instanceof Error ? e.message : String(e)}` });
  }

  async function succeed(outputUrl: string) {
    deleteTempImage(tempPath);
    const imageData = await downloadAsBase64(outputUrl);
    return res.json({ imageData });
  }

  // Synchronous result (Prefer: wait resolved within 60s)
  const syncUrl = extractOutputUrl(prediction.output);
  if (prediction.status === "succeeded" && syncUrl) return succeed(syncUrl);
  if (prediction.error) { deleteTempImage(tempPath); return res.status(500).json({ error: prediction.error }); }

  // Async polling fallback
  const pollUrl = prediction.urls?.get ?? `https://api.replicate.com/v1/predictions/${prediction.id}`;
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 1500));
    try {
      const pollRes = await fetch(pollUrl, { headers: { Authorization: `Bearer ${REPLICATE_API_KEY}` } });
      const p = (await pollRes.json()) as Prediction;
      const pollOutputUrl = extractOutputUrl(p.output);
      if (p.status === "succeeded" && pollOutputUrl) return succeed(pollOutputUrl);
      if (p.status === "failed" || p.error) { deleteTempImage(tempPath); return res.status(500).json({ error: p.error ?? "Prediction failed" }); }
    } catch { /* retry */ }
  }

  deleteTempImage(tempPath);
  return res.status(504).json({ error: "Timed out waiting for Grok — try again" });
}
