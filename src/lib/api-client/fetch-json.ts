import { retryWithBackoff } from "@/lib/retry";
import type { ApiErrorResponse } from "@/types/api-contracts";

export class ApiError extends Error {
  readonly status: number;
  readonly payload: unknown;

  constructor(message: string, status: number, payload: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.payload = payload;
  }
}

function isApiErrorPayload(payload: unknown): payload is ApiErrorResponse {
  return Boolean(payload && typeof payload === "object" && "message" in payload && typeof (payload as { message?: unknown }).message === "string");
}

async function readResponsePayload(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    return response.json().catch(() => null);
  }

  // Fall back to text for HTML/error bodies.
  return response.text().catch(() => null);
}

function buildErrorMessage(status: number, payload: unknown) {
  if (isApiErrorPayload(payload) && payload.message.trim()) {
    return payload.message;
  }

  return `Request failed (${status})`;
}

type FetchJsonOptions = RequestInit & {
  retries?: number;
};

export async function fetchJson<T>(input: RequestInfo | URL, init: FetchJsonOptions = {}): Promise<T> {
  const method = (init.method ?? "GET").toUpperCase();
  const retryable = method === "GET" || method === "HEAD";
  const retries = init.retries ?? 3;

  const makeRequest = async () => {
    const response = await fetch(input, {
      credentials: "same-origin",
      ...init,
      headers: {
        accept: "application/json",
        ...init.headers,
      },
    });

    const payload = await readResponsePayload(response);

    if (!response.ok) {
      // Treat transient gateway errors as retryable for safe methods.
      if (retryable && (response.status === 502 || response.status === 503 || response.status === 504)) {
        throw new Error(buildErrorMessage(response.status, payload));
      }

      throw new ApiError(buildErrorMessage(response.status, payload), response.status, payload);
    }

    return payload as T;
  };

  if (!retryable) {
    return makeRequest();
  }

  return retryWithBackoff(makeRequest, { retries });
}

