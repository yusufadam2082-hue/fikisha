const STORE_SECURITY_LOG_KEY = 'admin_store_security_logs';

const safeParse = (value, fallback) => {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

export function readStoreSecurityEvents() {
  const raw = localStorage.getItem(STORE_SECURITY_LOG_KEY);
  const parsed = raw ? safeParse(raw, []) : [];
  return Array.isArray(parsed) ? parsed : [];
}

export function appendStoreSecurityEvent(event) {
  const current = readStoreSecurityEvents();
  current.push({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
    ...event
  });

  localStorage.setItem(STORE_SECURITY_LOG_KEY, JSON.stringify(current));
}

export function getStoreSecurityEvents(storeId) {
  return readStoreSecurityEvents()
    .filter((entry) => !storeId || entry.storeId === storeId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}
