import { describe, it, expect } from 'vitest';
import { of, throwError, firstValueFrom } from 'rxjs';
import { tryProviders } from './provider-fallback.util';

describe('provider fallback', () => {
  it('uses the first enabled provider', async () => {
    const providers = [
      { enabled: true, fetch: () => of('primary') },
      { enabled: true, fetch: () => of('fallback') },
    ];
    const result = await firstValueFrom(tryProviders(providers));
    expect(result).toBe('primary');
  });

  it('falls back to the next provider on error', async () => {
    const providers = [
      { enabled: true, fetch: () => throwError(() => new Error('boom')) },
      { enabled: true, fetch: () => of('fallback') },
    ];
    const result = await firstValueFrom(tryProviders(providers));
    expect(result).toBe('fallback');
  });

  it('skips disabled providers silently', async () => {
    const providers = [
      { enabled: false, fetch: () => of('disabled-should-skip') },
      { enabled: true, fetch: () => of('used') },
    ];
    const result = await firstValueFrom(tryProviders(providers));
    expect(result).toBe('used');
  });

  it('throws when all providers fail', async () => {
    const providers = [
      { enabled: true, fetch: () => throwError(() => new Error('a')) },
      { enabled: true, fetch: () => throwError(() => new Error('b')) },
    ];
    await expect(firstValueFrom(tryProviders(providers))).rejects.toThrow('b');
  });

  it('throws a synthetic error when no providers are enabled', async () => {
    const providers = [
      { enabled: false, fetch: () => of('x') },
    ];
    await expect(firstValueFrom(tryProviders(providers))).rejects.toThrow('No providers enabled');
  });

  it('falls back across more than two providers', async () => {
    const providers = [
      { enabled: true, fetch: () => throwError(() => new Error('1')) },
      { enabled: true, fetch: () => throwError(() => new Error('2')) },
      { enabled: true, fetch: () => of('third') },
    ];
    const result = await firstValueFrom(tryProviders(providers));
    expect(result).toBe('third');
  });
});
