import { Glob } from "bun";
import { join, extname } from "path";

const PORT = parseInt(process.env.PORT || "3000", 10);
const DIST_DIR = join(import.meta.dir, "dist");
const PUBLIC_DIR = join(DIST_DIR, "client");
const SERVER_DIR = join(DIST_DIR, "server");

// MIME types
const MIME_TYPES: Record<string, string> = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
};

// Preload static assets into memory
const staticAssets = new Map<string, { content: Uint8Array; type: string }>();

async function preloadStaticAssets() {
  const glob = new Glob("**/*");
  for await (const file of glob.scan({ cwd: PUBLIC_DIR })) {
    const filePath = join(PUBLIC_DIR, file);
    const bunFile = Bun.file(filePath);
    if (await bunFile.exists()) {
      const content = new Uint8Array(await bunFile.arrayBuffer());
      const ext = extname(file);
      const type = MIME_TYPES[ext] || "application/octet-stream";
      staticAssets.set(`/${file}`, { content, type });
    }
  }
  console.log(`Preloaded ${staticAssets.size} static assets`);
}

// Import the handler from the built server
async function loadHandler() {
  const handlerPath = join(SERVER_DIR, "server.js");
  const mod = await import(handlerPath);
  // TanStack Start exports { default: { fetch }, fetch }
  return mod.default?.fetch || mod.fetch;
}

async function main() {
  await preloadStaticAssets();
  const handler = await loadHandler();

  Bun.serve({
    port: PORT,
    async fetch(request) {
      const url = new URL(request.url);
      const pathname = url.pathname;

      // Serve static assets from memory
      const staticAsset = staticAssets.get(pathname);
      if (staticAsset) {
        return new Response(staticAsset.content.slice().buffer, {
          headers: {
            "Content-Type": staticAsset.type,
            "Cache-Control": "public, max-age=31536000, immutable",
          },
        });
      }

      // Fallback to TanStack Start handler
      try {
        return await handler(request);
      } catch (error) {
        console.error("Handler error:", error);
        return new Response("Internal Server Error", { status: 500 });
      }
    },
  });

  console.log(`Server running at http://localhost:${PORT}`);
}

main().catch(console.error);
