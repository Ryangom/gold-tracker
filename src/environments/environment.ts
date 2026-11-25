/**
 * Environment configuration — BAJUS-only live source via Angular proxy.
 */
export const environment = {
  production: true,

  // Official BAJUS HTML page (proxied in dev via proxy.conf.json)
  bajusGoldPriceUrl: '/bajus-proxy/gold-price',

  // Policy
  cacheTtlMs: 15 * 60 * 1000, // 15 minutes
  snapshotMinIntervalMs: 30 * 60 * 1000, // 30 minutes
  snapshotRetentionDays: 90,
  requestTimeoutMs: 8_000,
  maxRetries: 1,
  manualRefreshMinIntervalMs: 60 * 1000, // 60 seconds
};
