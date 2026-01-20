import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteTsConfigPaths from "vite-tsconfig-paths";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [viteTsConfigPaths(), tailwindcss(), tanstackStart(), react()],
  ssr: {
    // Externalize native modules that can't be bundled
    external: ["@tensorflow/tfjs-node"],
  },
});
