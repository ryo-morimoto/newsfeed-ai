/**
 * Context Extractor for Feedback
 *
 * Automatically extracts relevant context (recent feeds, error logs)
 * to enhance feedback submissions with debugging information.
 */

import { getRecentArticles, type Article } from "./db";

// === Error Log Buffer ===

interface ErrorLogEntry {
  timestamp: Date;
  level: "error" | "warn";
  message: string;
  stack?: string;
  source?: string;
}

// In-memory ring buffer for error logs
const ERROR_LOG_BUFFER_SIZE = 50;
const errorLogBuffer: ErrorLogEntry[] = [];

/**
 * Add an error to the log buffer
 */
export function logError(
  message: string,
  options?: { stack?: string; source?: string }
): void {
  const entry: ErrorLogEntry = {
    timestamp: new Date(),
    level: "error",
    message,
    stack: options?.stack,
    source: options?.source,
  };

  errorLogBuffer.push(entry);

  // Keep buffer within size limit
  if (errorLogBuffer.length > ERROR_LOG_BUFFER_SIZE) {
    errorLogBuffer.shift();
  }

  // Also log to console for real-time visibility
  console.error(`[${options?.source || "error"}] ${message}`);
  if (options?.stack) {
    console.error(options.stack);
  }
}

/**
 * Add a warning to the log buffer
 */
export function logWarn(
  message: string,
  options?: { source?: string }
): void {
  const entry: ErrorLogEntry = {
    timestamp: new Date(),
    level: "warn",
    message,
    source: options?.source,
  };

  errorLogBuffer.push(entry);

  if (errorLogBuffer.length > ERROR_LOG_BUFFER_SIZE) {
    errorLogBuffer.shift();
  }

  console.warn(`[${options?.source || "warn"}] ${message}`);
}

/**
 * Get recent error logs from the buffer
 */
export function getRecentErrors(minutes: number = 60): ErrorLogEntry[] {
  const cutoff = new Date(Date.now() - minutes * 60 * 1000);
  return errorLogBuffer.filter((entry) => entry.timestamp >= cutoff);
}

/**
 * Clear the error log buffer
 */
export function clearErrorLog(): void {
  errorLogBuffer.length = 0;
}

// === Context Extraction ===

export interface FeedbackContext {
  recentArticles: {
    title: string;
    url: string;
    source: string;
    category: string;
    summary?: string;
    score?: number;
    created_at?: string;
  }[];
  recentErrors: {
    timestamp: string;
    level: string;
    message: string;
    source?: string;
  }[];
  systemInfo: {
    uptime: number;
    memoryUsage: number;
    nodeVersion: string;
  };
}

/**
 * Extract context for feedback submission
 *
 * @param options.feedHours - How many hours of feeds to include (default: 24)
 * @param options.feedLimit - Max number of feeds to include (default: 10)
 * @param options.errorMinutes - How many minutes of error logs to include (default: 60)
 */
export async function extractFeedbackContext(options?: {
  feedHours?: number;
  feedLimit?: number;
  errorMinutes?: number;
}): Promise<FeedbackContext> {
  const feedHours = options?.feedHours ?? 24;
  const feedLimit = options?.feedLimit ?? 10;
  const errorMinutes = options?.errorMinutes ?? 60;

  // Get recent articles from database
  let recentArticles: Article[] = [];
  try {
    recentArticles = await getRecentArticles(feedHours);
  } catch (error) {
    logError(`Failed to fetch recent articles: ${error}`, {
      source: "context-extractor",
    });
  }

  // Get recent errors from buffer
  const recentErrors = getRecentErrors(errorMinutes);

  // Get system info
  const memUsage = process.memoryUsage();

  return {
    recentArticles: recentArticles.slice(0, feedLimit).map((article) => ({
      title: article.title,
      url: article.url,
      source: article.source,
      category: article.category,
      summary: article.summary,
      score: article.score,
      created_at: article.created_at,
    })),
    recentErrors: recentErrors.map((entry) => ({
      timestamp: entry.timestamp.toISOString(),
      level: entry.level,
      message: entry.message,
      source: entry.source,
    })),
    systemInfo: {
      uptime: Math.floor(process.uptime()),
      memoryUsage: Math.round(memUsage.heapUsed / 1024 / 1024),
      nodeVersion: process.version,
    },
  };
}

/**
 * Format context as a markdown string for inclusion in feedback
 */
export function formatContextForFeedback(context: FeedbackContext): string {
  const parts: string[] = [];

  // Recent Articles
  if (context.recentArticles.length > 0) {
    parts.push("## Recent Articles (last 24h)");
    parts.push("");
    for (const article of context.recentArticles) {
      const score = article.score ? ` (score: ${article.score.toFixed(1)})` : "";
      parts.push(`- [${article.category}] ${article.title}${score}`);
      parts.push(`  Source: ${article.source}`);
      if (article.summary) {
        parts.push(`  Summary: ${article.summary.slice(0, 100)}...`);
      }
    }
    parts.push("");
  }

  // Recent Errors
  if (context.recentErrors.length > 0) {
    parts.push("## Recent Errors");
    parts.push("");
    for (const error of context.recentErrors) {
      const time = new Date(error.timestamp).toLocaleTimeString("ja-JP");
      const source = error.source ? `[${error.source}]` : "";
      parts.push(`- ${time} ${source} (${error.level}) ${error.message}`);
    }
    parts.push("");
  }

  // System Info
  parts.push("## System Info");
  parts.push("");
  parts.push(`- Uptime: ${Math.floor(context.systemInfo.uptime / 60)}m`);
  parts.push(`- Memory: ${context.systemInfo.memoryUsage}MB`);
  parts.push(`- Runtime: Bun ${context.systemInfo.nodeVersion}`);

  return parts.join("\n");
}

/**
 * Extract and format context in one call
 */
export async function getFormattedFeedbackContext(options?: {
  feedHours?: number;
  feedLimit?: number;
  errorMinutes?: number;
}): Promise<string> {
  const context = await extractFeedbackContext(options);
  return formatContextForFeedback(context);
}
