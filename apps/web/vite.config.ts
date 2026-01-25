import { defineConfig } from "vite";
import devServer from "@hono/vite-dev-server";
import build from "@hono/vite-build/cloudflare-workers";
import UnoCSS from "unocss/vite";

export default defineConfig({
  plugins: [
    UnoCSS(),
    build({
      entry: "src/index.tsx",
    }),
    devServer({
      entry: "src/index.tsx",
    }),
  ],
});
