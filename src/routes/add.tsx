import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { PageShell } from "@/components/vesti/PageShell";
import { CATEGORIES, SEASONS, POPULAR_BRANDS, type Category, type Season, type DepartingIntent, closet } from "@/lib/vesti/store";
import { uploadClosetImage, replaceBackground, flatLayPhoto, smartEditPhoto, gptImageStudio } from "@/lib/vesti/supabase-storage";
import { useCredits, consumeCredits, addCredits, CREDIT_COSTS } from "@/lib/vesti/credits";
import { ArrowLeft, Camera, Link2, Sparkles, Wand2, Layers, Wand, Zap } from "lucide-react";

function compressImage(file: File | Blob, maxPx = 900, quality = 0.82): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Compression failed"))), "image/jpeg", quality);
    };
    img.onerror = reject;
    img.src = url;
  });
}


export const Route = createFileRoute("/add")({
  head: () => ({ meta: [{ title: "I bought this — Clem" }] }),
  component: AddPage,
});

type Mode = "photo" | "link";

function inferCategory(text: string): Category {
  const t = text.toLowerCase();
  if (/(boot|sneaker|heel|shoe|loafer|sandal|mule)/.test(t)) return "Shoes";
  if (/(coat|trench|jacket|blazer|parka)/.test(t)) return "Outerwear";
  if (/(bag|necklace|earring|belt|scarf|hat|jewel|ring|sunglass)/.test(t)) return "Accessories";
  if (/(pant|trouser|jean|skirt|short|legging)/.test(t)) return "Bottoms";
  if (/(dress|gown|jumpsuit|romper|maxi|midi|mini dress)/.test(t)) return "Dresses";
  if (/(sweater|sweatshirt|pullover|hoodie|knit|cardigan|fleece|cable)/.test(t)) return "Sweaters";
  return "Tops";
}

async function detectClothingAI(imageBlob: Blob): Promise<{ name?: string; category?: Category; color?: string; season?: Season } | null> {
  const key = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;
  if (!key) return null;
  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(imageBlob);
  });
  const models = ["gemini-3.1-flash-lite", "gemini-2.5-flash"];
  const body = JSON.stringify({
    contents: [{ role: "user", parts: [
      { inline_data: { mime_type: "image/jpeg", data: base64 } },
      { text: `Analyze this clothing item image. Return a JSON object with exactly these fields:
- "name": concise product name (e.g. "Silk Slip Dress", "Cashmere Turtleneck", "White Linen Shirt")
- "category": one of: Tops, Bottoms, Dresses, Sweaters, Shoes, Accessories, Outerwear
- "color": primary color in one or two words
- "season": one of: Warm, Cold, Year-round

Output only the JSON object, nothing else.` }
    ]}],
    generationConfig: { temperature: 0.1, maxOutputTokens: 128, responseMimeType: "application/json" },
  });
  try {
    let res: Response | null = null;
    for (const model of models) {
      res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body }
      );
      if (res.status !== 429) break;
      await new Promise((r) => setTimeout(r, 1000));
    }
    if (!res!.ok) return null;
    const json = await res!.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
    const raw = json.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
    return JSON.parse(raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim()) as { name?: string; category?: Category; color?: string; season?: Season };
  } catch {
    return null;
  }
}

function AddPage() {
  const navigate = useNavigate();
  const credits = useCredits();
  const [mode, setMode] = useState<Mode>("photo");
  const [preview, setPreview] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [color, setColor] = useState("");
  const [link, setLink] = useState("");
  const [category, setCategory] = useState<Category>("Tops");
  const [season, setSeason] = useState<Season>("Year-round");
  const fileRef = useRef<HTMLInputElement>(null);
  const [rawFile, setRawFile] = useState<File | Blob | null>(null);
  const [cleaningBg, setCleaningBg] = useState(false);
  const [bgError, setBgError] = useState<string | null>(null);
  const [flatLaying, setFlatLaying] = useState(false);
  const [flatLayError, setFlatLayError] = useState<string | null>(null);
  const [smartEditing, setSmartEditing] = useState(false);
  const [smartEditError, setSmartEditError] = useState<string | null>(null);
  const [studioProcessing, setStudioProcessing] = useState(false);
  const [studioError, setStudioError] = useState<string | null>(null);
  const [studioStyle, setStudioStyle] = useState<"studio" | "editorial" | "luxe" | "casual">("studio");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [linkLoading, setLinkLoading] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [detecting, setDetecting] = useState(false);
  const [showBrandSuggestions, setShowBrandSuggestions] = useState(false);
  const [status, setStatus] = useState<"active" | "archived" | "departing" | "vault">("active");
  const [departingIntent, setDepartingIntent] = useState<DepartingIntent>("sell");
  const [memoryStory, setMemoryStory] = useState("");
  const [memoryOccasion, setMemoryOccasion] = useState("");
  const [memoryPerson, setMemoryPerson] = useState("");

  const onFile = async (file?: File) => {
    if (!file) return;
    let blob: Blob;
    try {
      blob = await compressImage(file);
    } catch {
      blob = file;
    }
    setRawFile(blob);
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result as string);
    reader.readAsDataURL(blob);
    // AI auto-detect (1 credit) — skip silently if insufficient
    if (consumeCredits(CREDIT_COSTS.aiSuggest)) {
      setDetecting(true);
      const detected = await detectClothingAI(blob).catch(() => null);
      setDetecting(false);
      if (detected) {
        if (detected.name) setName(detected.name);
        if (detected.category) setCategory(detected.category);
        if (detected.color) setColor(detected.color);
        if (detected.season) setSeason(detected.season);
      }
    }
  };

  const onCleanBackground = async () => {
    if (!rawFile) return;
    if (!consumeCredits(CREDIT_COSTS.bgRemoval)) {
      setBgError("not-enough");
      return;
    }
    setCleaningBg(true);
    setBgError(null);
    try {
      const blob = await replaceBackground(rawFile);
      setRawFile(blob);
      const reader = new FileReader();
      reader.onload = () => setPreview(reader.result as string);
      reader.readAsDataURL(blob);
    } catch (e) {
      setBgError(e instanceof Error ? e.message : "Background clean failed");
    } finally {
      setCleaningBg(false);
    }
  };

  const onFlatLay = async () => {
    if (!rawFile) return;
    if (!consumeCredits(CREDIT_COSTS.flatLay)) {
      setFlatLayError("not-enough");
      return;
    }
    setFlatLaying(true);
    setFlatLayError(null);
    try {
      const blob = await flatLayPhoto(rawFile);
      setRawFile(blob);
      const reader = new FileReader();
      reader.onload = () => setPreview(reader.result as string);
      reader.readAsDataURL(blob);
    } catch (e) {
      setFlatLayError(e instanceof Error ? e.message : "Flat lay failed");
    } finally {
      setFlatLaying(false);
    }
  };


  const onGptStudio = async () => {
    if (!rawFile) return;
    if (!consumeCredits(CREDIT_COSTS.gptStudio)) {
      setStudioError("not-enough");
      return;
    }
    setStudioProcessing(true);
    setStudioError(null);
    try {
      const blob = await gptImageStudio(rawFile, category, studioStyle);
      setRawFile(blob);
      const reader = new FileReader();
      reader.onload = () => setPreview(reader.result as string);
      reader.readAsDataURL(blob);
    } catch (e) {
      setStudioError(e instanceof Error ? e.message : "GPT Studio failed");
    } finally {
      setStudioProcessing(false);
    }
  };

  const onSmartEdit = async () => {
    if (!rawFile) return;
    if (!consumeCredits(CREDIT_COSTS.smartEdit)) {
      setSmartEditError("not-enough");
      return;
    }
    setSmartEditing(true);
    setSmartEditError(null);
    try {
      const blob = await smartEditPhoto(rawFile, category);
      setRawFile(blob);
      const reader = new FileReader();
      reader.onload = () => setPreview(reader.result as string);
      reader.readAsDataURL(blob);
    } catch (e) {
      setSmartEditError(e instanceof Error ? e.message : "Smart edit failed");
    } finally {
      setSmartEditing(false);
    }
  };

  const onLinkPreview = async () => {
    if (!link.trim()) return;
    setLinkLoading(true);
    setLinkError(null);
    try {
      // Strip ad/tracking params that cause 400s on long URLs
      const TRACKING = /^(utm_|gclid|gclsrc|gbraid|wbraid|gad_|fbclid|msclkid|cid|sl|locale|sz)/i;
      let cleanedUrl = link.trim();
      try {
        const u = new URL(cleanedUrl);
        for (const key of [...u.searchParams.keys()]) {
          if (TRACKING.test(key)) u.searchParams.delete(key);
        }
        cleanedUrl = u.toString();
      } catch { /* keep original if invalid URL */ }
      const res = await fetch(`https://api.microlink.io?url=${encodeURIComponent(cleanedUrl)}`);
      const json = await res.json() as {
        status: string;
        data?: {
          image?: { url?: string };
          title?: string;
          publisher?: string;
        };
      };
      const imgUrl = json.data?.image?.url;
      if (imgUrl) {
        // Download the image as a blob so it uploads to Supabase like a camera photo
        try {
          const imgRes = await fetch(imgUrl);
          if (imgRes.ok) {
            const blob = await imgRes.blob();
            const compressed = await compressImage(blob).catch(() => blob);
            setRawFile(compressed);
            const reader = new FileReader();
            reader.onload = () => setPreview(reader.result as string);
            reader.readAsDataURL(compressed);
          } else {
            // Fallback: show the CDN URL as preview only
            setPreview(imgUrl);
            setRawFile(null);
          }
        } catch {
          setPreview(imgUrl);
          setRawFile(null);
        }
      } else {
        setLinkError("No product image found for this URL.");
      }
      if (json.data?.title && !name) {
        setName(json.data.title);
        setCategory(inferCategory(json.data.title));
      }
      if (json.data?.publisher && !brand) {
        setBrand(json.data.publisher);
      }
    } catch {
      setLinkError("Could not fetch the page. Check the URL and try again.");
    } finally {
      setLinkLoading(false);
    }
  };

  const onSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!preview || !name.trim()) return;
    setUploading(true);
    setUploadError(null);
    let imageUrl = preview;
    if (rawFile) {
      try {
        imageUrl = await uploadClosetImage(rawFile);
      } catch (err) {
        setUploading(false);
        setUploadError(
          `Image upload failed: ${err instanceof Error ? err.message : "unknown error"}. Create a public "closet-images" bucket in Supabase Storage and try again.`,
        );
        return;
      }
    }
    setUploading(false);
    closet.addItem({
      name: name.trim(),
      brand: brand.trim() || undefined,
      color: color.trim() || undefined,
      category,
      season,
      image: imageUrl,
      status: status === "active" ? undefined : status,
      departing: status === "departing" ? { intent: departingIntent } : undefined,
      memory: status === "vault" ? { story: memoryStory.trim(), occasion: memoryOccasion.trim() || undefined, person: memoryPerson.trim() || undefined } : undefined,
    });
    navigate({ to: "/" });
  };

  return (
    <PageShell title="Add">
      <section className="px-6 pt-4 pb-10">
        <Link to="/" className="inline-flex items-center gap-1 text-xs text-muted-foreground mb-4">
          <ArrowLeft className="size-3.5" /> Closet
        </Link>

        <div className="mb-6">
          <p className="text-[10px] uppercase tracking-[0.22em] text-mint mb-1">I bought this</p>
          <h1 className="font-serif text-3xl leading-none tracking-[0.06em] uppercase">Add to closet</h1>
          <p className="text-xs text-muted-foreground mt-2">
            For pieces you already own. Snap or paste a link and Clem files it away so it can style you.
          </p>
        </div>

        <div className="flex gap-2 mb-6 bg-card border border-border rounded-full p-1">
          {(["photo", "link"] as Mode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`flex-1 rounded-full py-2 text-xs font-medium uppercase tracking-wider transition ${
                mode === m ? "bg-sage text-cream" : "text-muted-foreground"
              }`}
            >
              {m === "photo" ? "Photo" : "From link"}
            </button>
          ))}
        </div>

        {mode === "photo" ? (
          <div>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="w-full aspect-[3/4] rounded-2xl border border-dashed border-border bg-mint-soft/20 grid place-items-center text-muted-foreground overflow-hidden relative active:scale-[0.99] transition"
            >
              {preview ? (
                <img src={preview} alt="Preview" className="absolute inset-0 w-full h-full object-cover" />
              ) : (
                <div className="text-center">
                  <Camera className="size-7 mx-auto mb-2 opacity-60" strokeWidth={1.5} />
                  <p className="text-sm font-serif tracking-[0.02em]">Tap to add from camera roll</p>
                  <p className="text-[10px] mt-1">JPG, PNG, HEIC</p>
                </div>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => onFile(e.target.files?.[0])}
              />
            </button>
            {preview && (
              <div className="mt-3 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-[9px] uppercase tracking-[0.22em] text-ink/40">Image tools</p>
                  <button
                    type="button"
                    onClick={() => addCredits(25)}
                    className="text-[9px] uppercase tracking-[0.22em] text-mauve font-mono inline-flex items-center gap-1 active:opacity-60 transition"
                  >
                    {credits} credits
                    {credits <= 5 && <span className="bg-mauve/15 text-mauve rounded-full px-1.5 py-0.5 text-[8px]">+ Add</span>}
                  </button>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={onCleanBackground}
                    disabled={cleaningBg || flatLaying || smartEditing || studioProcessing}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-[10px] uppercase tracking-[0.18em] text-foreground/80 active:scale-95 transition disabled:opacity-50"
                  >
                    <Wand2 className={`size-3 ${cleaningBg ? "animate-pulse text-mint" : ""}`} strokeWidth={1.5} />
                    {cleaningBg ? "Cleaning…" : "Remove bg"}
                  </button>
                  <button
                    type="button"
                    onClick={onSmartEdit}
                    disabled={smartEditing || cleaningBg || flatLaying || studioProcessing}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-[10px] uppercase tracking-[0.18em] text-foreground/80 active:scale-95 transition disabled:opacity-50"
                  >
                    <Wand className={`size-3 ${smartEditing ? "animate-pulse text-mint" : ""}`} strokeWidth={1.5} />
                    {smartEditing ? "Editing…" : "Smart"}
                  </button>
                  <button
                    type="button"
                    onClick={onFlatLay}
                    disabled={flatLaying || cleaningBg || smartEditing || studioProcessing}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-[10px] uppercase tracking-[0.18em] text-foreground/80 active:scale-95 transition disabled:opacity-50"
                  >
                    <Layers className={`size-3 ${flatLaying ? "animate-pulse text-mint" : ""}`} strokeWidth={1.5} />
                    {flatLaying ? "Processing…" : "Flat lay"}
                  </button>
                  <button
                    type="button"
                    onClick={onGptStudio}
                    disabled={studioProcessing || cleaningBg || flatLaying || smartEditing}
                    className="inline-flex items-center gap-1.5 rounded-full border border-mint/60 bg-mint-soft/20 px-3 py-1.5 text-[10px] uppercase tracking-[0.18em] text-mint active:scale-95 transition disabled:opacity-50"
                  >
                    <Zap className={`size-3 ${studioProcessing ? "animate-pulse" : ""}`} strokeWidth={1.5} />
                    {studioProcessing ? "Generating…" : "AI Studio"}
                  </button>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <p className="text-[9px] uppercase tracking-[0.12em] text-ink/35 shrink-0">AI style</p>
                  {(["studio", "editorial", "luxe", "casual"] as const).map((s) => (
                    <button key={s} type="button" onClick={() => setStudioStyle(s)}
                      className={`px-2.5 py-0.5 rounded-full text-[9px] uppercase tracking-[0.1em] transition capitalize ${studioStyle === s ? "bg-mint text-white" : "bg-mint-soft/30 text-foreground/50"}`}>
                      {s}
                    </button>
                  ))}
                </div>
                {(bgError || flatLayError || smartEditError || studioError) && (() => {
                  const msg = bgError ?? flatLayError ?? smartEditError ?? studioError;
                  const clear = () => { setBgError(null); setFlatLayError(null); setSmartEditError(null); setStudioError(null); };
                  return msg === "not-enough" ? (
                    <div className="flex items-center gap-2">
                      <p className="text-[10px] text-destructive">Not enough credits.</p>
                      <button type="button" onClick={() => { addCredits(25); clear(); }}
                        className="text-[10px] text-mint underline underline-offset-2 active:opacity-60">
                        Add 25 free credits
                      </button>
                    </div>
                  ) : (
                    <p className="text-[10px] text-destructive">{msg}</p>
                  );
                })()}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex gap-2">
              <input
                value={link}
                onChange={(e) => setLink(e.target.value)}
                placeholder="Paste a product link"
                className="flex-1 rounded-full bg-card border border-border px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-mint/30"
              />
              <button type="button" onClick={onLinkPreview} disabled={linkLoading} className="rounded-full bg-foreground text-background px-4 text-xs font-medium active:scale-95 transition inline-flex items-center gap-1.5 disabled:opacity-50">
                <Link2 className="size-3.5" /> {linkLoading ? "Fetching…" : "Fetch"}
              </button>
            </div>
            {linkError && <p className="text-[10px] text-destructive">{linkError}</p>}
            <div className="w-full aspect-[3/4] rounded-2xl bg-mint-soft/20 border border-dashed border-border overflow-hidden grid place-items-center text-muted-foreground">
              {preview ? (
                <img src={preview} alt="Preview" className="w-full h-full object-cover" />
              ) : (
                <p className="text-xs">Preview will appear here</p>
              )}
            </div>
          </div>
        )}

        <form onSubmit={onSave} className="mt-6 space-y-3">
          <div>
            <label className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Name</label>
            <input
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setCategory(inferCategory(e.target.value));
              }}
              required
              placeholder="Silk slip dress"
              className="mt-1 w-full rounded-xl bg-card border border-border px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-mint/30"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="relative">
              <label className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Brand</label>
              <input
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                onFocus={() => setShowBrandSuggestions(true)}
                onBlur={() => setTimeout(() => setShowBrandSuggestions(false), 150)}
                placeholder="Toteme"
                className="mt-1 w-full rounded-xl bg-card border border-border px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-mint/30"
              />
              {showBrandSuggestions && brand.length >= 1 && (() => {
                const matches = POPULAR_BRANDS.filter((b) => b.toLowerCase().startsWith(brand.toLowerCase()) && b.toLowerCase() !== brand.toLowerCase()).slice(0, 6);
                return matches.length > 0 ? (
                  <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-card border border-border rounded-xl overflow-hidden shadow-lg">
                    {matches.map((b) => (
                      <button key={b} type="button" onMouseDown={() => setBrand(b)}
                        className="w-full text-left px-4 py-2.5 text-sm hover:bg-mint-soft/30 transition">
                        {b}
                      </button>
                    ))}
                  </div>
                ) : null;
              })()}
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Color</label>
              <input value={color} onChange={(e) => setColor(e.target.value)} placeholder="Sage" className="mt-1 w-full rounded-xl bg-card border border-border px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-mint/30" />
            </div>
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground flex items-center gap-1">
              {detecting
                ? <><span className="size-3 rounded-full border border-mint border-t-transparent animate-spin inline-block" /> AI detecting…</>
                : <><Sparkles className="size-3 text-mint" /> Category — AI detected</>
              }
            </label>
            <div className="mt-1 flex flex-wrap gap-2">
              {CATEGORIES.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCategory(c)}
                  className={`px-4 py-1.5 rounded-full text-xs transition ${
                    category === c ? "bg-sage text-cream" : "bg-mint-soft/40 text-foreground"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Season</label>
            <div className="mt-1 flex flex-wrap gap-2">
              {SEASONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSeason(s)}
                  className={`px-4 py-1.5 rounded-full text-xs transition ${
                    season === s ? "bg-sage text-cream" : "bg-mint-soft/40 text-foreground"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>


          <div>
            <label className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Where does it go?</label>
            <div className="mt-1 flex flex-wrap gap-2">
              {([
                { value: "active", label: "Keep" },
                { value: "archived", label: "Archive" },
                { value: "departing", label: "Departing" },
                { value: "vault", label: "Memory Vault" },
              ] as const).map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setStatus(value)}
                  className={`px-4 py-1.5 rounded-full text-xs transition ${
                    status === value ? "bg-sage text-cream" : "bg-mint-soft/40 text-foreground"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            {status === "departing" && (
              <div className="mt-2 flex flex-wrap gap-2">
                {(["sell", "giveaway", "donate"] as DepartingIntent[]).map((intent) => (
                  <button
                    key={intent}
                    type="button"
                    onClick={() => setDepartingIntent(intent)}
                    className={`px-3 py-1 rounded-full text-[10px] uppercase tracking-[0.12em] transition capitalize ${
                      departingIntent === intent ? "bg-foreground text-background" : "bg-mint-soft/30 text-foreground/70"
                    }`}
                  >
                    {intent}
                  </button>
                ))}
              </div>
            )}
            {status === "vault" && (
              <div className="mt-3 space-y-2">
                <textarea
                  value={memoryStory}
                  onChange={(e) => setMemoryStory(e.target.value)}
                  placeholder="What's the story behind this piece?"
                  rows={3}
                  className="w-full rounded-xl bg-card border border-border px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-mint/30 resize-none"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    value={memoryOccasion}
                    onChange={(e) => setMemoryOccasion(e.target.value)}
                    placeholder="Occasion (optional)"
                    className="rounded-xl bg-card border border-border px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-mint/30"
                  />
                  <input
                    value={memoryPerson}
                    onChange={(e) => setMemoryPerson(e.target.value)}
                    placeholder="Person (optional)"
                    className="rounded-xl bg-card border border-border px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-mint/30"
                  />
                </div>
              </div>
            )}
          </div>

          {uploadError && (
            <p className="text-[10px] text-destructive leading-snug">{uploadError}</p>
          )}
          <button
            type="submit"
            disabled={!preview || !name.trim() || uploading}
            className="w-full rounded-full bg-primary text-primary-foreground py-3 text-sm font-medium mt-3 active:scale-[0.98] transition disabled:opacity-40"
          >
            {uploading ? "Saving…" : "Add to closet"}
          </button>
        </form>
      </section>
    </PageShell>
  );
}
