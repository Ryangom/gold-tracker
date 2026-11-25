import { Observable, of, throwError } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';

/**
 * Try a list of providers in order, returning the first success.
 * Providers with `enabled === false` are skipped silently. If all fail,
 * the last error is thrown (or a synthetic "no providers enabled" error).
 *
 * Pure over the observable sequence — used by both GoldPriceService and
 * FxService, and tested directly with mock providers.
 */
export function tryProviders<T>(
  providers: { enabled: boolean; fetch: () => Observable<T> }[],
): Observable<T> {
  const active = providers.filter((p) => p.enabled);
  if (active.length === 0) {
    return throwError(() => new Error('No providers enabled'));
  }

  // Fold: head with try, tail with catch -> next.
  const run = (idx: number): Observable<T> => {
    const p = active[idx];
    const obs$ = p.fetch().pipe(
      catchError((err) => {
        if (idx + 1 < active.length) {
          return run(idx + 1);
        }
        return throwError(() => err);
      }),
    );
    return obs$;
  };

  return run(0);
}
