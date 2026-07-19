import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "app.clem.closet",
  appName: "Clem",
  webDir: "dist/client",
  plugins: {
    CapacitorHttp: {
      enabled: true,
    },
  },
};

export default config;
