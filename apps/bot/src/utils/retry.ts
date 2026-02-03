/**
 * Retry utility with exponential backoff
 * Handles rate limits (429) with Retry-After header support
 */

export interface RetryOptions {
  maxRetries?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  onRetry?: (attempt: number, error: Error, delayMs: number) => void;
}

export interface RetryableResponse {
  ok: boolean;
  status: number;
  headers: { get(name: string): string | null };
}

export class RateLimitError extends Error {
  retryAfterMs: number;

  constructor(retryAfterMs: number) {
    super(`Rate limited. Retry after ${retryAfterMs}ms`);
    this.name = "RateLimitError";
    this.retryAfterMs = retryAfterMs;
  }
}

/**
 * Execute a function with exponential backoff retry
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelayMs = 10_000,
    maxDelayMs = 60_000,
    onRetry,
  } = options;

  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt >= maxRetries) {
        break;
      }

      let delayMs: number;

      if (error instanceof RateLimitError) {
        // Use Retry-After value if available
        delayMs = Math.min(error.retryAfterMs, maxDelayMs);
      } else {
        // Exponential backoff: initialDelay * 2^attempt
        delayMs = Math.min(initialDelayMs * Math.pow(2, attempt), maxDelayMs);
      }

      onRetry?.(attempt + 1, lastError, delayMs);

      await sleep(delayMs);
    }
  }

  throw lastError;
}

/**
 * Check response for rate limit and throw RateLimitError if needed
 */
export function checkRateLimit(response: RetryableResponse): void {
  if (response.status === 429) {
    const retryAfter = response.headers.get("Retry-After");
    const retryAfterMs = retryAfter
      ? parseInt(retryAfter, 10) * 1000
      : 30_000; // Default 30s if no header
    throw new RateLimitError(retryAfterMs);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
