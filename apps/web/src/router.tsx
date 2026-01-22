import { createRouter as createTanStackRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { DefaultCatchBoundary } from "./components/DefaultCatchBoundary";

function NotFound() {
  return (
    <div className="min-h-[50vh] flex flex-col items-center justify-center gap-4 p-8 text-center">
      <span className="i-lucide-file-question w-16 h-16 text-text-muted" />
      <h1 className="text-2xl font-bold text-text-primary">ページが見つかりません</h1>
      <p className="text-text-secondary">
        お探しのページは存在しないか、移動した可能性があります。
      </p>
      <a
        href="/"
        className="mt-4 px-6 py-3 bg-accent text-white rounded-lg font-medium hover:bg-accent-hover transition-colors"
      >
        ホームに戻る
      </a>
    </div>
  );
}

export function getRouter() {
  const router = createTanStackRouter({
    routeTree,
    defaultPreload: "intent",
    defaultErrorComponent: DefaultCatchBoundary,
    defaultNotFoundComponent: NotFound,
    scrollRestoration: true,
  });

  return router;
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
