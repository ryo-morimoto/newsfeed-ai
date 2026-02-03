import { test, expect, describe } from "bun:test";
import { withRetry, RateLimitError } from "./retry";

describe("withRetry", () => {
  test("returns result on success", async () => {
    const fn = async () => "success";

    const result = await withRetry(fn);

    expect(result).toBe("success");
  });

  test("retries on failure and succeeds", async () => {
    let attempts = 0;
    const fn = async () => {
      attempts++;
      if (attempts < 3) {
        throw new Error("Temporary failure");
      }
      return "success after retries";
    };

    const result = await withRetry(fn, {
      maxRetries: 3,
      initialDelayMs: 10, // Short delay for testing
    });

    expect(result).toBe("success after retries");
    expect(attempts).toBe(3);
  });

  test("throws after max retries exhausted", async () => {
    let attempts = 0;
    const fn = async () => {
      attempts++;
      throw new Error("Always fails");
    };

    let thrownError: Error | null = null;
    try {
      await withRetry(fn, {
        maxRetries: 2,
        initialDelayMs: 10,
      });
    } catch (e) {
      thrownError = e as Error;
    }

    expect(thrownError).not.toBeNull();
    expect(thrownError!.message).toBe("Always fails");
    expect(attempts).toBe(3); // Initial + 2 retries
  });

  test("uses exponential backoff", async () => {
    const delays: number[] = [];
    let attempts = 0;
    const fn = async () => {
      attempts++;
      if (attempts <= 3) {
        throw new Error("Fail");
      }
      return "done";
    };

    await withRetry(fn, {
      maxRetries: 3,
      initialDelayMs: 100,
      maxDelayMs: 1000,
      onRetry: (_attempt, _error, delayMs) => {
        delays.push(delayMs);
      },
    });

    // Delays should be: 100, 200, 400 (exponential)
    expect(delays[0]).toBe(100);
    expect(delays[1]).toBe(200);
    expect(delays[2]).toBe(400);
  });

  test("respects maxDelayMs", async () => {
    const delays: number[] = [];
    let attempts = 0;
    const fn = async () => {
      attempts++;
      if (attempts <= 4) {
        throw new Error("Fail");
      }
      return "done";
    };

    await withRetry(fn, {
      maxRetries: 4,
      initialDelayMs: 100,
      maxDelayMs: 250, // Cap at 250ms
      onRetry: (_attempt, _error, delayMs) => {
        delays.push(delayMs);
      },
    });

    // Delays should be: 100, 200, 250 (capped), 250 (capped)
    expect(delays[0]).toBe(100);
    expect(delays[1]).toBe(200);
    expect(delays[2]).toBe(250); // Capped
    expect(delays[3]).toBe(250); // Capped
  });

  test("uses RateLimitError retryAfterMs for delay", async () => {
    const delays: number[] = [];
    let attempts = 0;
    const fn = async () => {
      attempts++;
      if (attempts === 1) {
        throw new RateLimitError(500); // 500ms retry-after
      }
      return "done";
    };

    await withRetry(fn, {
      maxRetries: 2,
      initialDelayMs: 100,
      maxDelayMs: 1000,
      onRetry: (_attempt, _error, delayMs) => {
        delays.push(delayMs);
      },
    });

    expect(delays[0]).toBe(500); // Uses RateLimitError's retryAfterMs
  });

  test("caps RateLimitError retryAfterMs to maxDelayMs", async () => {
    const delays: number[] = [];
    let attempts = 0;
    const fn = async () => {
      attempts++;
      if (attempts === 1) {
        throw new RateLimitError(60000); // 60s retry-after
      }
      return "done";
    };

    await withRetry(fn, {
      maxRetries: 2,
      initialDelayMs: 100,
      maxDelayMs: 1000, // Cap at 1s
      onRetry: (_attempt, _error, delayMs) => {
        delays.push(delayMs);
      },
    });

    expect(delays[0]).toBe(1000); // Capped to maxDelayMs
  });

  test("calls onRetry callback with correct arguments", async () => {
    const callbacks: { attempt: number; error: Error; delayMs: number }[] = [];
    let attempts = 0;
    const fn = async () => {
      attempts++;
      if (attempts < 3) {
        throw new Error(`Failure ${attempts}`);
      }
      return "done";
    };

    await withRetry(fn, {
      maxRetries: 3,
      initialDelayMs: 50,
      onRetry: (attempt, error, delayMs) => {
        callbacks.push({ attempt, error, delayMs });
      },
    });

    expect(callbacks.length).toBe(2);
    expect(callbacks[0].attempt).toBe(1);
    expect(callbacks[0].error.message).toBe("Failure 1");
    expect(callbacks[1].attempt).toBe(2);
    expect(callbacks[1].error.message).toBe("Failure 2");
  });
});

describe("RateLimitError", () => {
  test("has correct name and message", () => {
    const error = new RateLimitError(30000);

    expect(error.name).toBe("RateLimitError");
    expect(error.message).toBe("Rate limited. Retry after 30000ms");
    expect(error.retryAfterMs).toBe(30000);
  });

  test("is instanceof Error", () => {
    const error = new RateLimitError(1000);

    expect(error instanceof Error).toBe(true);
    expect(error instanceof RateLimitError).toBe(true);
  });
});
