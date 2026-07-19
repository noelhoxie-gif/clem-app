import { useRef, useState } from "react";
import { ArrowLeft, Camera, Check, RefreshCw, RotateCcw, X, Zap } from "lucide-react";
import { type Item, closet } from "@/lib/vesti/store";
import { wearLog, todayISO } from "@/lib/vesti/wear-log";
import { scanOutfitPhoto, type ScanMatch, type DetectedGarment } from "@/lib/vesti/outfit-scan";
import { gptImageStudio, uploadClosetImage } from "@/lib/vesti/supabase-storage";

/** Crop a blob to a normalized bounding box (0–1) with optional padding. */
async function cropBlob(
  blob: Blob,
  box: { yMin: number; xMin: number; yMax: number; xMax: number },
  pad = 0.08,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(blob);
    img.onload = () => {
      const W = img.width, H = img.height;
      const x0 = Math.max(0, (box.xMin - pad) * W);
      const y0 = Math.max(0, (box.yMin - pad) * H);
      const x1 = Math.min(W, (box.xMax + pad) * W);
      const y1 = Math.min(H, (box.yMax + pad) * H);
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(x1 - x0);
      canvas.height = Math.round(y1 - y0);
      canvas.getContext("2d")!.drawImage(img, x0, y0, canvas.width, canvas.height, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Crop failed"))), "image/jpeg", 0.92);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Image load failed")); };
    img.src = url;
  });
}

interface Props {
  open: boolean;
  onClose: () => void;
  items: Item[];
}

type Stage = "pick" | "scanning" | "results" | "add-item" | "done";

export function OutfitScanSheet({ open, onClose, items }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [stage, setStage] = useState<Stage>("pick");
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [matches, setMatches] = useState<ScanMatch[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [date, setDate] = useState(todayISO());
  const [error, setError] = useState<string | null>(null);

  // Add-item sub-stage
  const [addTarget, setAddTarget] = useState<DetectedGarment | null>(null);
  const [studioPreview, setStudioPreview] = useState<string | null>(null);
  const [studioBlob, setStudioBlob] = useState<Blob | null>(null);
  const [studioProcessing, setStudioProcessing] = useState(false);
  const [studioError, setStudioError] = useState<string | null>(null);
  const [addName, setAddName] = useState("");
  const [addBrand, setAddBrand] = useState("");
  const [addColor, setAddColor] = useState("");
  const [addSaving, setAddSaving] = useState(false);

  const apiKey = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;

  const reset = () => {
    setStage("pick");
    setPhotoBlob(null);
    setPhotoPreview(null);
    setMatches([]);
    setSelected(new Set());
    setDate(todayISO());
    setError(null);
    setAddTarget(null);
    setStudioPreview(null);
    setStudioBlob(null);
    setStudioError(null);
  };

  const handleClose = () => { reset(); onClose(); };

  const onFile = async (file?: File) => {
    if (!file) return;
    if (!apiKey) { setError("Gemini API key not configured."); return; }
    setPhotoBlob(file);
    // Store original photo as data URL for fallback display
    const reader = new FileReader();
    reader.onload = () => setPhotoPreview(reader.result as string);
    reader.readAsDataURL(file);
    setStage("scanning");
    setError(null);
    try {
      const results = await scanOutfitPhoto(file, items, apiKey);
      setMatches(results);
      setSelected(new Set(results.filter((r) => r.match).map((r) => r.match!.id)));
      setStage("results");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Scan failed — try again");
      setStage("pick");
    }
  };

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const onLog = () => {
    if (selected.size === 0) return;
    wearLog.log({ date, itemIds: [...selected] });
    setStage("done");
  };

  const runStudio = async (detected: DetectedGarment) => {
    if (!photoBlob) return;
    setStudioProcessing(true);
    setStudioError(null);
    try {
      // Tighter crop for small accessories (belts, necklaces, etc.) vs garments
      const pad = (detected.category === "Accessories" || detected.category === "Shoes") ? 0.02 : 0.08;
      // Crop to just the detected garment when we have a bounding box
      const inputBlob = detected.boundingBox
        ? await cropBlob(photoBlob, detected.boundingBox, pad)
        : photoBlob;
      const blob = await gptImageStudio(inputBlob, detected.category, undefined, detected.description);
      setStudioBlob(blob);
      const reader = new FileReader();
      reader.onload = () => setStudioPreview(reader.result as string);
      reader.readAsDataURL(blob);
    } catch (e) {
      setStudioError(e instanceof Error ? e.message : "AI Studio failed");
    } finally {
      setStudioProcessing(false);
    }
  };

  const onStartAdd = async (detected: DetectedGarment) => {
    setAddTarget(detected);
    setAddName(detected.description);
    setAddColor(detected.color);
    setAddBrand("");
    setStudioPreview(null);
    setStudioBlob(null);
    setStudioError(null);
    setStage("add-item");
    await runStudio(detected);
  };

  const onConfirmAdd = async () => {
    if (!addName.trim() || !addTarget) return;
    setAddSaving(true);
    let imageUrl = "";
    const blobToUpload = studioBlob ?? photoBlob;
    if (blobToUpload) {
      try { imageUrl = await uploadClosetImage(blobToUpload); } catch { /* proceed without */ }
    }
    closet.addItem({
      name: addName.trim(),
      brand: addBrand.trim() || undefined,
      color: addColor.trim() || undefined,
      category: addTarget.category,
      season: "Year-round",
      image: imageUrl,
    });
    setAddSaving(false);
    setMatches((prev) => prev.filter((m) => m.detected !== addTarget));
    setStage("results");
    setAddTarget(null);
    setStudioPreview(null);
    setStudioBlob(null);
  };

  if (!open) return null;

  const matched = matches.filter((m) => m.match);
  const unmatched = matches.filter((m) => !m.match);
  const displayImage = studioPreview ?? photoPreview;

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end animate-rise">
      <div className="absolute inset-0 bg-foreground/30 backdrop-blur-sm" onClick={handleClose} />
      <div className="relative bg-background rounded-t-3xl border-t border-border shadow-xl max-h-[90dvh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.22em] text-mint">Outfit scan</p>
            <h2 className="font-serif text-2xl leading-none tracking-[0.04em] mt-1">
              {stage === "add-item" ? "Add to closet" : "What are you wearing?"}
            </h2>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="size-8 grid place-items-center rounded-full bg-card border border-border text-foreground/60 active:scale-95 transition"
          >
            <X className="size-3.5" strokeWidth={1.75} />
          </button>
        </div>

        <div className="px-6 pb-10">

          {/* ── Stage: pick photo ── */}
          {stage === "pick" && (
            <div className="text-center py-8">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="size-24 rounded-full bg-mint-soft/30 border-2 border-dashed border-mint/40 grid place-items-center mx-auto mb-5 active:scale-95 transition"
              >
                <Camera className="size-9 text-mint/70" strokeWidth={1.5} />
              </button>
              <p className="text-sm font-serif">Take or choose a photo of your outfit</p>
              <p className="text-[11px] text-muted-foreground mt-1.5">
                Clem will match items against your closet
              </p>
              {error && <p className="mt-4 text-[11px] text-destructive">{error}</p>}
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="mt-6 inline-flex items-center gap-2 rounded-full bg-primary text-primary-foreground px-6 py-3 text-sm font-medium active:scale-[0.98] transition"
              >
                <Camera className="size-4" strokeWidth={1.5} /> Choose photo
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => onFile(e.target.files?.[0])}
              />
            </div>
          )}

          {/* ── Stage: scanning ── */}
          {stage === "scanning" && (
            <div className="text-center py-14">
              <RefreshCw className="size-8 animate-spin text-mint mx-auto mb-4" strokeWidth={1.5} />
              <p className="text-sm font-serif">Checking your closet…</p>
              <p className="text-[11px] text-muted-foreground mt-1">Analysing your outfit</p>
            </div>
          )}

          {/* ── Stage: results ── */}
          {stage === "results" && (
            <div className="space-y-5">
              <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                {matched.length} of {matches.length} items found in your closet
              </p>

              {matched.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[10px] uppercase tracking-[0.14em] text-mint">In your closet</p>
                  {matched.map((m, i) => (
                    <div key={i} className="flex items-center gap-3 p-3 rounded-2xl border border-mint/25 bg-mint-soft/10">
                      <img src={m.match!.image} alt={m.match!.name} className="size-12 rounded-xl object-cover shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{m.match!.name}</p>
                        <p className="text-[10px] text-muted-foreground capitalize">
                          {m.detected.color} · {m.detected.description}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => toggle(m.match!.id)}
                        className={`size-7 rounded-full border grid place-items-center shrink-0 transition active:scale-90 ${
                          selected.has(m.match!.id) ? "bg-mint border-mint text-white" : "border-border bg-background"
                        }`}
                      >
                        {selected.has(m.match!.id) && <Check className="size-3.5" strokeWidth={2.5} />}
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {unmatched.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground/70">Not in your closet</p>
                  {unmatched.map((m, i) => (
                    <div key={i} className="flex items-center gap-3 p-3 rounded-2xl border border-border bg-card">
                      <div className="size-12 rounded-xl bg-mint-soft/20 grid place-items-center shrink-0 text-xl">
                        {m.detected.category === "Shoes" ? "👟"
                          : m.detected.category === "Accessories" ? "💍"
                          : m.detected.category === "Bottoms" ? "👖"
                          : m.detected.category === "Dresses" ? "👗"
                          : "👕"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm capitalize text-foreground/80 truncate">{m.detected.description}</p>
                        <p className="text-[10px] text-muted-foreground">{m.detected.color} · {m.detected.category}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => onStartAdd(m.detected)}
                        className="inline-flex items-center gap-1 bg-mint/90 text-white rounded-full px-2.5 py-1 text-[9px] uppercase tracking-[0.14em] active:scale-95 transition shrink-0"
                      >
                        <Zap className="size-3" strokeWidth={1.5} />
                        Add
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {matches.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No clothing items detected — try a clearer photo.
                </p>
              )}

              {matched.length > 0 && (
                <div>
                  <label className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Worn on</label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="mt-1 w-full rounded-xl bg-card border border-border px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-mint/30"
                  />
                </div>
              )}

              <div className="space-y-2">
                {matched.length > 0 && (
                  <button
                    type="button"
                    onClick={onLog}
                    disabled={selected.size === 0}
                    className="w-full rounded-full bg-primary text-primary-foreground py-3 text-sm font-medium active:scale-[0.98] transition disabled:opacity-40"
                  >
                    Log {selected.size} item{selected.size !== 1 ? "s" : ""} as worn
                  </button>
                )}
                <button type="button" onClick={reset}
                  className="w-full text-[11px] text-muted-foreground py-1.5 active:opacity-60 transition">
                  Scan a different photo
                </button>
              </div>
            </div>
          )}

          {/* ── Stage: add-item ── */}
          {stage === "add-item" && addTarget && (
            <div className="space-y-4">
              <button
                type="button"
                onClick={() => setStage("results")}
                className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.18em] text-muted-foreground active:opacity-60 transition"
              >
                <ArrowLeft className="size-3.5" /> Back to results
              </button>

              {/* Photo — shows original immediately, replaces with Grok result when ready */}
              <div className="w-full aspect-[3/4] rounded-2xl overflow-hidden bg-mint-soft/20 relative">
                {displayImage && (
                  <img src={displayImage} alt="Preview" className="w-full h-full object-cover" />
                )}

                {/* Generating overlay */}
                {studioProcessing && (
                  <div className="absolute inset-0 bg-background/60 backdrop-blur-sm grid place-items-center">
                    <div className="text-center">
                      <Zap className="size-6 text-mint animate-pulse mx-auto mb-2" strokeWidth={1.5} />
                      <p className="text-xs text-muted-foreground">Generating product photo…</p>
                    </div>
                  </div>
                )}

                {/* Error + retry overlay */}
                {studioError && !studioProcessing && (
                  <div className="absolute bottom-0 left-0 right-0 bg-background/85 backdrop-blur-sm px-3 py-2.5 flex items-center justify-between gap-2">
                    <p className="text-[10px] text-destructive leading-snug flex-1 truncate">{studioError}</p>
                    <button
                      type="button"
                      onClick={() => runStudio(addTarget)}
                      className="inline-flex items-center gap-1 text-[9px] uppercase tracking-[0.14em] text-mint shrink-0 active:opacity-60"
                    >
                      <RotateCcw className="size-3" strokeWidth={1.5} /> Retry
                    </button>
                  </div>
                )}

                {/* No photo at all */}
                {!displayImage && !studioProcessing && (
                  <div className="absolute inset-0 grid place-items-center text-muted-foreground/50">
                    <p className="text-sm">No preview available</p>
                  </div>
                )}

                {/* Success badge */}
                {studioPreview && !studioProcessing && (
                  <div className="absolute top-2 left-2 inline-flex items-center gap-1 bg-mint/90 text-white rounded-full px-2 py-0.5 text-[8px] uppercase tracking-[0.14em]">
                    <Zap className="size-2.5" strokeWidth={1.5} /> AI Studio
                  </div>
                )}
              </div>

              {/* Category (read-only) */}
              <div className="flex items-center gap-2">
                <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Category</p>
                <span className="px-3 py-1 rounded-full bg-sage text-cream text-xs">{addTarget.category}</span>
              </div>

              {/* Fields */}
              <div className="space-y-3">
                <div>
                  <label className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Name</label>
                  <input
                    value={addName}
                    onChange={(e) => setAddName(e.target.value)}
                    placeholder="e.g. White Button-Down Shirt"
                    className="mt-1 w-full rounded-xl bg-card border border-border px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-mint/30"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Brand</label>
                    <input
                      value={addBrand}
                      onChange={(e) => setAddBrand(e.target.value)}
                      placeholder="Optional"
                      className="mt-1 w-full rounded-xl bg-card border border-border px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-mint/30"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Color</label>
                    <input
                      value={addColor}
                      onChange={(e) => setAddColor(e.target.value)}
                      className="mt-1 w-full rounded-xl bg-card border border-border px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-mint/30"
                    />
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={onConfirmAdd}
                disabled={!addName.trim() || addSaving}
                className="w-full rounded-full bg-primary text-primary-foreground py-3 text-sm font-medium active:scale-[0.98] transition disabled:opacity-40"
              >
                {addSaving ? "Adding…" : "Add to closet"}
              </button>
            </div>
          )}

          {/* ── Stage: done ── */}
          {stage === "done" && (
            <div className="text-center py-10">
              <div className="size-16 rounded-full bg-mint/15 grid place-items-center mx-auto mb-5">
                <Check className="size-7 text-mint" strokeWidth={2} />
              </div>
              <p className="font-serif text-2xl tracking-[0.04em]">Logged</p>
              <p className="text-sm text-muted-foreground mt-2">
                {selected.size} item{selected.size !== 1 ? "s" : ""} marked as worn on {date}
              </p>
              <button
                type="button"
                onClick={handleClose}
                className="mt-8 w-full rounded-full bg-primary text-primary-foreground py-3 text-sm font-medium active:scale-[0.98] transition"
              >
                Done
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
