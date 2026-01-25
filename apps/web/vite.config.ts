import { defineConfig } from "vite";
import devServer from "@hono/vite-dev-server";
import build from "@hono/vite-build/cloudflare-workers";
import UnoCSS from "unocss/vite";

export default defineConfig(({ mode }) => {
  if (mode === "client") {
    return {
      plugins: [UnoCSS()],
      build: {
        outDir: "dist/assets/static",
        rollupOptions: {
          input: {
            style: "./src/styles/main.css",
            islands: "./src/islands/index.tsx",
          },
          output: {
            entryFileNames: "[name].js",
            assetFileNames: "[name].[ext]",
          },
        },
      },
    };
  }

  return {
    plugins: [
      UnoCSS(),
      build({
        entry: "src/index.tsx",
        output: "dist/index.js",
      }),
      devServer({
        entry: "src/index.tsx",
      }),
    ],
  };
});
