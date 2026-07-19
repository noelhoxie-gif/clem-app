import type { ReactNode } from "react";
import { AppHeader } from "./AppHeader";
import { BottomNav } from "./BottomNav";

export function PageShell({ children, title }: { children: ReactNode; title?: string }) {
  return (
    <div className="min-h-screen bg-background text-foreground pb-32">
      <AppHeader title={title} />
      <main>{children}</main>
      <BottomNav />
    </div>
  );
}
