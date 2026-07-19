import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { useCloset, itemStatus } from "@/lib/vesti/store";
import { ArrowLeft, Tag } from "lucide-react";

export const Route = createFileRoute("/share/departing")({
  head: () => ({
    meta: [
      { title: "Departing pieces — Clem" },
      { name: "description", content: "A friend shared what they're parting with. Take a look before it goes." },
    ],
  }),
  component: SharedDepartingPage,
});

function intentLabel(intent?: string) {
  if (intent === "sell") return "For sale";
  if (intent === "giveaway") return "Giveaway";
  if (intent === "donate") return "Donating";
  return "Departing";
}

function SharedDepartingPage() {
  const { items, hydrated } = useCloset();
  const departing = useMemo(
    () => items.filter((i) => itemStatus(i) === "departing"),
    [items],
  );

  return (
    <div className="min-h-screen bg-background text-foreground pb-16">
      <header className="sticky top-0 z-30 bg-background/85 backdrop-blur-md border-b border-border px-6 py-4 flex justify-between items-center">
        <Link to="/" className="font-serif text-2xl tracking-[0.08em] leading-none uppercase">
          Clem
        </Link>
        <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Shared · Departing</span>
      </header>

      <section className="px-6 pt-8">
        <Link to="/" className="inline-flex items-center gap-1 text-xs text-muted-foreground mb-4">
          <ArrowLeft className="size-3.5" /> Back
        </Link>

        <p className="text-[10px] uppercase tracking-[0.22em] text-mauve mb-1">A friend is parting with</p>
        <h1 className="font-serif text-4xl leading-tight tracking-[0.04em] uppercase">Departing Pieces</h1>
        <p className="text-xs text-muted-foreground mt-3">
          {departing.length} {departing.length === 1 ? "piece" : "pieces"} · first dibs before they go
        </p>

        {departing.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <p className="font-serif text-2xl mb-2 tracking-[0.04em] uppercase">Nothing departing</p>
            {hydrated && <p className="text-xs">Check back soon.</p>}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-x-4 gap-y-8 mt-8 pb-10">
            {departing.map((item, i) => (
              <article key={item.id} className="animate-rise" style={{ animationDelay: `${i * 50}ms` }}>
                <div className="w-full aspect-[3/4] bg-card rounded-lg outline outline-1 -outline-offset-1 outline-black/5 mb-3 overflow-hidden">
                  <img src={item.image} alt={item.name} loading="lazy" className="w-full h-full object-cover" />
                </div>
                <div className="flex items-center gap-1.5 text-[9px] uppercase tracking-[0.2em] text-mauve mb-1">
                  <Tag className="size-2.5" strokeWidth={1.5} />
                  {intentLabel(item.departing?.intent)}
                  {item.departing?.price && <span className="text-ink/70">· {item.departing.price}</span>}
                </div>
                <p className="text-xs font-medium tracking-tight leading-tight">{item.name}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {[item.brand, item.color].filter(Boolean).join(" • ")}
                </p>
                {item.departing?.notes && (
                  <p className="font-serif italic text-[11px] text-ink/55 mt-2 leading-snug">{item.departing.notes}</p>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
