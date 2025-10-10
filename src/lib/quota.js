const globalStore = (globalThis.__quotaStore = globalThis.__quotaStore || {
  windowStartMs: Date.now(),
  usageByService: {},
});

function getWindowResetIfNeeded() {
  const ONE_HOUR_MS = 60 * 60 * 1000;
  const now = Date.now();
  if (now - globalStore.windowStartMs >= ONE_HOUR_MS) {
    globalStore.windowStartMs = now;
    globalStore.usageByService = {};
  }
}

export function recordUsage(serviceName, count = 1) {
  getWindowResetIfNeeded();
  const current = globalStore.usageByService[serviceName] || 0;
  globalStore.usageByService[serviceName] = current + count;
}

export function getUsage(serviceName) {
  getWindowResetIfNeeded();
  return globalStore.usageByService[serviceName] || 0;
}

export function getRemaining(serviceName, quotaEnvVar) {
  const used = getUsage(serviceName);
  const quotaStr = process.env[quotaEnvVar];
  const quota = quotaStr ? parseInt(quotaStr, 10) : null;
  if (!quota || Number.isNaN(quota)) return null;
  return Math.max(0, quota - used);
}
