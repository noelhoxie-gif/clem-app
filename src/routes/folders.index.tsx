import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { PageShell } from "@/components/vesti/PageShell";
import { useCloset, closet } from "@/lib/vesti/store";
import { Plus, FolderPlus } from "lucide-react";

export const Route = createFileRoute("/folders/")({
  head: () => ({
    meta: [
      { title: "Folders — Clem" },
      { name: "description", content: "Create trip and occasion folders to plan outfits in advance." },
    ],
  }),
  component: FoldersPage,
});

function FoldersPage() {
  const { folders, items } = useCloset();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");

  const onCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    closet.createFolder(name.trim());
    setName("");
    setCreating(false);
  };

  return (
    <PageShell title="Folders">
      <section className="px-6 pt-6">
        <div className="flex items-end justify-between mb-5">
          <div>
            <p className="text-[10px] uppercase tracking-[0.22em] text-mint mb-1">Curated</p>
            <h1 className="font-serif text-3xl leading-none tracking-[0.06em] uppercase">Your collections</h1>
          </div>
          <button
            type="button"
            onClick={() => setCreating((c) => !c)}
            className="size-10 rounded-full bg-primary text-primary-foreground grid place-items-center shadow-sm active:scale-95 transition"
            aria-label="New folder"
          >
            <Plus className="size-5" strokeWidth={1.75} />
          </button>
        </div>

        {/* Quick-start presets */}
        <div className="mb-6">
          <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground mb-2">Quick start</p>
          <div className="flex gap-2 flex-wrap">
            {["Bridal Weekend", "Bachelorette Trip", "Honeymoon", "Girls' Trip"].map((preset) => {
              const exists = folders.some((f) => f.name.toLowerCase() === preset.toLowerCase());
              return (
                <button
                  key={preset}
                  type="button"
                  disabled={exists}
                  onClick={() => closet.createFolder(preset)}
                  className="text-[11px] uppercase tracking-[0.18em] px-3 py-1.5 rounded-full border border-border hover:bg-foreground hover:text-background transition disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-foreground"
                >
                  {exists ? `✓ ${preset}` : `+ ${preset}`}
                </button>
              );
            })}
          </div>
        </div>

        {creating && (
          <form onSubmit={onCreate} className="mb-6 flex gap-2 animate-rise">
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder='e.g. "Bahamas Trip"'
              className="flex-1 rounded-full bg-card border border-border px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-mint/30"
            />
            <button type="submit" className="rounded-full bg-foreground text-background px-5 text-sm font-medium active:scale-95 transition">
              Create
            </button>
          </form>
        )}

        {folders.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <FolderPlus className="size-8 mx-auto mb-3 opacity-50" strokeWidth={1.5} />
            <p className="font-serif text-xl mb-1 tracking-[0.04em] uppercase">No folders yet</p>
            <p className="text-xs">Make one for your next trip or occasion.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 pb-10">
            {folders.map((f, i) => {
              const previews = f.itemIds.slice(0, 4).map((id) => items.find((it) => it.id === id)).filter(Boolean);
              return (
                <Link
                  key={f.id}
                  to="/folders/$folderId"
                  params={{ folderId: f.id }}
                  className="block animate-rise"
                  style={{ animationDelay: `${i * 60}ms` }}
                >
                  <div className="relative aspect-square rounded-2xl overflow-hidden">
                    {f.cover ? (
                      <img src={f.cover} alt={f.name} loading="lazy" width={800} height={800} className="w-full h-full object-cover" />
                    ) : previews.length > 0 ? (
                      <div className="grid grid-cols-2 gap-1 p-1 bg-mint-soft/50 w-full h-full">
                        {Array.from({ length: 4 }).map((_, idx) => {
                          const it = previews[idx];
                          return (
                            <div key={idx} className="bg-card rounded overflow-hidden">
                              {it && <img src={it.image} alt="" className="w-full h-full object-cover" />}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="w-full h-full bg-mint-soft grid place-items-center font-serif text-3xl text-mint tracking-[0.02em]">
                        {f.name.charAt(0)}
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/70 to-ink/10" />
                    <div className="absolute top-3 left-3">
                      <span className="text-[9px] uppercase tracking-[0.24em] px-2 py-1 rounded-full bg-mauve text-cream">
                        Curated
                      </span>
                    </div>
                    <div className="absolute bottom-3 left-4 right-4 text-cream">
                      <p className="text-sm font-medium leading-tight">{f.name}</p>
                      <p className="text-[10px] opacity-80 mt-0.5">{f.itemIds.length} items</p>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </PageShell>
  );
}
