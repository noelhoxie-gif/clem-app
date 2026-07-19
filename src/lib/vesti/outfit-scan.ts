import type { Item, Category } from "./store";
import { itemStatus } from "./store";

export interface DetectedGarment {
  category: Category;
  color: string;
  description: string;
  /** Normalized bounding box (0–1) of the garment in the source photo. */
  boundingBox?: { yMin: number; xMin: number; yMax: number; xMax: number };
}

export interface ScanMatch {
  detected: DetectedGarment;
  match: Item | null;
}

const GEMINI_MODELS = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"];

const VALID_CATEGORIES = new Set<string>([
  "Tops", "Bottoms", "Dresses", "Sweaters", "Shoes", "Accessories", "Outerwear",
]);

async function detectGarments(base64: string, apiKey: string): Promise<DetectedGarment[]> {
  const body = JSON.stringify({
    contents: [{
      role: "user",
      parts: [
        { inline_data: { mime_type: "image/jpeg", data: base64 } },
        {
          text: `Look at this photo of a person wearing clothes. Identify each visible clothing item they are wearing.
For each item return a JSON array with objects containing:
- "category": one of exactly: Tops, Bottoms, Dresses, Sweaters, Shoes, Accessories, Outerwear
- "color": primary color in 1-2 words (e.g. "white", "dark blue", "cream")
- "description": concise 2-4 word description (e.g. "button-down cotton shirt", "straight leg jeans", "white leather sneakers")
- "box_2d": bounding box of the item as [yMin, xMin, yMax, xMax] with integer values 0-1000

Only include items clearly visible on the person. Do not include background items.
Output only the JSON array, nothing else.`,
        },
      ],
    }],
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 1024,
      responseMimeType: "application/json",
    },
  });

  let res: Response | null = null;
  for (const model of GEMINI_MODELS) {
    res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body },
    );
    // Retry on rate limit (429) or server errors (5xx) — try the next model
    if (res.status !== 429 && res.status < 500) break;
    await new Promise((r) => setTimeout(r, 1000));
  }
  if (!res!.ok) throw new Error(`Gemini vision error ${res!.status}`);

  const json = await res!.json() as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const raw = json.candidates?.[0]?.content?.parts?.[0]?.text ?? "[]";
  const parsed = JSON.parse(
    raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim(),
  ) as Array<{ category: string; color: string; description: string; box_2d?: [number, number, number, number] }>;

  // Filter out invalid categories and normalize bounding boxes to 0–1 range
  return parsed
    .filter((g) => VALID_CATEGORIES.has(g.category))
    .map((g) => ({
      category: g.category as Category,
      color: g.color,
      description: g.description,
      boundingBox: Array.isArray(g.box_2d) && g.box_2d.length === 4
        ? { yMin: g.box_2d[0] / 1000, xMin: g.box_2d[1] / 1000, yMax: g.box_2d[2] / 1000, xMax: g.box_2d[3] / 1000 }
        : undefined,
    }));
}

function colorsOverlap(a: string, b: string): boolean {
  const tokens = (s: string) => s.toLowerCase().split(/[\s,/\-]+/).filter(Boolean);
  const setA = new Set(tokens(a));
  return tokens(b).some((t) => setA.has(t));
}

function descriptionScore(description: string, item: Item): number {
  const STOP = new Set(["the", "a", "an", "and", "or", "with", "for", "in", "on", "of"]);
  const tokens = (s: string) =>
    s.toLowerCase().split(/\s+/).filter((t) => t.length > 2 && !STOP.has(t));
  const itemText = [item.name, item.brand ?? "", item.color ?? ""].join(" ");
  const setB = new Set(tokens(itemText));
  return tokens(description).filter((t) => setB.has(t)).length;
}

function scoreMatch(detected: DetectedGarment, item: Item): number {
  let score = 0;
  if (item.color && detected.color && colorsOverlap(detected.color, item.color)) score += 2;
  score += descriptionScore(detected.description, item);
  return score;
}

/** Convert a Blob to JPEG and return the base64 payload (no data-URL prefix). */
async function blobToJpegBase64(blob: Blob): Promise<string> {
  const jpeg = await new Promise<Blob>((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(blob);
    img.onload = () => {
      const max = 1024;
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("Canvas conversion failed"))),
        "image/jpeg",
        0.85,
      );
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Image load failed")); };
    img.src = url;
  });

  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(jpeg);
  });
}

/**
 * Scan a photo for clothing items and match them against the user's closet.
 * Returns one ScanMatch per detected garment — match is null if no confident match found.
 */
export async function scanOutfitPhoto(
  blob: Blob,
  items: Item[],
  apiKey: string,
): Promise<ScanMatch[]> {
  const base64 = await blobToJpegBase64(blob);
  const garments = await detectGarments(base64, apiKey);
  const activeItems = items.filter((i) => itemStatus(i) === "active");

  return garments.map((g) => {
    const candidates = activeItems.filter((i) => i.category === g.category);
    if (candidates.length === 0) return { detected: g, match: null };

    let best: Item | null = null;
    let bestScore = -1;
    for (const item of candidates) {
      const s = scoreMatch(g, item);
      if (s > bestScore) { bestScore = s; best = item; }
    }

    // Require color OR at least one description token to match (score >= 2)
    return { detected: g, match: bestScore >= 2 ? best : null };
  });
}
