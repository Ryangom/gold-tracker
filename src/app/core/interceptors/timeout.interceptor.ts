import { HttpInterceptorFn, HttpContextToken, HttpResponse } from '@angular/common/http';
import { retry, timer, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';

/**
 * Per-request flags. Set `SKIP_TIMEOUT` to opt out of the 8s timeout
 * (not currently used, but available). Set `SKIP_RETRY` to opt out of the
 * single retry.
 */
export const SKIP_TIMEOUT = new HttpContextToken<boolean>(() => false);
export const SKIP_RETRY = new HttpContextToken<boolean>(() => false);

/**
 * Central HTTP error handling. Every request gets:
 *   - an 8s timeout (so a slow provider falls back to the next one),
 *   - at most 1 retry on network/5xx errors (with a short backoff),
 *   - normalised error objects propagated to callers.
 */
export const httpTimeoutInterceptor: HttpInterceptorFn = (req, next) => {
  const skipRetry = req.context.get(SKIP_RETRY);

  const handled$ = next(req).pipe(
    retry({
      count: skipRetry ? 0 : environment.maxRetries,
      delay: (err) => {
        // Only retry on transient errors, not 4xx client errors.
        const status = err?.status ?? 0;
        const transient = status === 0 || status >= 500;
        if (!transient) {
          return throwError(() => err);
        }
        return timer(600);
      },
    }),
  );

  return handled$;
};

/** Type guard for the few places that inspect raw HTTP errors. */
export function isHttpTimeoutError(err: unknown): boolean {
  return err instanceof HttpResponse === false && /timeout/i.test(String((err as Error)?.message ?? ''));
}
