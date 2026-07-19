const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
const BUCKET = "closet-images";

/** Returns the best available auth token — valid session JWT if logged in, else anon key. */
function getToken(): string {
  try {
    const raw = localStorage.getItem("sb.session");
    if (raw) {
      const s = JSON.parse(raw) as { access_token?: string };
      if (s.access_token) {
        // Decode JWT payload to check expiry
        const parts = s.access_token.split(".");
        if (parts.length === 3) {
          const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"))) as { exp?: number };
          if (payload.exp && Date.now() / 1000 < payload.exp - 30) {
            return s.access_token;
          }
        }
      }
    }
  } catch { /* ignore */ }
  return ANON_KEY;
}

/** Returns the authenticated user's ID (sub claim) from the session JWT, or "anon". */
function getUserId(): string {
  try {
    const raw = localStorage.getItem("sb.session");
    if (raw) {
      const s = JSON.parse(raw) as { access_token?: string };
      if (s.access_token) {
        const parts = s.access_token.split(".");
        if (parts.length === 3) {
          const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"))) as { sub?: string };
          if (payload.sub) return payload.sub;
        }
      }
    }
  } catch { /* ignore */ }
  return "anon";
}

const PHOTOROOM_KEY_DEFAULT = "sk_pr_clem_c4384364b2312664bc8c18e8d307d62a1030f36e";
const PHOTOROOM_LS_KEY = "clem.photoroom_key";

function getPhotoroomKey(): string {
  try { return localStorage.getItem(PHOTOROOM_LS_KEY) ?? PHOTOROOM_KEY_DEFAULT; } catch { return PHOTOROOM_KEY_DEFAULT; }
}

export function setPhotoroomKey(key: string): void {
  try {
    if (key.trim()) { localStorage.setItem(PHOTOROOM_LS_KEY, key.trim()); }
    else { localStorage.removeItem(PHOTOROOM_LS_KEY); }
  } catch { /* ignore */ }
}

export function getStoredPhotoroomKey(): string {
  try { return localStorage.getItem(PHOTOROOM_LS_KEY) ?? ""; } catch { return ""; }
}

const PICSART_KEY_DEFAULT = "paat-l8v34XQiEFSmtsm0jm6320DVL1R";
const PICSART_LS_KEY = "clem.picsart_key";

function getPicsartKey(): string {
  try { return localStorage.getItem(PICSART_LS_KEY) ?? PICSART_KEY_DEFAULT; } catch { return PICSART_KEY_DEFAULT; }
}

export function setPicsartKey(key: string): void {
  try {
    if (key.trim()) { localStorage.setItem(PICSART_LS_KEY, key.trim()); }
    else { localStorage.removeItem(PICSART_LS_KEY); }
  } catch { /* ignore */ }
}

export function getStoredPicsartKey(): string {
  try { return localStorage.getItem(PICSART_LS_KEY) ?? ""; } catch { return ""; }
}

/**
 * Remove the background from a clothing photo via Picsart removebg API
 * and replace it with a warm linen background (#F0E2CE).
 */
export async function picsartRemoveBackground(file: File | Blob): Promise<Blob> {
  const key = getPicsartKey();
  if (!key) throw new Error("Picsart API key missing — add it in Profile → Settings.");

  const formData = new FormData();
  formData.append("image", file instanceof File ? file : new File([file], "image.jpg", { type: "image/jpeg" }));
  formData.append("bg_color", "F0E2CE");
  formData.append("format", "PNG");

  const res = await fetch("https://api.picsart.io/tools/1.0/removebg", {
    method: "POST",
    headers: { "X-Picsart-API-Key": key },
    body: formData,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Picsart error ${res.status}: ${err.slice(0, 200)}`);
  }

  const json = await res.json() as { data?: { url?: string } };
  const url = json.data?.url;
  if (!url) throw new Error("Picsart returned no image URL");

  const imgRes = await fetch(url);
  if (!imgRes.ok) throw new Error(`Failed to download Picsart result: ${imgRes.status}`);
  return imgRes.blob();
}

/**
 * Remove the background from a clothing photo via PhotoRoom v2 edit API
 * and replace it with a warm linen background (#F0E2CE).
 */
export async function replaceBackground(file: File | Blob): Promise<Blob> {
  const formData = new FormData();
  formData.append(
    "imageFile",
    file instanceof File ? file : new File([file], "image.jpg", { type: "image/jpeg" }),
  );
  formData.append("padding", "0.1");
  formData.append("background.color", "F0E2CE");

  const res = await fetch("https://image-api.photoroom.com/v2/edit", {
    method: "POST",
    headers: { "x-api-key": getPhotoroomKey() },
    body: formData,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`PhotoRoom error ${res.status}: ${err.slice(0, 200)}`);
  }

  return res.blob();
}

async function photoroomEdit(file: File | Blob, params: Record<string, string>): Promise<Blob> {
  const formData = new FormData();
  formData.append("imageFile", file instanceof File ? file : new File([file], "image.jpg", { type: "image/jpeg" }));
  for (const [k, v] of Object.entries(params)) formData.append(k, v);
  const res = await fetch("https://image-api.photoroom.com/v2/edit", {
    method: "POST",
    headers: { "x-api-key": getPhotoroomKey() },
    body: formData,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`PhotoRoom error ${res.status}: ${err.slice(0, 200)}`);
  }
  return res.blob();
}

/**
 * Apply PhotoRoom AI flat-lay effect (flatLay.mode=ai.auto) to a clothing photo.
 */
export async function flatLayPhoto(file: File | Blob): Promise<Blob> {
  return photoroomEdit(file, { "flatLay.mode": "ai.auto" });
}

export type ClothingCategory = "Tops" | "Bottoms" | "Dresses" | "Sweaters" | "Shoes" | "Accessories" | "Outerwear";

/**
 * Category-aware smart edit: picks the best PhotoRoom effect for the clothing type.
 * - Tops / Sweaters / Outerwear / Dresses → ghost mannequin (invisible mannequin fill)
 * - Bottoms → flat lay
 * - Shoes / Accessories → background removal + soft AI shadow on white
 */
export async function smartEditPhoto(file: File | Blob, category: ClothingCategory): Promise<Blob> {
  switch (category) {
    case "Tops":
    case "Sweaters":
    case "Outerwear":
    case "Dresses":
      return photoroomEdit(file, { "ghostMannequin.mode": "ai.auto" });
    case "Bottoms":
      return photoroomEdit(file, { "flatLay.mode": "ai.auto" });
    case "Shoes":
    case "Accessories":
      return photoroomEdit(file, {
        "removeBackground": "true",
        "shadow.mode": "ai.soft",
        "background.color": "FFFFFF",
        "padding": "0.1",
      });
  }
}

const RANDOM_EFFECTS = [
  { label: "Flat lay",        params: { "flatLay.mode": "ai.auto" } },
  { label: "Ghost mannequin", params: { "ghostMannequin.mode": "ai.auto" } },
  { label: "Soft shadow",     params: { removeBackground: "true", "shadow.mode": "ai.soft", "background.color": "FFFFFF", padding: "0.1" } },
  { label: "Beautify",        params: { "beautify.mode": "ai.auto", removeBackground: "true" } },
  { label: "Ironing",         params: { "ironing.mode": "ai.auto", removeBackground: "true", "background.color": "F0E2CE" } },
] as const;

/**
 * Random edit: picks one of flat lay / ghost mannequin / shadow / beautify / ironing at random.
 * Returns the blob and the name of the effect applied (for display).
 */
export async function randomEditPhoto(file: File | Blob): Promise<{ blob: Blob; label: string }> {
  const pick = RANDOM_EFFECTS[Math.floor(Math.random() * RANDOM_EFFECTS.length)];
  const blob = await photoroomEdit(file, { ...pick.params });
  return { blob, label: pick.label };
}

/**
 * Send a clothing photo to GPT Image 2 via Replicate for AI studio processing.
 * Category-aware prompt: ghost mannequin (tops/dresses), flat lay (bottoms), product shot (shoes/accessories).
 * Costs ~$0.011/image (low quality). Requires REPLICATE_API_KEY on the server.
 */

/** Resize + convert to JPEG (max 1024px). Keeps payload well under Vercel's 4.5MB body limit. */
function toJpeg(file: File | Blob, maxPx = 1024): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("JPEG conversion failed"))),
        "image/jpeg",
        0.88,
      );
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Image load failed")); };
    img.src = url;
  });
}

export async function gptImageStudio(file: File | Blob, category: string, style?: string, description?: string): Promise<Blob> {
  // Always resize + convert to JPEG — keeps base64 payload well under Vercel's 4.5MB limit
  const fileToSend = await toJpeg(file);

  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(fileToSend);
  });

  const res = await fetch("/api/replicate-image", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ imageBase64: base64, category, style, description }),
  });

  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? `Studio error ${res.status}`);
  }

  const { imageData } = (await res.json()) as { imageData: string };
  if (!imageData) throw new Error("No image returned from AI Studio");

  // imageData is a base64 data URL — convert directly to blob, no cross-origin fetch needed
  const imgRes = await fetch(imageData);
  return imgRes.blob();
}

/** Upload a File or Blob to Supabase Storage and return the public URL. */
export async function uploadClosetImage(file: File | Blob): Promise<string> {
  const ext = file instanceof File && file.name.includes(".") ? file.name.split(".").pop() : "jpg";
  const uid = getUserId();
  const path = `${uid}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const contentType = file instanceof File ? file.type : "image/jpeg";

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);

  let res: Response;
  try {
    res = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${getToken()}`,
        apikey: ANON_KEY,
        "Content-Type": contentType,
        "x-upsert": "true",
      },
      body: file,
      signal: controller.signal,
    });
  } catch (e) {
    throw new Error(e instanceof Error && e.name === "AbortError" ? "Upload timed out after 30s — check your connection and try again." : `Upload failed: ${String(e)}`);
  } finally {
    clearTimeout(timer);
  }

  // If auth failed (expired token), retry with anon key
  if (res.status === 400 || res.status === 401 || res.status === 403) {
    const errText = await res.text();
    if (getToken() !== ANON_KEY) {
      const retry = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${ANON_KEY}`,
          apikey: ANON_KEY,
          "Content-Type": contentType,
          "x-upsert": "true",
        },
        body: file,
        signal: controller.signal,
      });
      if (!retry.ok) {
        const retryErr = await retry.text();
        throw new Error(`Image upload failed (${retry.status}): ${retryErr.slice(0, 200)}`);
      }
      return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`;
    }
    throw new Error(`Image upload failed (${res.status}): ${errText.slice(0, 200)}`);
  }

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Image upload failed (${res.status}): ${err.slice(0, 200)}`);
  }

  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`;
}

