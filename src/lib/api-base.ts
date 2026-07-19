import { Capacitor } from "@capacitor/core";

/** Resolve API paths for web (relative) vs native (deployed backend URL). */
export function getApiUrl(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;

  if (!Capacitor.isNativePlatform()) {
    return normalized;
  }

  const base = import.meta.env.VITE_SERVER_BASE_URL?.replace(/\/$/, "") ?? "";
  if (!base) {
    console.warn("VITE_SERVER_BASE_URL is not set; API calls may fail on device.");
    return normalized;
  }

  return `${base}${normalized}`;
}
