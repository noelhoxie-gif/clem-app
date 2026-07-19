import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { useCloset } from "@/lib/vesti/store";
import { ArrowLeft, CalendarDays, MapPin } from "lucide-react";

export const Route = createFileRoute("/share/folder/$folderId")({
  head: () => ({
    meta: [
      { title: "Shared collection — Clem" },
      { name: "description", content: "A friend shared what they're packing." },
    ],
  }),
  component: SharedFolderPage,
});

function SharedFolderPage() {
  const { folderId } = Route.useParams();
  const { folders, items, hydrated } = useCloset();
  const folder = folders.find((f) => f.id === folderId);
  const inFolder = useMemo(
    () => (folder ? items.filter((i) => folder.itemIds.includes(i.id)) : []),
    [items, folder],
  );

  return (
    <div className="min-h-screen bg-background text-foreground pb-16">
      <header className="sticky top-0 z-30 bg-background/85 backdrop-blur-md border-b border-border px-6 py-4 flex justify-between items-center">
        <Link to="/" className="font-serif text-2xl tracking-[0.08em] leading-none uppercase">
          Clem
        </Link>
        <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Shared collection</span>
      </header>

      <section className="px-6 pt-8">
        <Link to="/folders" className="inline-flex items-center gap-1 text-xs text-muted-foreground mb-4">
          <ArrowLeft className="size-3.5" /> Back
        </Link>

        {!folder ? (
          <div className="text-center py-16 text-muted-foreground">
            <p className="font-serif text-2xl mb-2 tracking-[0.04em] uppercase">Collection not found</p>
            {hydrated && (
              <p className="text-xs">This link may have expired or been removed.</p>
            )}
          </div>
        ) : (
          <>
            <p className="text-[10px] uppercase tracking-[0.22em] text-mint mb-1">A friend's plan</p>
            <h1 className="font-serif text-4xl leading-tight tracking-[0.04em] uppercase">{folder.name}</h1>
            <div className="flex flex-wrap gap-4 mt-3 text-xs text-muted-foreground">
              {folder.destination && (
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="size-3.5" /> {folder.destination}
                </span>
              )}
              {folder.startDate && folder.endDate && (
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays className="size-3.5" /> {folder.startDate} → {folder.endDate}
                </span>
              )}
              <span>{inFolder.length} pieces</span>
            </div>

            <div className="grid grid-cols-2 gap-x-4 gap-y-8 mt-8 pb-10">
              {inFolder.map((item, i) => (
                <article key={item.id} className="animate-rise" style={{ animationDelay: `${i * 50}ms` }}>
                  <div className="w-full aspect-[3/4] bg-card rounded-lg outline outline-1 -outline-offset-1 outline-black/5 mb-3 overflow-hidden">
                    <img src={item.image} alt={item.name} loading="lazy" className="w-full h-full object-cover" />
                  </div>
                  <p className="text-xs font-medium tracking-tight leading-tight">{item.name}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {[item.brand, item.color].filter(Boolean).join(" • ")}
                  </p>
                </article>
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
