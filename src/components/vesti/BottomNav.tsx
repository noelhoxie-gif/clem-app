import { Link, useRouterState } from "@tanstack/react-router";

const tabs = [
  { to: "/", label: "Closet" },
  { to: "/outfits", label: "Looks" },
  { to: "/folders", label: "Collections" },
  { to: "/wishlist", label: "Curate" },
  { to: "/trends", label: "Report" },
  { to: "/profile", label: "Account" },
] as const;

export function BottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 bg-cream text-ink border-t border-ink/10">
      <div
        className="overflow-x-auto no-scrollbar pt-4 pb-[max(env(safe-area-inset-bottom),1rem)]"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        <ul className="flex items-center gap-7 px-6 w-max mx-auto min-w-full justify-between">
          {tabs.map(({ to, label }) => {
            const active = to === "/" ? pathname === "/" : pathname.startsWith(to);
            return (
              <li key={to} className="shrink-0">
                <Link
                  to={to}
                  className={`relative block text-[11px] uppercase tracking-[0.22em] transition-colors py-1 font-light ${
                    active ? "text-ink" : "text-ink/40"
                  }`}
                >
                  {label}
                  {active && (
                    <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 h-px w-6 bg-mauve" />
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
