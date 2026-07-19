import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { closet } from "@/lib/vesti/store";
import { scrapeProduct } from "@/lib/api/wishlist.functions";

export const Route = createFileRoute("/save")({
  validateSearch: (search: Record<string, unknown>) => ({
    url: typeof search.url === "string" ? search.url : "",
    title: typeof search.title === "string" ? search.title : "",
    text: typeof search.text === "string" ? search.text : "",
  }),
  component: SavePage,
});

function SavePage() {
  const { url, title, text } = Route.useSearch();
  const navigate = useNavigate();

  // URL can arrive in `url` param or in `text` (some browsers put the URL there)
  const targetUrl = url || (text.startsWith("http") ? text : "");

  useEffect(() => {
    if (!targetUrl) {
      void navigate({ to: "/wishlist", search: { mode: "wishlist" } });
      return;
    }

    scrapeProduct({ data: { url: targetUrl } })
      .then((item) => {
        closet.addWish(item);
      })
      .catch(() => {
        // Scrape failed — save a minimal item so the URL isn't lost
        closet.addWish({ url: targetUrl, title: title || targetUrl });
      })
      .finally(() => {
        void navigate({ to: "/wishlist", search: { mode: "wishlist" } });
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen bg-[#F5F2EC] flex flex-col items-center justify-center gap-4 px-6">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#1C1C1C] border-t-transparent" />
      <p className="text-sm text-[#1C1C1C]/70 tracking-wide">Saving to your wishlist…</p>
    </div>
  );
}
