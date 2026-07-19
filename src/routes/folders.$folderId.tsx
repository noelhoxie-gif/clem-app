import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { PageShell } from "@/components/vesti/PageShell";
import { useCloset, closet, type Item, type Season, type DaySlot } from "@/lib/vesti/store";
import { getTripWeather, type WeatherSummary } from "@/lib/vesti/weather";
import { ArrowLeft, CalendarDays, Check, CloudSun, MapPin, Moon, Package, Plus, Share2, Sparkles, Sun, Trash2 } from "lucide-react";

export const Route = createFileRoute("/folders/$folderId")({
  head: () => ({
    meta: [{ title: "Folder — Clem" }],
  }),
  component: FolderDetail,
});

function FolderDetail() {
  const { folderId } = Route.useParams();
  const { folders, items, hydrated } = useCloset();
  const folder = folders.find((f) => f.id === folderId);
  const [picking, setPicking] = useState(false);
  const [pickingFor, setPickingFor] = useState<{ date: string; slot: DaySlot } | null>(null);
  const [packedIds, setPackedIds] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem(`clem.packed.${folderId}`);
      return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
    } catch { return new Set(); }
  });
  const togglePacked = (id: string) => {
    setPackedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      localStorage.setItem(`clem.packed.${folderId}`, JSON.stringify([...next]));
      return next;
    });
  };
  const [destination, setDestination] = useState(folder?.destination ?? "");
  const [startDate, setStartDate] = useState(folder?.startDate ?? "");
  const [endDate, setEndDate] = useState(folder?.endDate ?? "");
  const [weather, setWeather] = useState<WeatherSummary | null>(null);
  const [loadingWx, setLoadingWx] = useState(false);
  const [wxError, setWxError] = useState<string | null>(null);
  const [pickingDay, setPickingDay] = useState<string | null>(null);
  const navigate = useNavigate();

  const inFolder = useMemo(() => items.filter((i) => folder?.itemIds.includes(i.id)), [items, folder]);

  const tripDaysArray = useMemo(() => {
    const s = folder?.startDate, e = folder?.endDate;
    if (!s || !e) return [];
    const out: string[] = [];
    const start = new Date(s + "T00:00:00");
    const end = new Date(e + "T00:00:00");
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      out.push(d.toISOString().slice(0, 10));
    }
    return out;
  }, [folder?.startDate, folder?.endDate]);

  const assignedItemIds = useMemo(() => {
    const set = new Set<string>();
    if (!folder) return set;
    Object.values(folder.dayAssignments ?? {}).forEach((ids) => ids.forEach((id) => set.add(id)));
    return set;
  }, [folder]);

  const unassignedInFolder = useMemo(
    () => inFolder.filter((item) => !assignedItemIds.has(item.id)),
    [inFolder, assignedItemIds],
  );

  const recommended = useMemo(() => {
    if (!weather || !folder) return [];
    return items.filter(
      (i) => !folder.itemIds.includes(i.id) && (i.season === weather.pack || i.season === "Year-round"),
    );
  }, [items, folder, weather]);

  const autoTriedRef = useRef(false);
  useEffect(() => {
    if (autoTriedRef.current) return;
    if (!folder?.destination || !folder.startDate || !folder.endDate) return;
    autoTriedRef.current = true;
    (async () => {
      setLoadingWx(true);
      try {
        const w = await getTripWeather(folder.destination!, folder.startDate!, folder.endDate!);
        if (w) setWeather(w);
      } catch {
        /* silent on auto */
      } finally {
        setLoadingWx(false);
      }
    })();
  }, [folder?.destination, folder?.startDate, folder?.endDate, folder]);

  // Build per-day outfits for both Day and Night.
  const dayByDay = useMemo(() => {
    if (!weather || !folder) return [];
    const pool: Item[] = inFolder.length >= 4 ? inFolder : [...inFolder, ...recommended];
    const pickFor = (day: { pack: Season }, cat: Item["category"], dayIdx: number, exclude: Set<string>, offset = 0): Item | undefined => {
      const candidates = pool.filter(
        (i) => !exclude.has(i.id) && i.category === cat && (i.season === day.pack || i.season === "Year-round"),
      );
      if (candidates.length === 0) return undefined;
      return candidates[(dayIdx + offset) % candidates.length];
    };
    const buildSlot = (d: { date: string; pack: Season; precip: number }, idx: number, slot: DaySlot, dayUsed: Set<string>) => {
      const source = slot === "night" ? folder.nightAssignments : folder.dayAssignments;
      const assignedIds = source?.[d.date] ?? [];
      const assigned = assignedIds.map((id) => items.find((i) => i.id === id)).filter((x): x is Item => !!x);
      const have = new Set(assigned.map((a) => a.category));
      const exclude = new Set<string>([...assigned.map((a) => a.id), ...dayUsed]);
      const offset = slot === "night" ? 1 : 0;
      const slotFor = (cat: Item["category"]) =>
        assigned.find((a) => a.category === cat) ??
        (have.has(cat) ? undefined : pickFor(d, cat, idx, exclude, offset));
      return {
        pinnedCount: assigned.length,
        top: slotFor("Tops"),
        bottom: slotFor("Bottoms"),
        shoes: slotFor("Shoes"),
        outer:
          assigned.find((a) => a.category === "Outerwear") ??
          (d.pack === "Cold" || d.precip >= 2 || slot === "night"
            ? pickFor(d, "Outerwear", idx, exclude, offset)
            : undefined),
        accessory: slotFor("Accessories"),
      };
    };
    return weather.days.map((d, idx) => {
      const day = buildSlot(d, idx, "day", new Set());
      const dayUsed = new Set([day.top, day.bottom, day.shoes, day.outer, day.accessory].filter(Boolean).map((i) => (i as Item).id));
      const night = buildSlot(d, idx, "night", dayUsed);
      return { day: d, dayLook: day, nightLook: night };
    });
  }, [weather, folder, inFolder, recommended, items]);

  const packingList = useMemo(() => {
    const seen = new Set<string>();
    const result: Item[] = [];
    for (const { dayLook, nightLook } of dayByDay) {
      for (const look of [dayLook, nightLook]) {
        for (const item of [look.outer, look.top, look.bottom, look.shoes, look.accessory]) {
          if (item && !seen.has((item as Item).id)) { seen.add((item as Item).id); result.push(item as Item); }
        }
      }
    }
    for (const item of inFolder) {
      if (!seen.has(item.id)) { seen.add(item.id); result.push(item); }
    }
    return result;
  }, [dayByDay, inFolder]);

  const byCategory = useMemo(() => {
    const order = ["Tops", "Bottoms", "Dresses", "Sweaters", "Outerwear", "Shoes", "Accessories"] as const;
    return order.map((cat) => ({ cat, items: packingList.filter((i) => i.category === cat) })).filter((g) => g.items.length > 0);
  }, [packingList]);

  if (!folder) {
    return (
      <PageShell title="Folder">
        <div className="px-6 pt-10 text-center text-muted-foreground">
          <p className="font-serif text-2xl mb-2 tracking-[0.04em] uppercase">Folder not found</p>
          {hydrated && (
            <Link to="/folders" className="text-xs underline underline-offset-4">Back to folders</Link>
          )}
        </div>
      </PageShell>
    );
  }

  const fetchWeather = async () => {
    if (!destination.trim() || !startDate || !endDate) return;
    setLoadingWx(true);
    setWxError(null);
    closet.updateFolder(folder.id, {
      destination: destination.trim(),
      startDate,
      endDate,
    });
    try {
      const w = await getTripWeather(destination.trim(), startDate, endDate);
      if (!w) {
        setWxError("Couldn't find that destination — try a city name.");
      } else {
        setWeather(w);
      }
    } catch {
      setWxError("Weather lookup failed. Check your connection and try again.");
    } finally {
      setLoadingWx(false);
    }
  };

  return (
    <PageShell title={folder.name}>
      <section className="px-6 pt-4 pb-10">
        <Link to="/folders" className="inline-flex items-center gap-1 text-xs text-muted-foreground mb-4">
          <ArrowLeft className="size-3.5" /> All folders
        </Link>

        <div className="flex justify-between items-end mb-5">
          <div>
            <p className="text-[10px] uppercase tracking-[0.22em] text-mint mb-1">Collection</p>
            <h1 className="font-serif text-3xl leading-none tracking-[0.06em] uppercase">{folder.name}</h1>
            <p className="text-xs text-muted-foreground mt-2">{inFolder.length} items</p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={async () => {
                const url = `${window.location.origin}/share/folder/${folder.id}`;
                const shareData = { title: `${folder.name} — Clem`, text: `Peek at what I'm packing for ${folder.name}`, url };
                try {
                  if (navigator.share) await navigator.share(shareData);
                  else { await navigator.clipboard.writeText(url); alert("Link copied to clipboard"); }
                } catch { /* user cancelled */ }
              }}
              className="size-10 rounded-full border border-border grid place-items-center text-muted-foreground active:scale-95 transition"
              aria-label="Share folder"
            >
              <Share2 className="size-4" strokeWidth={1.5} />
            </button>
            <button
              type="button"
              onClick={() => {
                closet.deleteFolder(folder.id);
                navigate({ to: "/folders" });
              }}
              className="size-10 rounded-full border border-border grid place-items-center text-muted-foreground active:scale-95 transition"
              aria-label="Delete folder"
            >
              <Trash2 className="size-4" strokeWidth={1.5} />
            </button>
          </div>
        </div>

        {/* Trip planner */}
        <div className="mb-6 rounded-2xl border border-mint-soft bg-mint-soft/25 p-4">
          <div className="flex items-center gap-2 mb-3">
            <CloudSun className="size-4 text-mint" strokeWidth={1.75} />
            <p className="text-[10px] uppercase tracking-[0.22em] text-mint">Trip planner</p>
          </div>
          <div className="space-y-2">
            <div className="relative">
              <MapPin className="size-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                placeholder="Destination (e.g. Lisbon)"
                className="w-full rounded-full bg-background border border-border pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-mint/30"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  const val = e.target.value;
                  setStartDate(val);
                  if (val && endDate) closet.updateFolder(folder.id, { destination: destination.trim(), startDate: val, endDate });
                }}
                className="rounded-full bg-background border border-border px-4 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-mint/30"
              />
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  const val = e.target.value;
                  setEndDate(val);
                  if (startDate && val) closet.updateFolder(folder.id, { destination: destination.trim(), startDate, endDate: val });
                }}
                className="rounded-full bg-background border border-border px-4 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-mint/30"
              />
            </div>
            <button
              type="button"
              onClick={fetchWeather}
              disabled={!destination.trim() || !startDate || !endDate || loadingWx}
              className="w-full rounded-full bg-foreground text-background py-2.5 text-xs font-medium tracking-wide active:scale-[0.98] transition disabled:opacity-40"
            >
              {loadingWx ? "Checking forecast…" : weather ? "Refresh forecast" : "Check weather"}
            </button>
          </div>

          {wxError && <p className="mt-3 text-xs text-destructive">{wxError}</p>}

          {weather && (
            <div className="mt-4 pt-4 border-t border-mint-soft animate-rise">
              <p className="font-serif text-xl leading-tight tracking-[0.02em]">
                {weather.place}
                {weather.country && <span className="text-muted-foreground text-base"> · {weather.country}</span>}
              </p>
              <div className="flex gap-4 mt-2 text-xs text-foreground/80">
                <span>
                  <span className="tabular-nums font-medium">{weather.avgHigh}°F</span>
                  <span className="text-muted-foreground"> high</span>
                </span>
                <span>
                  <span className="tabular-nums font-medium">{weather.avgLow}°F</span>
                  <span className="text-muted-foreground"> low</span>
                </span>
                <span>
                  <span className="tabular-nums font-medium">{weather.precipDays}</span>
                  <span className="text-muted-foreground"> rainy day{weather.precipDays === 1 ? "" : "s"}</span>
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-2 leading-relaxed">{weather.description}</p>
              <span className="inline-block mt-3 text-[10px] uppercase tracking-wider px-2.5 py-1 rounded-full bg-foreground text-background">
                Pack: {weather.pack}
              </span>
            </div>
          )}
        </div>

        {/* Day Plan — shows whenever dates are saved, no weather needed */}
        {tripDaysArray.length > 0 && (
          <div className="mb-8 animate-rise">
            <div className="flex items-center gap-2 mb-3">
              <CalendarDays className="size-3.5 text-mint" />
              <p className="text-[10px] uppercase tracking-[0.22em] text-mint">Day plan</p>
            </div>
            <div className="space-y-3">
              {tripDaysArray.map((date) => {
                const dateObj = new Date(date + "T00:00:00");
                const label = dateObj.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
                const assignedIds = folder.dayAssignments?.[date] ?? [];
                const dayItemsList = items.filter((i) => assignedIds.includes(i.id));
                const isPickingThis = pickingDay === date;
                return (
                  <div key={date} className="rounded-2xl border border-border bg-card/40 p-4">
                    <div className="flex items-center justify-between mb-3">
                      <p className="font-serif text-base leading-none tracking-[0.02em]">{label}</p>
                      <button
                        type="button"
                        onClick={() => setPickingDay(isPickingThis ? null : date)}
                        className="text-[9px] uppercase tracking-wider text-muted-foreground flex items-center gap-0.5 active:opacity-60 transition"
                      >
                        {isPickingThis ? "Done" : <><Plus className="size-2.5" /> Add</>}
                      </button>
                    </div>
                    {dayItemsList.length === 0 && !isPickingThis ? (
                      <p className="text-xs text-muted-foreground italic">Tap Add to assign items for this day.</p>
                    ) : (
                      <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-1 px-1">
                        {dayItemsList.map((item) => (
                          <div key={item.id} className="shrink-0 w-16">
                            <div className="relative aspect-[3/4] rounded-md overflow-hidden bg-card outline outline-1 -outline-offset-1 outline-black/5">
                              <img src={item.image} alt={item.name} loading="lazy" className="w-full h-full object-cover" />
                              <button
                                type="button"
                                onClick={() => closet.toggleItemOnDay(folder.id, date, item.id)}
                                className="absolute top-1 right-1 size-5 rounded-full bg-foreground text-background grid place-items-center active:scale-90 transition"
                                aria-label={`Remove ${item.name} from ${label}`}
                              >
                                <Check className="size-3" strokeWidth={2.5} />
                              </button>
                            </div>
                            <p className="text-[9px] mt-1 leading-tight line-clamp-1 text-muted-foreground">{item.name}</p>
                          </div>
                        ))}
                      </div>
                    )}
                    {isPickingThis && (
                      <div className="mt-3 animate-rise">
                        <p className="text-[9px] uppercase tracking-[0.18em] text-muted-foreground mb-2">Tap to assign</p>
                        <div className="grid grid-cols-4 gap-2 max-h-52 overflow-y-auto pr-1">
                          {items.map((item) => {
                            const isPinned = assignedIds.includes(item.id);
                            return (
                              <button
                                key={item.id}
                                type="button"
                                onClick={() => closet.toggleItemOnDay(folder.id, date, item.id)}
                                className="relative aspect-[3/4] rounded-md overflow-hidden bg-card outline outline-1 -outline-offset-1 outline-black/5 active:scale-95 transition"
                              >
                                <img src={item.image} alt={item.name} loading="lazy" className="w-full h-full object-cover" />
                                {isPinned && (
                                  <span className="absolute inset-0 bg-foreground/50 grid place-items-center">
                                    <Check className="size-4 text-background" strokeWidth={2.5} />
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Day-by-day outfits */}
        {weather && dayByDay.length > 0 && (
          <div className="mb-8 animate-rise">
            <div className="flex items-center gap-2 mb-3">
              <CalendarDays className="size-3.5 text-mint" />
              <p className="text-[10px] uppercase tracking-[0.22em] text-mint">Day by day in {weather.place}</p>
            </div>
            <p className="text-xs text-muted-foreground mb-4 max-w-[36ch]">
              Outfits styled from this folder, tuned to each day's forecast.
            </p>
            <div className="space-y-4">
              {dayByDay.map(({ day, dayLook, nightLook }, idx) => {
                const date = day.date ? new Date(day.date + "T00:00:00") : null;
                const label = date
                  ? date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })
                  : `Day ${idx + 1}`;
                const totalPinned = dayLook.pinnedCount + nightLook.pinnedCount;
                const renderRow = (look: typeof dayLook, slot: DaySlot) => {
                  const all = [look.outer, look.top, look.bottom, look.shoes, look.accessory].filter(Boolean) as Item[];
                  const source = slot === "night" ? folder.nightAssignments : folder.dayAssignments;
                  const pinnedIds = new Set(source?.[day.date] ?? []);
                  const Icon = slot === "night" ? Moon : Sun;
                  const labelText = slot === "night" ? "Evening" : "Daytime";
                  const isPickingThis = pickingFor?.date === day.date && pickingFor?.slot === slot;
                  return (
                    <div className="pt-3 first:pt-0 first:border-t-0 border-t border-border/60">
                      <div className="flex items-center gap-1.5 mb-2">
                        <Icon className="size-3 text-muted-foreground" strokeWidth={1.75} />
                        <p className="text-[9px] uppercase tracking-[0.22em] text-muted-foreground">{labelText}</p>
                        {look.pinnedCount > 0 && (
                          <span className="text-[9px] text-muted-foreground">· {look.pinnedCount} pinned</span>
                        )}
                        <button
                          type="button"
                          onClick={() => setPickingFor(isPickingThis ? null : { date: day.date, slot })}
                          className="ml-auto text-[9px] uppercase tracking-wider text-muted-foreground flex items-center gap-0.5 active:opacity-60 transition"
                        >
                          {isPickingThis ? "Done" : <><Plus className="size-2.5" /> Add</>}
                        </button>
                      </div>
                      {all.length === 0 && !isPickingThis ? (
                        <p className="text-xs text-muted-foreground italic">Tap Add to pick items for this {labelText.toLowerCase()}.</p>
                      ) : (
                        <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-1 px-1">
                          {all.map((p) => {
                            const isPinned = pinnedIds.has(p.id);
                            return (
                              <div key={`${slot}-${p.id}`} className="shrink-0 w-20">
                                <div className={`relative aspect-[3/4] rounded-md overflow-hidden bg-background outline outline-1 -outline-offset-1 ${isPinned ? "outline-foreground" : "outline-black/5"}`}>
                                  <img src={p.image} alt={p.name} loading="lazy" className="w-full h-full object-cover" />
                                  {isPinned ? (
                                    <button
                                      type="button"
                                      onClick={() => closet.toggleItemOnDay(folder.id, day.date, p.id, slot)}
                                      className="absolute top-1 right-1 size-5 rounded-full bg-foreground text-background grid place-items-center active:scale-90 transition"
                                    >
                                      <Check className="size-3" strokeWidth={2.5} />
                                    </button>
                                  ) : (
                                    <span className="absolute top-1 left-1 text-[8px] uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-background/85 text-muted-foreground">
                                      Auto
                                    </span>
                                  )}
                                </div>
                                <p className="text-[10px] mt-1 leading-tight line-clamp-2">{p.name}</p>
                              </div>
                            );
                          })}
                        </div>
                      )}
                      {isPickingThis && (
                        <div className="mt-3 animate-rise">
                          <p className="text-[9px] uppercase tracking-[0.18em] text-muted-foreground mb-2">Your closet — tap to pin</p>
                          <div className="grid grid-cols-4 gap-2">
                            {items.map((item) => {
                              const isPinned = pinnedIds.has(item.id);
                              return (
                                <button
                                  key={item.id}
                                  type="button"
                                  onClick={() => closet.toggleItemOnDay(folder.id, day.date, item.id, slot)}
                                  className="relative aspect-[3/4] rounded-md overflow-hidden bg-card outline outline-1 -outline-offset-1 outline-black/5 active:scale-95 transition"
                                >
                                  <img src={item.image} alt={item.name} loading="lazy" className="w-full h-full object-cover" />
                                  {isPinned && (
                                    <span className="absolute inset-0 bg-foreground/50 grid place-items-center">
                                      <Check className="size-4 text-background" strokeWidth={2.5} />
                                    </span>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                };
                return (
                  <div key={day.date || idx} className="rounded-2xl border border-border bg-card/40 p-4">
                    <div className="flex items-baseline justify-between mb-3">
                      <div>
                        <p className="font-serif text-lg leading-none tracking-[0.02em]">{label}</p>
                        <p className="text-[11px] text-muted-foreground mt-1">
                          {day.summary}
                          {totalPinned > 0 && ` · ${totalPinned} pinned`}
                        </p>
                      </div>
                      <span className="text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-mint-soft/60 text-mint">
                        {day.pack}
                      </span>
                    </div>
                    <div className="space-y-3">
                      {renderRow(dayLook, "day")}
                      {renderRow(nightLook, "night")}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}


        {/* Items — flat grid when no dates; unassigned section when dates are set */}
        {inFolder.length === 0 && !picking && tripDaysArray.length === 0 && (
          <div className="text-center py-10 text-muted-foreground">
            <p className="font-serif text-lg mb-2 tracking-[0.04em] uppercase">Empty for now</p>
            <p className="text-xs">Add pieces from your closet to plan this look.</p>
          </div>
        )}

        {tripDaysArray.length > 0 && unassignedInFolder.length > 0 && (
          <div className="mb-6">
            <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground mb-3">Unassigned</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-8">
              {unassignedInFolder.map((item) => (
                <article key={item.id} className="animate-rise">
                  <div className="w-full aspect-[3/4] bg-card rounded-lg overflow-hidden outline outline-1 -outline-offset-1 outline-black/5 mb-3">
                    <img src={item.image} alt={item.name} loading="lazy" className="w-full h-full object-cover" />
                  </div>
                  <p className="text-xs font-medium leading-tight">{item.name}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{[item.brand, item.color].filter(Boolean).join(" • ")}</p>
                </article>
              ))}
            </div>
          </div>
        )}

        {tripDaysArray.length === 0 && inFolder.length > 0 && (
          <div className="grid grid-cols-2 gap-x-4 gap-y-8 mb-6">
            {inFolder.map((item) => (
              <article key={item.id} className="animate-rise">
                <div className="w-full aspect-[3/4] bg-card rounded-lg overflow-hidden outline outline-1 -outline-offset-1 outline-black/5 mb-3">
                  <img src={item.image} alt={item.name} loading="lazy" className="w-full h-full object-cover" />
                </div>
                <p className="text-xs font-medium leading-tight">{item.name}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{[item.brand, item.color].filter(Boolean).join(" • ")}</p>
              </article>
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={() => setPicking((p) => !p)}
          className="w-full rounded-full bg-foreground text-background py-3 text-sm font-medium inline-flex items-center justify-center gap-2 active:scale-[0.98] transition"
        >
          <Plus className="size-4" /> {picking ? "Done" : "Add items"}
        </button>

        {picking && (
          <div className="mt-6 animate-rise">
            <p className="text-[10px] uppercase tracking-[0.22em] text-mint mb-3">Tap to toggle</p>
            <div className="grid grid-cols-3 gap-2">
              {items.map((item) => {
                const selected = folder.itemIds.includes(item.id);
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => closet.toggleItemInFolder(folder.id, item.id)}
                    className="relative aspect-[3/4] rounded-lg overflow-hidden bg-card outline outline-1 -outline-offset-1 outline-black/5 active:scale-95 transition"
                  >
                    <img src={item.image} alt={item.name} loading="lazy" className="w-full h-full object-cover" />
                    {selected && (
                      <span className="absolute inset-0 bg-mint/40 grid place-items-center">
                        <span className="size-7 rounded-full bg-primary text-primary-foreground grid place-items-center">
                          <Check className="size-4" strokeWidth={2.25} />
                        </span>
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Weather-aware recommendations */}
        {weather && recommended.length > 0 && (
          <div className="mt-8 animate-rise">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="size-3.5 text-mint" />
              <p className="text-[10px] uppercase tracking-[0.22em] text-mint">Suggested for this trip</p>
            </div>
            <p className="text-xs text-muted-foreground mb-4 max-w-[34ch]">
              Pieces from your closet that suit {weather.place}'s weather. Tap to add.
            </p>
            <div className="grid grid-cols-3 gap-2">
              {recommended.slice(0, 12).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => closet.toggleItemInFolder(folder.id, item.id)}
                  className="relative aspect-[3/4] rounded-lg overflow-hidden bg-card outline outline-1 -outline-offset-1 outline-black/5 active:scale-95 transition group"
                >
                  <img src={item.image} alt={item.name} loading="lazy" className="w-full h-full object-cover" />
                  <span className="absolute bottom-1 right-1 size-6 rounded-full bg-background/90 text-foreground grid place-items-center opacity-90">
                    <Plus className="size-3.5" />
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
        {/* Packing list */}
        {packingList.length > 0 && (
          <div className="mt-8 animate-rise">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Package className="size-3.5 text-mint" />
                <p className="text-[10px] uppercase tracking-[0.22em] text-mint">Packing list</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[10px] text-muted-foreground tabular-nums">
                  {packedIds.size}/{packingList.length} packed
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const lines = [
                      `Packing for ${folder.name}${destination ? ` — ${destination}` : ""}`,
                      "",
                      ...byCategory.flatMap(({ cat, items: catItems }) => [
                        `${cat}:`,
                        ...catItems.map((i) => `${packedIds.has(i.id) ? "✓" : "☐"} ${i.name}${i.brand ? ` (${i.brand})` : ""}`),
                        "",
                      ]),
                    ].join("\n").trim();
                    if (navigator.share) {
                      void navigator.share({ title: `Packing list — ${folder.name}`, text: lines });
                    } else {
                      void navigator.clipboard.writeText(lines).then(() => alert("Packing list copied!"));
                    }
                  }}
                  className="text-[10px] text-muted-foreground underline underline-offset-2 active:opacity-60 transition"
                >
                  Share
                </button>
              </div>
            </div>

            {/* Progress bar */}
            <div className="h-1 w-full rounded-full bg-mint-soft mb-5 overflow-hidden">
              <div
                className="h-full rounded-full bg-mint transition-all duration-300"
                style={{ width: packingList.length > 0 ? `${(packedIds.size / packingList.length) * 100}%` : "0%" }}
              />
            </div>

            <div className="space-y-5">
              {byCategory.map(({ cat, items: catItems }) => (
                <div key={cat}>
                  <p className="text-[9px] uppercase tracking-[0.22em] text-muted-foreground mb-2">{cat}</p>
                  <div className="space-y-2">
                    {catItems.map((item) => {
                      const packed = packedIds.has(item.id);
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => togglePacked(item.id)}
                          className="w-full flex items-center gap-3 active:opacity-70 transition"
                        >
                          <div className="shrink-0 w-12 aspect-[3/4] rounded-md overflow-hidden bg-card outline outline-1 -outline-offset-1 outline-black/5">
                            <img src={item.image} alt={item.name} loading="lazy" className={`w-full h-full object-cover transition-opacity ${packed ? "opacity-40" : ""}`} />
                          </div>
                          <div className="flex-1 text-left">
                            <p className={`text-xs font-medium leading-tight ${packed ? "line-through text-muted-foreground" : ""}`}>{item.name}</p>
                            {item.brand && <p className="text-[10px] text-muted-foreground mt-0.5">{item.brand}</p>}
                          </div>
                          <div className={`shrink-0 size-5 rounded-full border transition-colors ${packed ? "bg-foreground border-foreground" : "border-border"} grid place-items-center`}>
                            {packed && <Check className="size-3 text-background" strokeWidth={2.5} />}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {packedIds.size === packingList.length && packingList.length > 0 && (
              <p className="mt-4 text-center text-xs text-mint font-medium tracking-wide">All packed — have a great trip!</p>
            )}
          </div>
        )}
      </section>
    </PageShell>
  );
}
