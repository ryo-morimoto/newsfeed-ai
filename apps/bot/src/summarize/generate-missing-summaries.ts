/**
 * 遅延生成ジョブ
 * 詳細要旨が未生成の記事を処理する
 */

import { getArticlesWithoutDetailedSummary, updateArticleDetailedSummary } from "../db";
import { generateDetailedSummary } from "./detailed-summary";
import { withRetry, RateLimitError } from "../utils/retry";

// 1回あたりの最大処理件数
const MAX_ARTICLES_PER_RUN = 5;

// レートリミット連続発生時の早期終了閾値
const MAX_CONSECUTIVE_RATE_LIMITS = 2;

export interface GenerationResult {
  processed: number;
  success: number;
  failed: number;
  rateLimited: boolean;
}

/**
 * 詳細要旨が未生成の記事を処理する
 * レートリミット発生時は早期終了して次回に持ち越す
 */
export async function generateMissingSummaries(): Promise<GenerationResult> {
  const result: GenerationResult = {
    processed: 0,
    success: 0,
    failed: 0,
    rateLimited: false,
  };

  const apiKey = process.env.GROQ_API_KEY || "";
  if (!apiKey) {
    console.log("[generate-missing-summaries] No GROQ_API_KEY, skipping");
    return result;
  }

  const articles = await getArticlesWithoutDetailedSummary(MAX_ARTICLES_PER_RUN);

  if (articles.length === 0) {
    return result;
  }

  console.log(`[generate-missing-summaries] Processing ${articles.length} articles...`);

  let consecutiveRateLimits = 0;

  for (const article of articles) {
    if (consecutiveRateLimits >= MAX_CONSECUTIVE_RATE_LIMITS) {
      console.log("[generate-missing-summaries] Rate limit hit repeatedly, stopping early");
      result.rateLimited = true;
      break;
    }

    result.processed++;

    try {
      const detailed = await withRetry(
        async () => {
          return generateDetailedSummary(
            {
              title: article.title,
              url: article.url,
              source: article.source,
              category: article.category,
              summary: article.summary,
            },
            apiKey
          );
        },
        {
          maxRetries: 2,
          initialDelayMs: 15_000, // バックグラウンドジョブなので長めの待機
          maxDelayMs: 60_000,
          onRetry: (attempt, _error, delayMs) => {
            console.log(`[generate-missing-summaries] Retry ${attempt} for ${article.title.slice(0, 30)}... (waiting ${delayMs / 1000}s)`);
          },
        }
      );

      await updateArticleDetailedSummary(
        article.url,
        detailed.detailedSummary,
        detailed.keyPoints,
        detailed.targetAudience
      );

      console.log(`[generate-missing-summaries] ✓ ${article.title.slice(0, 50)}...`);
      result.success++;
      consecutiveRateLimits = 0;

      // 成功時も少し待機してレートリミットを避ける
      await sleep(3000);
    } catch (error) {
      if (error instanceof RateLimitError) {
        consecutiveRateLimits++;
        console.log(`[generate-missing-summaries] ✗ Rate limited: ${article.title.slice(0, 30)}...`);
        result.failed++;
      } else {
        console.error(`[generate-missing-summaries] ✗ Failed: ${article.url}`, error);
        result.failed++;
        consecutiveRateLimits = 0; // 非レートリミットエラーはカウントリセット
      }
    }
  }

  console.log(`[generate-missing-summaries] Done: ${result.success}/${result.processed} success, ${result.failed} failed`);

  return result;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
