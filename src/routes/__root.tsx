import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { Capacitor } from "@capacitor/core";
import { StatusBar, Style } from "@capacitor/status-bar";
import { Toaster } from "@/components/ui/sonner";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import { hasSeenTutorial } from "@/lib/vesti/tutorial";
import { useProfile } from "@/lib/vesti/profile";

// Capture the URL hash synchronously at module-load time, before TanStack
// Router (or any other effect) can normalise / clear it.
const _initialHash = typeof window !== "undefined" ? window.location.hash : "";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no" },
      { name: "theme-color", content: "#1C1C1C" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "default" },
      { title: "Clem — Your digital closet" },
      { name: "description", content: "Organize your wardrobe, plan outfits for every occasion, and discover new looks with AI." },
      { name: "author", content: "Clem" },
      { property: "og:title", content: "Clem — Your digital closet" },
      { property: "og:description", content: "Organize your wardrobe, plan outfits for every occasion, and discover new looks with AI." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.json" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500&family=Jost:wght@200;300;400;500;600&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function AuthGuard() {
  const { user, loading } = useAuth();
  const { profile } = useProfile();
  const router = useRouter();
  const pathname = router.state.location.pathname;
  const isPublicPage = pathname === "/login" || pathname === "/reset-password";
  const isTutorialPage = pathname === "/tutorial";
  const isOnboardingPage = pathname === "/onboarding";
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!mounted || loading) return;

    // Supabase recovery links (and error responses) land on / with params in
    // the hash. Use _initialHash (captured at module load) because TanStack
    // Router may normalise the URL before this effect runs, clearing the hash.
    const params = new URLSearchParams(_initialHash.slice(1));
    if (params.get("type") === "recovery") {
      void supabase.auth.setSessionFromHash(_initialHash).then(() => {
        window.location.replace("/reset-password");
      });
      return;
    }
    if (params.get("error")) {
      window.location.replace("/reset-password" + _initialHash);
      return;
    }

    if (!user && !isPublicPage) {
      void router.navigate({ to: "/login" });
      return;
    }

    // First run after sign-in: show the 3-screen tour before the main app.
    if (user && !isPublicPage && !isTutorialPage && !hasSeenTutorial()) {
      void router.navigate({ to: "/tutorial" });
      return;
    }

    // Style profile isn't done yet: send them to the onboarding wizard.
    // Runs on every sign-in (not just right after signup) until they
    // actually complete it — matches the "Begin onboarding" prompt already
    // shown on the profile page.
    if (
      user &&
      !isPublicPage &&
      !isTutorialPage &&
      !isOnboardingPage &&
      hasSeenTutorial() &&
      !profile.completedAt
    ) {
      void router.navigate({ to: "/onboarding" });
    }
  }, [mounted, user, loading, isPublicPage, isTutorialPage, isOnboardingPage, profile.completedAt, router]);

  // During SSR and initial hydration, render Outlet to match server HTML.
  // Only show spinner after client mounts to avoid React #418 mismatch.
  if (mounted && loading && !isPublicPage) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-foreground border-t-transparent" />
      </div>
    );
  }

  return <Outlet />;
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    document.documentElement.classList.add("capacitor-native");
    void StatusBar.setOverlaysWebView({ overlay: false });
    void StatusBar.setStyle({ style: Style.Light });
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AuthGuard />
        <Toaster position="bottom-center" />
      </AuthProvider>
    </QueryClientProvider>
  );
}
