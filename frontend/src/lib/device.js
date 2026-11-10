// Stable per-browser device id, sent as X-Device-Id so the server can rate-limit
// and spot independent reports. Not personal data: a random UUID.
const KEY = 'resq_device_id';
let memoryId = null;

function uuid() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  // RFC 4122 v4 fallback for older browsers
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export function getDeviceId() {
  try {
    let id = localStorage.getItem(KEY);
    if (!id) {
      id = uuid();
      localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    if (!memoryId) memoryId = uuid();
    return memoryId;
  }
}
