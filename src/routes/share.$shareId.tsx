import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useCloset, CATEGORIES, type Category } from "@/lib/vesti/store";
import { Gift, Heart, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/share/$shareId")({
  head: () => ({
    meta: [
      { title: "A shared closet — Clem" },
      { name: "description", content: "Browse a friend's closet and find the perfect gift." },
    ],
  }),
  component: SharedClosetPage,
});

type Filter = "All" | Category;
const FILTERS: Filter[] = ["All", ...CATEGORIES];

function SharedClosetPage() {
  const { shareId } = Route.useParams();
  const { items } = useCloset();
  const [filter, setFilter] = useState<Filter>("All");
  const [wishlist, setWishlist] = useState<Set<string>>(new Set());

  const visible = useMemo(
    () => (filter === "All" ? items : items.filter((i) => i.category === filter)),
    [items, filter],
  );

  const toggleWish = (id: string) => {
    setWishlist((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="min-h-screen bg-background text-foreground pb-16">
      <header className="sticky top-0 z-30 bg-background/85 backdrop-blur-md border-b border-border px-6 py-4 flex justify-between items-center">
        <Link to="/" className="font-serif text-2xl tracking-[0.08em] leading-none uppercase">
          Clem
        </Link>
        <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Shared closet</span>
      </header>

      <section className="px-6 pt-8">
        <Link to="/profile" className="inline-flex items-center gap-1 text-xs text-muted-foreground mb-4">
          <ArrowLeft className="size-3.5" /> Back
        </Link>
        <p className="text-[10px] uppercase tracking-[0.22em] text-mint mb-1">@{shareId}'s closet</p>
        <h1 className="font-serif text-4xl leading-tight tracking-[0.04em] uppercase">A peek inside the wardrobe</h1>
        <p className="text-sm text-muted-foreground mt-3 max-w-xs">
          Tap the heart on a piece you'd love to gift. Your picks stay on this device.
        </p>
      </section>

      {wishlist.size > 0 && (
        <section className="px-6 mt-6">
          <div className="rounded-2xl bg-mint-soft/40 border border-mint-soft px-5 py-4 flex items-center gap-3 animate-rise">
            <Gift className="size-5 text-mint" strokeWidth={1.5} />
            <p className="text-sm">
              <span className="font-medium">{wishlist.size}</span> gift idea{wishlist.size === 1 ? "" : "s"} saved
            </p>
          </div>
        </section>
      )}

      <section className="px-6 pt-6">
        <div className="flex gap-6 mb-6 overflow-x-auto text-sm no-scrollbar">
          {FILTERS.map((f) => {
            const active = f === filter;
            return (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                  className={`pb-1 whitespace-nowrap transition-colors ${
                    active ? "font-serif text-foreground border-b border-foreground tracking-[0.02em]" : "text-muted-foreground"
                  }`}
              >
                {f === "All" ? "All Items" : f}
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-2 gap-x-4 gap-y-8 pb-10">
          {visible.map((item, i) => {
            const wished = wishlist.has(item.id);
            return (
              <article key={item.id} className="animate-rise relative" style={{ animationDelay: `${i * 50}ms` }}>
                <div className="w-full aspect-[3/4] bg-card rounded-lg outline outline-1 -outline-offset-1 outline-black/5 mb-3 overflow-hidden relative">
                  <img src={item.image} alt={item.name} loading="lazy" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => toggleWish(item.id)}
                    aria-label={wished ? "Remove from gift ideas" : "Save as gift idea"}
                    className={`absolute top-2 right-2 size-9 rounded-full grid place-items-center backdrop-blur-md transition active:scale-90 ${
                      wished ? "bg-primary text-primary-foreground" : "bg-background/70 text-foreground"
                    }`}
                  >
                    <Heart className={`size-4 ${wished ? "fill-current" : ""}`} strokeWidth={1.75} />
                  </button>
                </div>
                <p className="text-xs font-medium tracking-tight leading-tight">{item.name}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {[item.brand, item.color].filter(Boolean).join(" • ")}
                </p>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
