export interface RetryOptions {
  maxRetries?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffFactor?: number;
  label?: string;
  shouldRetry?: (error: unknown) => boolean;
}

/**
 * Determines whether an error is transient and safe to retry.
 * Handles Node.js / undici fetch errors, socket timeouts, rate limits,
 * and 5xx / gateway errors from Vertex AI or external services.
 */
export function isTransientError(err: unknown): boolean {
  if (!err) return false;

  // Extract nested error objects / causes if present
  const causes: unknown[] = [err];
  let current: unknown = err;
  while (current && typeof current === 'object' && 'cause' in current && (current as { cause: unknown }).cause) {
    current = (current as { cause: unknown }).cause;
    causes.push(current);
  }

  for (const item of causes) {
    if (!item || typeof item !== 'object') continue;

    const record = item as Record<string, unknown>;
    const message = typeof record.message === 'string' ? record.message : '';
    const name = typeof record.name === 'string' ? record.name : '';
    const code = typeof record.code === 'string' ? record.code : '';
    const status = typeof record.status === 'number' ? record.status : undefined;
    const statusCode = typeof record.statusCode === 'number' ? record.statusCode : undefined;

    // Check status codes
    const httpStatus = status || statusCode;
    if (httpStatus && (httpStatus === 429 || httpStatus === 500 || httpStatus === 502 || httpStatus === 503 || httpStatus === 504)) {
      return true;
    }

    // Transient Vertex / Gemini model warm-up or 400 invalid argument glitch
    if (httpStatus === 400 && /INVALID_ARGUMENT/i.test(message)) {
      return true;
    }

    // Check undici / Node specific error codes and names
    if (
      code === 'UND_ERR_HEADERS_TIMEOUT' ||
      code === 'UND_ERR_CONNECT_TIMEOUT' ||
      code === 'UND_ERR_SOCKET' ||
      code === 'UND_ERR_REQ_RETRY' ||
      code === 'ECONNRESET' ||
      code === 'ETIMEDOUT' ||
      code === 'EAI_AGAIN' ||
      code === 'ENOTFOUND' ||
      code === 'ECONNREFUSED' ||
      name === 'HeadersTimeoutError' ||
      name === 'ConnectTimeoutError' ||
      name === 'SocketError' ||
      name === 'TimeoutError' ||
      name === 'AbortError'
    ) {
      return true;
    }

    // Check error message patterns
    if (
      /fetch failed|headers timeout|connect timeout|socket hang up|econnreset|etimedout|resource exhausted|quota exceeded|service unavailable|gateway timeout|bad gateway|internal error|overloaded|deadline exceeded|503|502|504|429/i.test(
        message
      )
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Executes an async operation with exponential backoff and jitter on transient errors.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelayMs = 2000,
    maxDelayMs = 16000,
    backoffFactor = 2,
    label = 'Operation',
    shouldRetry = isTransientError,
  } = options;

  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;

      if (attempt >= maxRetries || !shouldRetry(err)) {
        throw err;
      }

      // Calculate exponential backoff with full jitter: delay * (factor^attempt) * [0.5, 1.5]
      const rawDelay = initialDelayMs * Math.pow(backoffFactor, attempt);
      const cappedDelay = Math.min(rawDelay, maxDelayMs);
      const jitterMultiplier = 0.5 + Math.random(); // 0.5 to 1.5
      const delayMs = Math.round(cappedDelay * jitterMultiplier);

      const errMessage = err instanceof Error ? err.message : String(err);
      console.warn(
        `[Retry] ${label} encountered transient error (attempt ${attempt + 1}/${maxRetries + 1}): "${errMessage}". Retrying in ${delayMs}ms...`
      );

      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw lastError;
}
