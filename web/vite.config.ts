import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteTsConfigPaths from "vite-tsconfig-paths";
import tailwindcss from "@tailwindcss/vite";

const nativeModules = [
  "@tensorflow/tfjs-node",
  "@mapbox/node-pre-gyp",
  "mock-aws-s3",
  "aws-sdk",
  "nock",
];

export default defineConfig({
  plugins: [viteTsConfigPaths(), tailwindcss(), tanstackStart(), react()],
  ssr: {
    // Externalize native modules that can't be bundled
    external: nativeModules,
    noExternal: [],
  },
  optimizeDeps: {
    exclude: nativeModules,
  },
  build: {
    rollupOptions: {
      external: nativeModules,
    },
  },
});
