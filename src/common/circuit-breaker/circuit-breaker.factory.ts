import { Logger } from '@nestjs/common';
// eslint-disable-next-line @typescript-eslint/no-require-imports
import CircuitBreaker = require('opossum');

export interface CircuitBreakerOptions {
  /** Human-readable name used in log messages */
  name: string;
  /** Milliseconds before a call is considered timed out */
  timeoutMs: number;
}

/**
 * Creates a per-client opossum circuit breaker.
 *
 * One breaker instance per downstream client is mandatory (AGENT_SPEC §4, step 3).
 * Sharing a single breaker across clients would cause one failing source to trip
 * the breaker for both, violating the partial-availability requirement.
 */
export function createCircuitBreaker<TArgs extends unknown[], TReturn>(
  action: (...args: TArgs) => Promise<TReturn>,
  options: CircuitBreakerOptions,
): CircuitBreaker<TArgs, TReturn> {
  const logger = new Logger(`CircuitBreaker:${options.name}`);

  const breaker = new CircuitBreaker(action, {
    timeout: options.timeoutMs,
    errorThresholdPercentage: 50,
    resetTimeout: 10_000, // half-open after 10 s
    volumeThreshold: 5,   // minimum calls before breaker can trip
  });

  breaker.on('open', () =>
    logger.warn(`Circuit breaker OPEN — ${options.name} is unavailable`),
  );
  breaker.on('halfOpen', () =>
    logger.log(`Circuit breaker HALF-OPEN — probing ${options.name}`),
  );
  breaker.on('close', () =>
    logger.log(`Circuit breaker CLOSED — ${options.name} recovered`),
  );
  breaker.on('fallback', () =>
    logger.warn(`Circuit breaker FALLBACK triggered for ${options.name}`),
  );

  return breaker;
}
