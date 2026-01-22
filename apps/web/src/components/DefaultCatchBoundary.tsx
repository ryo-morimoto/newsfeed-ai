import { ErrorComponent, rootRouteId, useMatch, useRouter } from "@tanstack/react-router";
import type { ErrorComponentProps } from "@tanstack/react-router";

export function DefaultCatchBoundary({ error }: ErrorComponentProps) {
  const router = useRouter();
  const isRoot = useMatch({
    strict: false,
    select: (state) => state.id === rootRouteId,
  });

  console.error("DefaultCatchBoundary Error:", error);

  return (
    <div className="min-h-[50vh] flex flex-col items-center justify-center gap-6 p-8">
      <ErrorComponent error={error} />
      <div className="flex gap-3 items-center flex-wrap">
        <button
          onClick={() => {
            router.invalidate();
          }}
          className="px-4 py-2 bg-accent text-white rounded-lg font-medium hover:bg-accent-hover transition-colors"
        >
          再試行
        </button>
        {isRoot ? (
          <a
            href="/"
            className="px-4 py-2 bg-bg-secondary border border-border text-text-primary rounded-lg font-medium hover:bg-bg-card transition-colors"
          >
            ホームに戻る
          </a>
        ) : (
          <button
            onClick={() => window.history.back()}
            className="px-4 py-2 bg-bg-secondary border border-border text-text-primary rounded-lg font-medium hover:bg-bg-card transition-colors"
          >
            戻る
          </button>
        )}
      </div>
    </div>
  );
}
