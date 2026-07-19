import { useMemo, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { useCloset, type Item } from "@/lib/vesti/store";
import { wearLog, useWearLog, todayISO } from "@/lib/vesti/wear-log";
import { AlertTriangle, Check, X } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  /** Pre-selected items (e.g. from a saved outfit). User can still adjust. */
  initialItemIds?: string[];
  /** Pre-filled date (YYYY-MM-DD). Defaults to today. */
  initialDate?: string;
  title?: string;
}

export function LogWearSheet({ open, onClose, initialItemIds = [], initialDate, title }: Props) {
  const { items: allItems } = useCloset();
  const items = useMemo(() => allItems.filter((i) => (i.status ?? "active") === "active"), [allItems]);
  useWearLog(); // subscribe so known-people stays fresh
  const [selected, setSelected] = useState<string[]>(initialItemIds);
  const [date, setDate] = useState<string>(todayISO());
  const [peopleInput, setPeopleInput] = useState("");
  const [people, setPeople] = useState<string[]>([]);
  const [note, setNote] = useState("");

  // Reset when opening with new initials
  const initialsKey = initialItemIds.join("|");
  useMemo(() => {
    if (open) {
      setSelected(initialItemIds);
      setDate(initialDate ?? todayISO());
      setPeople([]);
      setPeopleInput("");
      setNote("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialsKey]);

  const selectedItems = items.filter((i) => selected.includes(i.id));
  const knownPeople = wearLog.knownPeople();
  const repeats = useMemo(
    () => wearLog.findRepeats(selected, people),
    [selected, people],
  );

  const addPerson = (raw: string) => {
    const name = raw.trim();
    if (!name || people.includes(name)) return;
    setPeople((p) => [...p, name]);
    setPeopleInput("");
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selected.length === 0) return;
    wearLog.log({ date, itemIds: selected, people, note: note.trim() || undefined });
    onClose();
  };

  const toggle = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="bottom" className="rounded-t-3xl border-border max-h-[88vh] overflow-y-auto">
        <SheetHeader className="text-left">
          <p className="text-[10px] uppercase tracking-[0.22em] text-mint">Log wear</p>
          <SheetTitle className="font-serif text-2xl tracking-[0.02em]">
            {title ?? "What did you wear?"}
          </SheetTitle>
          <SheetDescription className="text-xs">
            Adds real-wear data to your Seasonal Report.
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={onSubmit} className="mt-5 space-y-5">
          {/* Date */}
          <div>
            <label className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Date</label>
            <input
              type="date"
              value={date}
              max={todayISO()}
              onChange={(e) => setDate(e.target.value)}
              className="mt-1 w-full rounded-xl bg-card border border-border px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-mint/30"
            />
          </div>

          {/* Selected items strip */}
          {selectedItems.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-2">
                Wearing · {selectedItems.length}
              </p>
              <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-1 px-1">
                {selectedItems.map((it) => (
                  <button
                    key={it.id}
                    type="button"
                    onClick={() => toggle(it.id)}
                    className="relative shrink-0 size-16 rounded-lg overflow-hidden border border-border"
                    aria-label={`Remove ${it.name}`}
                  >
                    <img src={it.image} alt="" className="w-full h-full object-cover" />
                    <span className="absolute top-0.5 right-0.5 size-4 grid place-items-center rounded-full bg-background/85">
                      <X className="size-2.5" />
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Picker */}
          <div>
            <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-2">
              {selectedItems.length === 0 ? "Pick pieces" : "Add more"}
            </p>
            <div className="grid grid-cols-4 gap-2 max-h-56 overflow-y-auto pr-1">
              {items.map((it: Item) => {
                const on = selected.includes(it.id);
                return (
                  <button
                    key={it.id}
                    type="button"
                    onClick={() => toggle(it.id)}
                    className={`relative aspect-square rounded-lg overflow-hidden border transition ${
                      on ? "border-foreground ring-2 ring-foreground/30" : "border-border opacity-70"
                    }`}
                  >
                    <img src={it.image} alt={it.name} className="w-full h-full object-cover" />
                    {on && (
                      <span className="absolute top-1 right-1 size-4 grid place-items-center rounded-full bg-foreground text-background">
                        <Check className="size-2.5" strokeWidth={2.5} />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* People */}
          <div>
            <label className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Who saw it? <span className="italic normal-case text-muted-foreground/70">— optional</span>
            </label>
            <div className="mt-1 flex gap-2">
              <input
                value={peopleInput}
                onChange={(e) => setPeopleInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === ",") {
                    e.preventDefault();
                    addPerson(peopleInput);
                  }
                }}
                placeholder="e.g. Sarah, Work team"
                className="flex-1 rounded-xl bg-card border border-border px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-mint/30"
              />
              <button
                type="button"
                onClick={() => addPerson(peopleInput)}
                className="rounded-full bg-foreground text-background px-4 text-xs font-medium active:scale-95 transition"
              >
                Add
              </button>
            </div>
            {people.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {people.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPeople((arr) => arr.filter((x) => x !== p))}
                    className="text-[11px] px-2.5 py-1 rounded-full bg-mauve/10 text-mauve border border-mauve/30 inline-flex items-center gap-1"
                  >
                    {p}
                    <X className="size-3" />
                  </button>
                ))}
              </div>
            )}
            {knownPeople.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {knownPeople
                  .filter((p) => !people.includes(p))
                  .slice(0, 8)
                  .map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => addPerson(p)}
                      className="text-[10px] uppercase tracking-[0.16em] px-2 py-0.5 rounded-full border border-border text-muted-foreground hover:text-foreground transition"
                    >
                      + {p}
                    </button>
                  ))}
              </div>
            )}
          </div>

          {/* Repeat warning */}
          {repeats.length > 0 && (
            <div className="flex gap-2 rounded-xl border border-mauve/40 bg-mauve/10 p-3 text-mauve">
              <AlertTriangle className="size-4 shrink-0 mt-0.5" strokeWidth={1.5} />
              <div className="text-[11px] leading-relaxed">
                <p className="font-medium uppercase tracking-[0.16em] text-[10px] mb-0.5">Heads up</p>
                You've worn this exact combination{" "}
                {repeats.length === 1 ? "once before" : `${repeats.length} times before`}
                {people.length > 0 ? " around the same people" : ""} — most recently {repeats[0].date}.
              </div>
            </div>
          )}

          {/* Note */}
          <div>
            <label className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Note <span className="italic normal-case text-muted-foreground/70">— optional</span>
            </label>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Anna's birthday dinner"
              className="mt-1 w-full rounded-xl bg-card border border-border px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-mint/30"
            />
          </div>

          <button
            type="submit"
            disabled={selected.length === 0}
            className="w-full rounded-full bg-foreground text-background py-3 text-xs uppercase tracking-[0.22em] disabled:opacity-40 active:scale-[0.98] transition"
          >
            Log to history
          </button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
