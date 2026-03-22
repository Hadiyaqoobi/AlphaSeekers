export type RetryOptions = {
  retries?: number;
  initialDelayMs?: number;
  multiplier?: number;
};

export class NonRetryableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NonRetryableError";
  }
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  retries: 3,
  initialDelayMs: 1000,
  multiplier: 2,
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const settings = { ...DEFAULT_OPTIONS, ...options };
  let delay = settings.initialDelayMs;
  let lastError: unknown;

  for (let attempt = 0; attempt < settings.retries; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof NonRetryableError) {
        throw error;
      }

      lastError = error;

      if (attempt === settings.retries - 1) {
        break;
      }

      await sleep(delay);
      delay *= settings.multiplier;
    }
  }

  throw lastError;
}
