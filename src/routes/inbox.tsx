import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import { PageShell } from "@/components/vesti/PageShell";
import { useReceipts, receipts, type DetectedReceipt } from "@/lib/vesti/receipts";
import { CATEGORIES, SEASONS, type Category, type Season, closet } from "@/lib/vesti/store";
import { Check, X, Mail, RefreshCw, Sparkles, ArrowLeft, CalendarClock, BellRing, Camera, Pencil, Zap } from "lucide-react";
import { connectGmail, fetchReceiptEmails, fetchEmailProductImage, getStoredToken, clearToken, type FetchProgress } from "@/lib/vesti/gmail-sync";
import { parseReceiptEmails, type ParsedReceipt, type GroqProgress } from "@/lib/api/gmail.functions";
import { gptImageStudio } from "@/lib/vesti/supabase-storage";
import { addCredits } from "@/lib/vesti/credits";
import shopBag from "@/assets/shop-bag-camel.jpg";

const RETURN_WINDOW_DAYS = 14;

function returnByDate(orderDate: string) {
  const d = new Date(orderDate);
  d.setDate(d.getDate() + RETURN_WINDOW_DAYS);
  return d;
}

function daysUntil(date: Date) {
  const diff = date.getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (24 * 60 * 60 * 1000)));
}

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const MONTHS_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function formatDeadline(date: Date) {
  return `${WEEKDAYS[date.getDay()]}, ${MONTHS[date.getMonth()]} ${date.getDate()}`;
}

function formatShort(date: Date) {
  return `${MONTHS_SHORT[date.getMonth()]} ${date.getDate()}`;
}

function ReturnReminderDialog({ receipt, onClose }: { receipt: DetectedReceipt; onClose: () => void }) {
  const deadline = returnByDate(receipt.orderDate);
  const days = daysUntil(deadline);
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-foreground/30 backdrop-blur-sm px-6 animate-rise"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm bg-background rounded-3xl overflow-hidden shadow-xl border border-border"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 pt-8 pb-7 text-center">
          <div className="size-12 mx-auto grid place-items-center rounded-full bg-mauve/10 text-mauve mb-4">
            <BellRing className="size-5" strokeWidth={1.5} />
          </div>
          <p className="text-[10px] uppercase tracking-[0.28em] text-mauve">Return reminder set</p>
          <h2 className="font-serif text-2xl leading-tight mt-3 tracking-[0.02em]">
            Send back the {receipt.brand} {receipt.itemName} by
          </h2>
          <p className="font-serif text-3xl mt-4 tracking-[0.04em] text-foreground">
            {formatDeadline(deadline)}
          </p>
          <p className="text-[11px] text-muted-foreground mt-3 tracking-wide">
            That's {days} {days === 1 ? "day" : "days"} from today · {RETURN_WINDOW_DAYS}-day return window from {receipt.retailer}
          </p>
          <div className="mt-6 flex items-center justify-center gap-2 text-[10px] uppercase tracking-[0.2em] text-foreground/60">
            <CalendarClock className="size-3.5" strokeWidth={1.5} />
            We'll nudge you 2 days before
          </div>
          <div className="mt-6 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                receipts.markReturned(receipt.id);
                onClose();
              }}
              className="rounded-full border border-border bg-background py-3 text-[11px] uppercase tracking-[0.18em] text-foreground/70 active:scale-95 transition"
            >
              Already returned
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full bg-foreground text-background py-3 text-[11px] uppercase tracking-[0.18em] active:scale-95 transition"
            >
              Remind me
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ReviewReceiptSheet({ receipt, onClose }: { receipt: DetectedReceipt; onClose: () => void }) {
  const [name, setName] = useState(receipt.itemName);
  const [brand, setBrand] = useState(receipt.brand);
  const [color, setColor] = useState(receipt.color ?? "");
  const [category, setCategory] = useState<Category>(receipt.category);
  const [season, setSeason] = useState<Season>(receipt.season);
  const [preview, setPreview] = useState(receipt.image);
  const [rawBlob, setRawBlob] = useState<Blob | null>(null);
  const [loadingImg, setLoadingImg] = useState(false);
  const [studioProcessing, setStudioProcessing] = useState(false);
  const [studioError, setStudioError] = useState<string | null>(null);
  const [studioStyle, setStudioStyle] = useState<"studio" | "editorial" | "luxe" | "casual">("studio");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!receipt.id.startsWith("gmail-")) return;
    const token = getStoredToken();
    if (!token) return;
    const messageId = receipt.id.replace(/^gmail-/, "");
    setLoadingImg(true);
    fetchEmailProductImage(messageId, token.access_token)
      .then((url) => { if (url) setPreview(url); })
      .finally(() => setLoadingImg(false));
  }, [receipt.id]);

  const onPickFile = (file?: File) => {
    if (!file) return;
    setRawBlob(file);
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const onGptStudio = async () => {
    setStudioProcessing(true);
    setStudioError(null);
    try {
      const source = rawBlob ?? await fetch(preview).then((r) => r.blob());
      const blob = await gptImageStudio(source, category, studioStyle);
      setRawBlob(blob);
      const reader = new FileReader();
      reader.onload = () => setPreview(reader.result as string);
      reader.readAsDataURL(blob);
    } catch (e) {
      setStudioError(e instanceof Error ? e.message : "AI Studio failed — try picking a photo first");
    } finally {
      setStudioProcessing(false);
    }
  };

  const onAdd = () => {
    closet.addItem({
      name: name.trim(),
      brand: brand.trim() || undefined,
      color: color.trim() || undefined,
      category,
      season,
      image: preview,
    });
    receipts.confirmOnly(receipt.id);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end animate-rise">
      <div className="absolute inset-0 bg-foreground/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-background rounded-t-3xl overflow-hidden shadow-xl border-t border-border max-h-[92dvh] overflow-y-auto">
        {/* Image */}
        <div className="aspect-[4/3] bg-card relative overflow-hidden shrink-0">
          <img
            src={preview}
            alt={name}
            className="w-full h-full object-cover"
            onError={() => setPreview(shopBag)}
          />
          {loadingImg && (
            <div className="absolute inset-0 bg-background/50 grid place-items-center">
              <RefreshCw className="size-5 animate-spin text-mint" strokeWidth={1.5} />
            </div>
          )}
          <span className="absolute top-3 left-3 text-[9px] uppercase tracking-[0.22em] bg-background/85 backdrop-blur px-2 py-1 rounded-full">
            From {receipt.retailer}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="absolute top-3 right-3 size-7 grid place-items-center rounded-full bg-background/85 backdrop-blur text-foreground/70"
          >
            <X className="size-3.5" strokeWidth={1.75} />
          </button>
          {/* Style picker */}
          <div className="absolute bottom-[2.75rem] left-3 flex gap-1.5">
            {(["studio", "editorial", "luxe", "casual"] as const).map((s) => (
              <button key={s} type="button" onClick={() => setStudioStyle(s)}
                className={`px-2 py-0.5 rounded-full text-[8px] uppercase tracking-[0.12em] backdrop-blur transition capitalize ${studioStyle === s ? "bg-mint text-white" : "bg-background/70 text-foreground/60"}`}>
                {s}
              </button>
            ))}
          </div>
          {/* Image tools */}
          <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
            <button
              type="button"
              onClick={onGptStudio}
              disabled={studioProcessing}
              className="inline-flex items-center gap-1.5 bg-mint/90 backdrop-blur px-2.5 py-1.5 rounded-full text-[9px] uppercase tracking-[0.18em] text-white transition disabled:opacity-50"
            >
              <Zap className={`size-3 ${studioProcessing ? "animate-pulse" : ""}`} strokeWidth={1.5} />
              {studioProcessing ? "Generating…" : "AI Studio"}
            </button>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="inline-flex items-center gap-1.5 bg-background/85 backdrop-blur px-2.5 py-1.5 rounded-full text-[9px] uppercase tracking-[0.18em] text-foreground/70 hover:text-foreground transition"
            >
              <Camera className="size-3" strokeWidth={1.5} />
              Change photo
            </button>
          </div>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onPickFile(e.target.files?.[0])} />
        </div>
        {studioError && (
          studioError === "not-enough" ? (
            <div className="px-6 pt-2 flex items-center gap-2">
              <p className="text-[10px] text-destructive">Not enough credits.</p>
              <button type="button" onClick={() => { addCredits(25); setStudioError(null); }}
                className="text-[10px] text-mint underline underline-offset-2 active:opacity-60">
                Add 25 free credits
              </button>
            </div>
          ) : (
            <p className="px-6 pt-2 text-[10px] text-destructive">{studioError}</p>
          )
        )}

        <div className="px-6 pt-4 pb-8 space-y-4">
          <p className="text-[10px] uppercase tracking-[0.22em] text-mint">
            {receipt.orderDate}{receipt.price ? ` · ${receipt.price}` : ""}
          </p>

          <div>
            <label className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-xl bg-card border border-border px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-mint/30"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Brand</label>
              <input
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                className="mt-1 w-full rounded-xl bg-card border border-border px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-mint/30"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Color</label>
              <input
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="mt-1 w-full rounded-xl bg-card border border-border px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-mint/30"
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Category</label>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {CATEGORIES.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCategory(c)}
                  className={`px-3 py-1.5 rounded-full text-xs transition ${category === c ? "bg-sage text-cream" : "bg-mint-soft/40 text-foreground"}`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Season</label>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {SEASONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSeason(s)}
                  className={`px-3 py-1.5 rounded-full text-xs transition ${season === s ? "bg-sage text-cream" : "bg-mint-soft/40 text-foreground"}`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              type="button"
              onClick={() => { receipts.deny(receipt.id); onClose(); }}
              className="rounded-full border border-border bg-background py-3 text-[11px] uppercase tracking-[0.18em] text-foreground/70 active:scale-95 transition"
            >
              Not mine
            </button>
            <button
              type="button"
              onClick={onAdd}
              disabled={!name.trim()}
              className="rounded-full bg-foreground text-background py-3 text-[11px] uppercase tracking-[0.18em] active:scale-95 transition disabled:opacity-40"
            >
              Add to closet
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/inbox")({
  head: () => ({
    meta: [
      { title: "Inbox — Clem" },
      { name: "description", content: "Confirm e-receipts detected in your email and add them to your closet." },
    ],
  }),
  component: InboxPage,
});

function relTime(t: number) {
  const diff = Date.now() - t;
  const m = Math.round(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return `${d}d ago`;
}

function ConfirmDialog({
  receipt,
  onClose,
  onConfirmed,
}: {
  receipt: DetectedReceipt;
  onClose: () => void;
  onConfirmed?: (r: DetectedReceipt) => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-foreground/30 backdrop-blur-sm px-6 animate-rise"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm bg-background rounded-3xl overflow-hidden shadow-xl border border-border"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="aspect-[4/5] bg-card relative">
          <img src={receipt.image} alt={receipt.itemName} className="w-full h-full object-cover" />
          <span className="absolute top-4 left-4 text-[9px] uppercase tracking-[0.22em] bg-background/85 backdrop-blur px-2 py-1 rounded-full">
            Detected from {receipt.retailer}
          </span>
        </div>
        <div className="px-6 pt-5 pb-6">
          <p className="text-[10px] uppercase tracking-[0.22em] text-mint">
            {receipt.kind === "return" ? "We detected a recent return" : "We detected a recent purchase"}
          </p>
          <h2 className="font-serif text-2xl leading-tight mt-2 tracking-[0.02em]">
            {receipt.kind === "return"
              ? `Did you return the ${receipt.brand} ${receipt.itemName}?`
              : `Did you purchase the ${receipt.brand} ${receipt.itemName}?`}
          </h2>
          <div className="mt-4 space-y-1 text-[11px] text-muted-foreground tracking-wide">
            <p>From: {receipt.sender}</p>
            <p className="truncate">Subject: {receipt.subject}</p>
            <p>
              {receipt.kind === "return" ? "Refunded" : "Ordered"} {receipt.orderDate}
              {receipt.price && ` · ${receipt.price}`}
            </p>
          </div>
          <div className="mt-6 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                receipts.deny(receipt.id);
                onClose();
              }}
              className="rounded-full border border-border bg-background py-3 text-xs uppercase tracking-[0.18em] text-foreground/70 active:scale-95 transition"
            >
              Not mine
            </button>
            <button
              type="button"
              onClick={() => {
                receipts.confirm(receipt.id);
                onConfirmed?.(receipt);
                onClose();
              }}
              className="rounded-full bg-foreground text-background py-3 text-xs uppercase tracking-[0.18em] active:scale-95 transition"
            >
              {receipt.kind === "return" ? "Set return reminder" : "Add to closet"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SwipeCardDeck({
  pending,
  onConfirm,
  onDeny,
  onOpen,
}: {
  pending: DetectedReceipt[];
  onConfirm: (r: DetectedReceipt) => void;
  onDeny: (r: DetectedReceipt) => void;
  onOpen: (r: DetectedReceipt) => void;
}) {
  const [offset, setOffset] = useState(0);
  const [flying, setFlying] = useState<"left" | "right" | null>(null);
  const dragging = useRef(false);
  const moved = useRef(false);
  const startX = useRef(0);

  const current = pending[0];
  const next = pending[1];

  useEffect(() => { setOffset(0); setFlying(null); }, [current?.id]);

  if (!current) return (
    <div className="text-center py-12 text-muted-foreground border border-dashed border-border rounded-2xl">
      <Sparkles className="size-5 mx-auto mb-2 text-mint" strokeWidth={1.25} />
      <p className="font-serif text-xl mb-1 tracking-[0.04em] uppercase">All caught up</p>
      <p className="text-[11px] tracking-wide">New e-receipts will appear here.</p>
    </div>
  );

  const THRESHOLD = 80;
  const progress = Math.min(Math.abs(offset) / THRESHOLD, 1);
  const isRight = offset > 0;

  function fly(dir: "left" | "right") {
    setFlying(dir);
    setTimeout(() => {
      if (dir === "right") onConfirm(current);
      else onDeny(current);
    }, 280);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[10px] uppercase tracking-[0.22em] text-foreground">Pending</h3>
        <span className="text-[10px] text-muted-foreground">{pending.length}</span>
      </div>

      {/* Card stack */}
      <div className="relative select-none" style={{ aspectRatio: "3/4" }}>
        {/* Next card peek */}
        {next && (
          <div className="absolute inset-x-3 bottom-0 top-2 rounded-3xl overflow-hidden border border-border/50 bg-card">
            <img src={next.image} alt="" className="w-full h-full object-cover opacity-40" onError={(e) => { (e.target as HTMLImageElement).src = shopBag; }} />
          </div>
        )}

        {/* Current card */}
        <div
          style={{
            transform:
              flying === "right" ? "translateX(140%) rotate(18deg)" :
              flying === "left"  ? "translateX(-140%) rotate(-18deg)" :
              `translateX(${offset}px) rotate(${offset / 22}deg)`,
            transition: flying
              ? "transform 280ms cubic-bezier(.4,0,.2,1)"
              : !dragging.current ? "transform 180ms ease" : "none",
          }}
          className="absolute inset-0 rounded-3xl overflow-hidden shadow-lg touch-none cursor-grab active:cursor-grabbing"
          onPointerDown={(e) => {
            dragging.current = true;
            moved.current = false;
            startX.current = e.clientX;
            e.currentTarget.setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => {
            if (!dragging.current) return;
            const dx = e.clientX - startX.current;
            if (Math.abs(dx) > 6) moved.current = true;
            setOffset(dx);
          }}
          onPointerUp={() => {
            if (!dragging.current) return;
            dragging.current = false;
            if (!moved.current) { onOpen(current); setOffset(0); return; }
            if (Math.abs(offset) >= THRESHOLD) fly(offset > 0 ? "right" : "left");
            else setOffset(0);
          }}
        >
          <img
            src={current.image}
            alt={current.itemName}
            className="w-full h-full object-cover"
            onError={(e) => { (e.target as HTMLImageElement).src = shopBag; }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/5 to-transparent" />

          {/* Add stamp */}
          <div style={{ opacity: isRight ? progress : 0 }} className="absolute top-6 left-6 pointer-events-none">
            <span className="block border-[3px] border-mint text-mint font-serif text-2xl px-3 py-0.5 rounded-md -rotate-12 uppercase tracking-widest">
              Add
            </span>
          </div>

          {/* Skip stamp */}
          <div style={{ opacity: !isRight && offset < 0 ? progress : 0 }} className="absolute top-6 right-6 pointer-events-none">
            <span className="block border-[3px] border-destructive text-destructive font-serif text-2xl px-3 py-0.5 rounded-md rotate-12 uppercase tracking-widest">
              Skip
            </span>
          </div>

          {/* Item info */}
          <div className="absolute bottom-0 left-0 right-0 p-5 pointer-events-none">
            <p className="text-[9px] uppercase tracking-[0.25em] text-mint mb-1">{current.retailer}</p>
            <h3 className="font-serif text-white text-2xl leading-tight tracking-[0.03em] mb-1">{current.itemName}</h3>
            <p className="text-[11px] text-white/70">
              {[current.brand, current.color, current.price].filter(Boolean).join(" · ")}
            </p>
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex items-center justify-center gap-5 mt-5">
        <button
          type="button"
          onClick={() => fly("left")}
          className="size-14 rounded-full border border-border bg-background grid place-items-center shadow-sm active:scale-95 transition text-foreground/50 hover:text-destructive hover:border-destructive/50"
        >
          <X className="size-5" strokeWidth={1.75} />
        </button>
        <button
          type="button"
          onClick={() => onOpen(current)}
          className="size-10 rounded-full border border-border bg-background grid place-items-center shadow-sm active:scale-95 transition text-foreground/50 hover:text-foreground"
        >
          <Pencil className="size-4" strokeWidth={1.5} />
        </button>
        <button
          type="button"
          onClick={() => fly("right")}
          className="size-14 rounded-full bg-foreground text-background grid place-items-center shadow-sm active:scale-95 transition"
        >
          <Check className="size-5" strokeWidth={1.75} />
        </button>
      </div>

      {pending.filter((r) => r.kind !== "return").length > 1 && (
        <button
          type="button"
          onClick={() => pending.filter((r) => r.kind !== "return").forEach((r) => onConfirm(r))}
          className="w-full mt-4 py-2.5 rounded-full border border-border text-[10px] uppercase tracking-[0.18em] text-muted-foreground hover:text-mint hover:border-mint active:scale-95 transition"
        >
          Add all {pending.filter((r) => r.kind !== "return").length} purchases
        </button>
      )}
    </div>
  );
}

function toReviewReceipt(e: { subject: string; from: string; messageId: string; parsedData?: ParsedReceipt }): DetectedReceipt {
  const p = e.parsedData;
  const retailer = p?.retailer ?? (e.from.match(/@([\w-]+)\./)?.[1] ?? "Unknown");
  return {
    id: `gmail-${e.messageId}`,
    retailer,
    sender: e.from,
    subject: e.subject,
    detectedAt: Date.now(),
    orderDate: p?.orderDate ?? new Date().toISOString().slice(0, 10),
    price: p?.price,
    itemName: p?.itemName ?? e.subject.replace(/^(your order|order confirmation|thanks for|re:|fwd:)\s*/i, "").slice(0, 60),
    brand: p?.brand ?? retailer,
    color: p?.color,
    category: p?.category ?? "Tops",
    season: p?.season ?? "Year-round",
    image: shopBag,
    status: "pending",
    kind: p?.kind ?? "purchase",
  };
}

function InboxPage() {
  const { receipts: all, lastSyncedAt } = useReceipts();
  const [reminder, setReminder] = useState<DetectedReceipt | null>(null);
  const [reviewReceipt, setReviewReceipt] = useState<DetectedReceipt | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [gmailProgress, setGmailProgress] = useState<FetchProgress | null>(null);
  const [groqProgress, setGroqProgress] = useState<GroqProgress | null>(null);
  const [scannedEmails, setScannedEmails] = useState<{ subject: string; from: string; messageId: string; parsedData?: ParsedReceipt }[]>([]);
  const [showScanned, setShowScanned] = useState(false);
  const [showImportTable, setShowImportTable] = useState(true);
  const [connectedEmail, setConnectedEmail] = useState<string | null>(
    () => getStoredToken()?.email ?? null,
  );

  const isConnected = !!connectedEmail;

  const confirmReceipt = (r: DetectedReceipt) => {
    receipts.confirm(r.id);
    if (r.kind === "return") setReminder(r);
  };

  const approveAllPurchases = () => {
    pending
      .filter((r) => r.kind !== "return")
      .forEach((r) => receipts.confirm(r.id));
  };

  const pending = all.filter((r) => r.status === "pending");
  const handled = all.filter((r) => r.status !== "pending");
  const importTitle = lastSyncedAt
    ? new Date(lastSyncedAt).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })
    : null;

  const handleConnect = async () => {
    setSyncError(null);
    setSyncResult(null);
    setSyncing(true);
    try {
      const token = await connectGmail();
      const stored = getStoredToken();
      setConnectedEmail(stored?.email || "Gmail");
      await runSync(token);
    } catch (e) {
      setSyncError(e instanceof Error ? e.message : "Connection failed");
    } finally {
      setSyncing(false);
      setSyncStatus(null);
      setGmailProgress(null);
      setGroqProgress(null);
    }
  };

  const handleDisconnect = () => {
    clearToken();
    setConnectedEmail(null);
    setSyncResult(null);
  };

  const handleSync = async () => {
    setSyncError(null);
    setSyncResult(null);
    setSyncing(true);
    try {
      const token = await connectGmail();
      const stored = getStoredToken();
      if (stored?.email) setConnectedEmail(stored.email);
      await runSync(token);
    } catch (e) {
      setSyncError(e instanceof Error ? e.message : "Sync failed");
    } finally {
      setSyncing(false);
      setSyncStatus(null);
      setGmailProgress(null);
      setGroqProgress(null);
    }
  };

  const runSync = async (accessToken: string) => {
    setGmailProgress(null);
    setGroqProgress(null);
    setSyncStatus("Searching Gmail Shopping + fashion brand emails…");
    const emails = await fetchReceiptEmails(accessToken, (p) => {
      setGmailProgress(p);
      setSyncStatus(
        p.stage === "searching"
          ? "Searching Gmail Shopping + fashion brand emails…"
          : `Fetching email ${p.done} of ${p.total}…`,
      );
    });
    setGmailProgress(null);
    setSyncStatus(`Found ${emails.length} email${emails.length === 1 ? "" : "s"} · verifying clothing receipts with AI…`);

    // Show every scanned email right away (no verdict yet) — entries get
    // filled in with parsedData as each Groq batch confirms them below.
    setScannedEmails(emails.map((e) => ({
      subject: e.subject || "(no subject)",
      from: e.from,
      messageId: e.messageId,
    })));

    let added = 0;
    await parseReceiptEmails(
      emails,
      (p) => {
        setGroqProgress(p);
        const providerNote = p.byProvider
          ? ` (Groq ${p.byProvider.groq} · Gemini ${p.byProvider.gemini})`
          : "";
        setSyncStatus(
          p.waitingSeconds
            ? `Rate limit reached — resuming in ${p.waitingSeconds}s (${p.done}/${p.total} checked)…`
            : `Verifying clothing receipts with AI — ${p.done}/${p.total}${providerNote}…`,
        );
      },
      (newlyConfirmed) => {
        // Stream results in as soon as each batch is verified, rather than
        // waiting for the whole queue (which can span several minutes once
        // the free-tier rate limit is paced out) to finish.
        const byMsgId = new Map(newlyConfirmed.map((p) => [p.messageId, p]));
        setScannedEmails((prev) =>
          prev.map((e) => (byMsgId.has(e.messageId) ? { ...e, parsedData: byMsgId.get(e.messageId) } : e)),
        );
        newlyConfirmed.forEach((p) => {
          const before = receipts.get().receipts.length;
          receipts.addReal({
            messageId: p.messageId,
            retailer: p.retailer,
            sender: p.sender,
            subject: p.subject,
            orderDate: p.orderDate,
            price: p.price,
            itemName: p.itemName,
            brand: p.brand,
            color: p.color,
            category: p.category,
            season: p.season,
            kind: p.kind,
            image: p.imageUrl ?? shopBag,
          });
          if (receipts.get().receipts.length > before) added++;
        });
      },
    );
    setGroqProgress(null);
    receipts.markSynced();
    setSyncResult(
      added > 0
        ? `Scanned ${emails.length} emails · found ${added} new clothing receipt${added === 1 ? "" : "s"} — review them below.`
        : `Scanned ${emails.length} emails · no new clothing receipts found.`
    );
  };

  return (
    <PageShell title="Inbox">
      <div className="px-8 pt-6">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground transition"
        >
          <ArrowLeft className="size-3.5" strokeWidth={1.5} />
          Back to closet
        </Link>
      </div>

      <section className="px-8 pt-6 pb-2">
        <p className="text-[10px] uppercase tracking-[0.32em] text-mint mb-3">Email Sync</p>
        <h2 className="font-serif text-[40px] leading-[1.05] text-foreground tracking-[0.06em] uppercase">
          Receipts inbox
        </h2>
        <p className="text-xs text-muted-foreground mt-4 tracking-wide max-w-md">
          We scan your inbox for order confirmations and ask before adding anything to your closet.
        </p>

        {!isConnected ? (
          <button
            type="button"
            onClick={handleConnect}
            disabled={syncing}
            className="mt-6 w-full flex items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-3 active:bg-muted/30 transition disabled:opacity-50"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="size-9 grid place-items-center rounded-full bg-mint-soft text-mint">
                <Mail className="size-4" strokeWidth={1.5} />
              </div>
              <div className="min-w-0 text-left">
                <p className="text-[11px] uppercase tracking-[0.18em] text-foreground">Connect Gmail</p>
                <p className="text-[10px] text-muted-foreground">
                  {syncing ? "Scanning your inbox…" : "Scan for clothing receipts"}
                </p>
              </div>
            </div>
            {syncing ? (
              <RefreshCw className="size-3.5 animate-spin text-mint shrink-0" strokeWidth={1.5} />
            ) : (
              <span className="text-[10px] uppercase tracking-[0.18em] text-mint shrink-0">Connect →</span>
            )}
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSync}
            disabled={syncing}
            className="mt-6 w-full flex items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-3 active:bg-muted/30 transition disabled:opacity-50"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="size-9 grid place-items-center rounded-full bg-mint-soft text-mint">
                <Mail className="size-4" strokeWidth={1.5} />
              </div>
              <div className="min-w-0 text-left">
                <p className="text-[11px] uppercase tracking-[0.18em] text-foreground truncate">{connectedEmail}</p>
                <p className="text-[10px] text-muted-foreground">
                  {syncing ? "Scanning your inbox…" : lastSyncedAt ? `Last synced ${relTime(lastSyncedAt)}` : "Tap to scan for receipts"}
                </p>
              </div>
            </div>
            {syncing ? (
              <RefreshCw className="size-3.5 animate-spin text-mint shrink-0" strokeWidth={1.5} />
            ) : (
              <span className="text-[10px] uppercase tracking-[0.18em] text-mint shrink-0">Sync →</span>
            )}
          </button>
        )}
        {syncing && syncStatus && (
          <div className="mt-3 px-1 space-y-2.5">
            <div className="flex items-center gap-2">
              <RefreshCw className="size-3 animate-spin text-mint shrink-0" strokeWidth={1.5} />
              <p className="text-[10px] text-muted-foreground tracking-wide">{syncStatus}</p>
            </div>

            {/* Stage 1: Gmail fetch */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[9px] uppercase tracking-[0.18em] text-muted-foreground">
                  1. Gmail
                </span>
                {gmailProgress?.stage === "fetching" && gmailProgress.total > 0 && (
                  <span className="text-[9px] text-muted-foreground">
                    {gmailProgress.done}/{gmailProgress.total}
                  </span>
                )}
              </div>
              <div className="h-1.5 rounded-full bg-mint-soft/40 overflow-hidden">
                <div
                  className={`h-full bg-mint transition-all duration-300 ${
                    gmailProgress?.stage === "searching" ? "w-1/6 animate-pulse" : ""
                  }`}
                  style={
                    gmailProgress?.stage === "fetching" && gmailProgress.total > 0
                      ? { width: `${Math.round((gmailProgress.done / gmailProgress.total) * 100)}%` }
                      : gmailProgress
                        ? undefined
                        : { width: groqProgress ? "100%" : "0%" }
                  }
                />
              </div>
            </div>

            {/* Stage 2: AI clothing verification (dual-threaded across Groq + Gemini when both are configured) */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[9px] uppercase tracking-[0.18em] text-muted-foreground">
                  2. AI verification{groqProgress?.waitingSeconds ? ` · waiting ${groqProgress.waitingSeconds}s` : ""}
                </span>
                {groqProgress && groqProgress.total > 0 && (
                  <span className="text-[9px] text-muted-foreground">
                    {groqProgress.done}/{groqProgress.total}
                  </span>
                )}
              </div>
              <div className="h-1.5 rounded-full bg-mint-soft/40 overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 ${groqProgress?.waitingSeconds ? "bg-mauve animate-pulse" : "bg-mint"}`}
                  style={{
                    width:
                      groqProgress && groqProgress.total > 0
                        ? `${Math.round((groqProgress.done / groqProgress.total) * 100)}%`
                        : "0%",
                  }}
                />
              </div>
              {groqProgress?.byProvider && (
                <p className="mt-1 text-[9px] text-muted-foreground/70 tracking-wide">
                  Dual-threaded — Groq {groqProgress.byProvider.groq} · Gemini {groqProgress.byProvider.gemini}
                </p>
              )}
            </div>
          </div>
        )}
        {!syncing && syncResult && (
          <p className="mt-3 text-[10px] text-mint tracking-wide px-1">{syncResult}</p>
        )}
        {syncError && (
          <p className="mt-2 text-[10px] text-destructive tracking-wide px-1">{syncError}</p>
        )}
        {scannedEmails.length > 0 && (
          <div className="mt-3 px-1">
            <button
              type="button"
              onClick={() => setShowScanned((v) => !v)}
              className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground transition"
            >
              {showScanned ? "Hide" : "Show"} {scannedEmails.length} scanned emails
            </button>
            {showScanned && (
              <ul className="mt-2 space-y-1 max-h-48 overflow-y-auto">
                {scannedEmails.map((e, i) => (
                  <li key={i} className="text-[10px] text-muted-foreground leading-snug flex items-baseline gap-1.5">
                    <button
                      type="button"
                      onClick={() => setReviewReceipt(toReviewReceipt(e))}
                      className="text-foreground/70 underline underline-offset-2 hover:text-foreground transition-colors text-left"
                    >
                      {e.subject}
                    </button>
                    <span className="text-muted-foreground/60 shrink-0">
                      · {e.from.split("<")[0].trim() || e.from}
                      {e.parsedData && <span className="text-mint"> · clothing</span>}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>

      <section className="px-8 pt-10 pb-16">
        {pending.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-[10px] uppercase tracking-[0.22em] text-mint mb-1">
                  {importTitle ? `Import — ${importTitle}` : "Import"}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {pending.length} item{pending.length === 1 ? "" : "s"} to review
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowImportTable((v) => !v)}
                className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground transition"
              >
                {showImportTable ? "Hide" : "Show"}
              </button>
            </div>

            {showImportTable && (
              <div className="rounded-2xl border border-border overflow-hidden overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-border bg-card/50">
                      <th className="w-12 py-2 pl-3" />
                      <th className="py-2 pr-3 text-[9px] uppercase tracking-[0.18em] text-muted-foreground font-medium">
                        Item
                      </th>
                      <th className="py-2 pr-3 text-[9px] uppercase tracking-[0.18em] text-muted-foreground font-medium">
                        Category
                      </th>
                      <th className="py-2 pr-3 text-[9px] uppercase tracking-[0.18em] text-muted-foreground font-medium text-right">
                        Price
                      </th>
                      <th className="w-16 py-2 pr-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {pending.map((r) => (
                      <tr key={r.id} className="border-b border-border/60 last:border-0 hover:bg-card/40 transition">
                        <td className="py-2 pl-3">
                          <button
                            type="button"
                            onClick={() => setReviewReceipt(r)}
                            aria-label={`Edit ${r.itemName}`}
                            className="block size-9 rounded-lg overflow-hidden bg-muted shrink-0"
                          >
                            <img
                              src={r.image}
                              alt=""
                              className="w-full h-full object-cover"
                              onError={(e) => { (e.target as HTMLImageElement).src = shopBag; }}
                            />
                          </button>
                        </td>
                        <td className="py-2 pr-3 min-w-0">
                          <button type="button" onClick={() => setReviewReceipt(r)} className="text-left">
                            <p className="text-[11px] uppercase tracking-[0.05em] truncate max-w-[160px]">
                              {r.itemName}
                            </p>
                            <p className="text-[10px] text-muted-foreground truncate max-w-[160px]">
                              {[r.brand, r.retailer].filter(Boolean).join(" · ")}
                            </p>
                          </button>
                        </td>
                        <td className="py-2 pr-3 text-[10px] text-muted-foreground whitespace-nowrap">
                          {r.category}
                        </td>
                        <td className="py-2 pr-3 text-[10px] text-foreground/80 text-right whitespace-nowrap">
                          {r.price ?? "—"}
                        </td>
                        <td className="py-2 pr-3">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => receipts.deny(r.id)}
                              aria-label={`Not mine — ${r.itemName}`}
                              className="size-6 rounded-full border border-border grid place-items-center text-foreground/50 hover:text-destructive hover:border-destructive/50 transition"
                            >
                              <X className="size-3" strokeWidth={1.75} />
                            </button>
                            <button
                              type="button"
                              onClick={() => confirmReceipt(r)}
                              aria-label={`Add to closet — ${r.itemName}`}
                              className="size-6 rounded-full bg-foreground text-background grid place-items-center transition active:scale-90"
                            >
                              <Check className="size-3" strokeWidth={1.75} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        <SwipeCardDeck
          pending={pending}
          onConfirm={confirmReceipt}
          onDeny={(r) => receipts.deny(r.id)}
          onOpen={setReviewReceipt}
        />

        {(() => {
          const activeReminders = all.filter(
            (r) => r.kind === "return" && r.status === "confirmed" && !r.returned,
          );
          if (activeReminders.length === 0) return null;
          return (
            <div className="mt-10">
              <div className="flex items-baseline justify-between mb-4">
                <h3 className="text-[10px] uppercase tracking-[0.22em] text-foreground">
                  Return reminders
                </h3>
                <span className="text-[10px] text-muted-foreground">{activeReminders.length}</span>
              </div>
              <ul className="space-y-2">
                {activeReminders.map((r) => {
                  const deadline = returnByDate(r.orderDate);
                  const days = daysUntil(deadline);
                  return (
                    <li
                      key={r.id}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-card border border-border"
                    >
                      <div className="size-10 rounded-md overflow-hidden bg-muted shrink-0">
                        <img src={r.image} alt="" className="w-full h-full object-cover" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] uppercase tracking-[0.1em] truncate">{r.itemName}</p>
                        <p className="text-[10px] text-mauve mt-0.5 inline-flex items-center gap-1">
                          <CalendarClock className="size-3" strokeWidth={1.5} />
                          {days === 0 ? "Due today" : `${days} ${days === 1 ? "day" : "days"} left · ${formatShort(deadline)}`}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => receipts.markReturned(r.id)}
                        className="rounded-full border border-border bg-background px-3 py-1.5 text-[9px] uppercase tracking-[0.2em] text-foreground/70 active:scale-95 transition"
                      >
                        Mark returned
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })()}

        {handled.length > 0 && (
          <div className="mt-10">
            <h3 className="text-[10px] uppercase tracking-[0.22em] text-foreground mb-4">
              Recently reviewed
            </h3>
            <ul className="space-y-2">
              {handled.slice(0, 8).map((r) => (
                <li
                  key={r.id}
                  className="flex items-center gap-3 px-3 py-2 rounded-xl bg-background border border-border/60"
                >
                  <div className="size-10 rounded-md overflow-hidden bg-muted shrink-0">
                    <img src={r.image} alt="" className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] uppercase tracking-[0.1em] truncate">{r.itemName}</p>
                    <p className="text-[10px] text-muted-foreground truncate">
                      {r.brand} · {relTime(r.detectedAt)}
                    </p>
                  </div>
                  <span
                    className={`text-[9px] uppercase tracking-[0.2em] ${
                      r.status === "confirmed" ? "text-mint" : "text-foreground/40"
                    }`}
                  >
                    {r.status === "confirmed" ? "Added" : "Dismissed"}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <Link
          to="/"
          className="block text-center mt-10 text-[11px] text-mint italic underline underline-offset-4"
        >
          Back to closet
        </Link>
      </section>

      {reminder && <ReturnReminderDialog receipt={reminder} onClose={() => setReminder(null)} />}
      {reviewReceipt && <ReviewReceiptSheet receipt={reviewReceipt} onClose={() => setReviewReceipt(null)} />}
    </PageShell>
  );
}
