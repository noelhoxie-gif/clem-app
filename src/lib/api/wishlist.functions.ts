export interface ScrapedItem {
  url: string;
  title: string;
  image?: string;
  brand?: string;
  description?: string;
  price?: string;
}

async function post<T>(action: string, data: Record<string, unknown>): Promise<T> {
  const res = await fetch("/api/wishlist", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, ...data }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` })) as { error?: string };
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export const scrapeProduct = async ({ data }: { data: { url: string } }): Promise<ScrapedItem> => {
  return post<ScrapedItem>("scrape", { url: data.url });
};

export const searchProducts = async ({ data }: { data: { query: string } }): Promise<ScrapedItem[]> => {
  return post<ScrapedItem[]>("search", { query: data.query });
};

export const identifyFromImage = async ({ data }: { data: { image: string } }): Promise<{ query: string; description: string }> => {
  return post<{ query: string; description: string }>("identify", { image: data.image });
};
