import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { PageShell } from "@/components/vesti/PageShell";
import { useCloset, closet, CATEGORIES, SEASONS, POPULAR_BRANDS, type Category, type Season } from "@/lib/vesti/store";
import { uploadClosetImage, replaceBackground, gptImageStudio } from "@/lib/vesti/supabase-storage";
import { addCredits } from "@/lib/vesti/credits";
import { ArrowLeft, Camera, Trash2, Wand2, Zap } from "lucide-react";

export const Route = createFileRoute("/item/$itemId")({
  head: () => ({ meta: [{ title: "Edit item — Clem" }] }),
  component: EditItemPage,
});

function compressImage(file: File | Blob, maxPx = 900, quality = 0.82): Promise<Blob> {
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
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Compression failed"))), "image/jpeg", quality);
    };
    img.onerror = reject;
    img.src = url;
  });
}

function EditItemPage() {
  const { itemId } = Route.useParams();
  const { items } = useCloset();
  const item = items.find((i) => i.id === itemId);
  const navigate = useNavigate();

  const [name, setName] = useState(item?.name ?? "");
  const [brand, setBrand] = useState(item?.brand ?? "");
  const [color, setColor] = useState(item?.color ?? "");
  const [category, setCategory] = useState<Category>(item?.category ?? "Tops");
  const [season, setSeason] = useState<Season>(item?.season ?? "Year-round");
  const [preview, setPreview] = useState<string | null>(item?.image ?? null);
  const [rawFile, setRawFile] = useState<File | Blob | null>(null);
  const [cleaningBg, setCleaningBg] = useState(false);
  const [bgError, setBgError] = useState<string | null>(null);
  const [studioProcessing, setStudioProcessing] = useState(false);
  const [studioError, setStudioError] = useState<string | null>(null);
  const [studioStyle, setStudioStyle] = useState<"studio" | "editorial" | "luxe" | "casual">("studio");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showBrandSuggestions, setShowBrandSuggestions] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  if (!item) {
    return (
      <PageShell title="Edit">
        <div className="px-6 pt-10 text-center text-muted-foreground">
          <p className="font-serif text-2xl mb-2">Item not found</p>
          <Link to="/" className="text-xs underline underline-offset-4">Back to closet</Link>
        </div>
      </PageShell>
    );
  }

  const onFile = async (file?: File) => {
    if (!file) return;
    let blob: Blob;
    try { blob = await compressImage(file); } catch { blob = file; }
    setRawFile(blob);
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result as string);
    reader.readAsDataURL(blob);
  };

  const onCleanBackground = async () => {
    if (!rawFile && !item.image) return;
    setCleaningBg(true);
    setBgError(null);
    try {
      const source = rawFile ?? await fetch(item.image).then((r) => r.blob());
      const blob = await replaceBackground(source);
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

  const onGptStudio = async () => {
    setStudioProcessing(true);
    setStudioError(null);
    try {
      const source = rawFile ?? await fetch(item.image).then((r) => r.blob());
      const blob = await gptImageStudio(source, category, studioStyle);
      setRawFile(blob);
      const reader = new FileReader();
      reader.onload = () => setPreview(reader.result as string);
      reader.readAsDataURL(blob);
    } catch (e) {
      setStudioError(e instanceof Error ? e.message : "AI Studio failed");
    } finally {
      setStudioProcessing(false);
    }
  };


  const onSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setSaveError(null);
    let imageUrl = item.image;
    if (rawFile) {
      try {
        imageUrl = await uploadClosetImage(rawFile);
      } catch (err) {
        setSaving(false);
        setSaveError(`Image upload failed: ${err instanceof Error ? err.message : "unknown error"}`);
        return;
      }
    }
    closet.updateItem(item.id, {
      name: name.trim(),
      brand: brand.trim() || undefined,
      color: color.trim() || undefined,
      category,
      season,
      image: imageUrl,
    });
    setSaving(false);
    navigate({ to: "/" });
  };

  const onDelete = () => {
    closet.removeItem(item.id);
    navigate({ to: "/" });
  };

  return (
    <PageShell title="Edit">
      <section className="px-6 pt-4 pb-10">
        <Link to="/" className="inline-flex items-center gap-1 text-xs text-muted-foreground mb-4">
          <ArrowLeft className="size-3.5" /> Closet
        </Link>

        <div className="mb-6">
          <p className="text-[10px] uppercase tracking-[0.22em] text-mint mb-1">Edit piece</p>
          <h1 className="font-serif text-3xl leading-none tracking-[0.06em] uppercase">{item.name}</h1>
        </div>

        {/* Image */}
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="w-full aspect-[3/4] rounded-2xl border border-dashed border-border bg-mint-soft/20 grid place-items-center text-muted-foreground overflow-hidden relative active:scale-[0.99] transition mb-2"
        >
          {preview ? (
            <img src={preview} alt="Preview" className="absolute inset-0 w-full h-full object-cover" />
          ) : (
            <div className="text-center">
              <Camera className="size-7 mx-auto mb-2 opacity-60" strokeWidth={1.5} />
              <p className="text-sm font-serif tracking-[0.02em]">Tap to replace photo</p>
            </div>
          )}
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
        </button>

        <div className="mb-6 space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={onCleanBackground}
              disabled={cleaningBg || studioProcessing}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-[10px] uppercase tracking-[0.18em] text-foreground/80 active:scale-95 transition disabled:opacity-50"
            >
              <Wand2 className={`size-3 ${cleaningBg ? "animate-pulse text-mint" : ""}`} strokeWidth={1.5} />
              {cleaningBg ? "Cleaning…" : "Clean background"}
            </button>
            <button
              type="button"
              onClick={onGptStudio}
              disabled={studioProcessing || cleaningBg}
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
          {(bgError || studioError) && (() => {
            const msg = bgError ?? studioError;
            const clear = () => { setBgError(null); setStudioError(null); };
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

        <form onSubmit={onSave} className="space-y-3">
          <div>
            <label className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
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
              <input value={color} onChange={(e) => setColor(e.target.value)} className="mt-1 w-full rounded-xl bg-card border border-border px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-mint/30" />
            </div>
          </div>

          <div>
            <label className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Category</label>
            <div className="mt-1 flex flex-wrap gap-2">
              {CATEGORIES.map((c) => (
                <button key={c} type="button" onClick={() => setCategory(c)}
                  className={`px-4 py-1.5 rounded-full text-xs transition ${category === c ? "bg-sage text-cream" : "bg-mint-soft/40 text-foreground"}`}>
                  {c}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Season</label>
            <div className="mt-1 flex flex-wrap gap-2">
              {SEASONS.map((s) => (
                <button key={s} type="button" onClick={() => setSeason(s)}
                  className={`px-4 py-1.5 rounded-full text-xs transition ${season === s ? "bg-sage text-cream" : "bg-mint-soft/40 text-foreground"}`}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          {saveError && <p className="text-[10px] text-destructive leading-snug">{saveError}</p>}

          <button
            type="submit"
            disabled={!name.trim() || saving}
            className="w-full rounded-full bg-primary text-primary-foreground py-3 text-sm font-medium mt-3 active:scale-[0.98] transition disabled:opacity-40"
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
        </form>

        {/* Delete */}
        <div className="mt-6">
          {confirmDelete ? (
            <div className="rounded-2xl border border-destructive/40 bg-destructive/5 p-4 text-center">
              <p className="text-xs text-destructive mb-3">Remove this piece from your closet?</p>
              <div className="flex gap-2">
                <button type="button" onClick={() => setConfirmDelete(false)}
                  className="flex-1 rounded-full border border-border py-2 text-xs text-muted-foreground active:scale-95 transition">
                  Cancel
                </button>
                <button type="button" onClick={onDelete}
                  className="flex-1 rounded-full bg-destructive text-destructive-foreground py-2 text-xs active:scale-95 transition">
                  Remove
                </button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => setConfirmDelete(true)}
              className="w-full inline-flex items-center justify-center gap-2 border border-destructive/40 text-destructive text-[10px] uppercase tracking-[0.22em] py-3 rounded-xl active:opacity-70 transition">
              <Trash2 className="size-3.5" strokeWidth={1.5} /> Remove from closet
            </button>
          )}
        </div>
      </section>
    </PageShell>
  );
}
