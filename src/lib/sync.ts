/**
 * Optional progress sync.
 *
 * Every experience saves to localStorage under a `mirari:` key. If the optional
 * server (server/index.mjs) is reachable, a visitor can turn on sync and get a
 * short code; saves are then backed up to the server and can be restored on
 * another device by entering the code. Without a server nothing here does
 * anything — the archive stays a plain static site.
 */

const CODE_KEY = "mirari:sync-code";
const META_KEY = "mirari:sync-meta";
const SKIP = new Set([CODE_KEY, META_KEY]);
export type Status = "unknown" | "offline" | "online";

interface Remote { saves: Record<string, { v: string; t: number }>; updated: number }
export interface SyncInfo { status: Status; code: string | null; keys: number; lastSync: number | null; busy: boolean; error: string | null }

let status: Status = "unknown";
let installed = false;
let meta: Record<string, number> = {};
let origSet: Storage["setItem"] | null = null;
let pushTimer: number | undefined;
let lastSync: number | null = null;
let busy = false;
let error: string | null = null;
let snap: SyncInfo | null = null;
const listeners = new Set<() => void>();
const emit = () => { snap = null; for (const l of listeners) l(); };

const isSaveKey = (k: string) => k.startsWith("mirari:") && !SKIP.has(k);
const rawGet = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const rawSet = (k: string, v: string) => (origSet ?? Storage.prototype.setItem).call(localStorage, k, v);

function loadMeta() { try { meta = JSON.parse(rawGet(META_KEY) ?? "{}") ?? {}; } catch { meta = {}; } }
function saveMeta() { try { rawSet(META_KEY, JSON.stringify(meta)); } catch { /* ignore */ } }

export function getCode(): string | null { return rawGet(CODE_KEY); }
function saveKeys(): string[] {
  const out: string[] = [];
  try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && isSaveKey(k)) out.push(k); } } catch { /* ignore */ }
  return out;
}

/** A stable snapshot object (so it can feed useSyncExternalStore). */
export function getInfo(): SyncInfo {
  if (!snap) snap = { status, code: getCode(), keys: saveKeys().length, lastSync, busy, error };
  return snap;
}
export function subscribeSync(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; }

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { ...init, headers: { "content-type": "application/json", ...(init?.headers ?? {}) } });
  if (!res.ok) { const b = await res.json().catch(() => ({})); throw Object.assign(new Error(b.error ?? `HTTP ${res.status}`), { status: res.status }); }
  return res.json() as Promise<T>;
}

function collect(): Record<string, { v: string; t: number }> {
  const out: Record<string, { v: string; t: number }> = {};
  for (const k of saveKeys()) { const v = rawGet(k); if (v !== null) out[k] = { v, t: meta[k] ?? 1 }; }
  return out;
}

/** Apply remote saves that are newer than ours. Returns how many keys changed. */
function apply(remote: Remote["saves"]): number {
  let n = 0;
  for (const [k, e] of Object.entries(remote)) {
    if (!isSaveKey(k)) continue;
    if (e.t > (meta[k] ?? 0)) { rawSet(k, e.v); meta[k] = e.t; n++; }
  }
  if (n) saveMeta();
  return n;
}

export async function detect(): Promise<Status> {
  try {
    const ctl = new AbortController();
    const t = window.setTimeout(() => ctl.abort(), 1800);
    const r = await fetch("/api/health", { signal: ctl.signal });
    window.clearTimeout(t);
    const j = r.ok ? await r.json().catch(() => null) : null;
    status = j?.ok && j?.name === "mirari" ? "online" : "offline";
  } catch { status = "offline"; }
  emit();
  return status;
}

export async function pushNow(): Promise<void> {
  const code = getCode();
  if (!code || status !== "online") return;
  busy = true; error = null; emit();
  try {
    const r = await api<Remote>(`/api/sync/${code}`, { method: "PUT", body: JSON.stringify({ saves: collect() }) });
    apply(r.saves); lastSync = Date.now();
  } catch (e) { error = (e as Error).message; }
  busy = false; emit();
}

function schedulePush() {
  if (!getCode() || status !== "online") return;
  window.clearTimeout(pushTimer);
  pushTimer = window.setTimeout(() => void pushNow(), 4000);
}

/** Make a new code from this device's saves. */
export async function enable(): Promise<string | null> {
  if (status !== "online") return null;
  busy = true; error = null; emit();
  try {
    const r = await api<Remote & { code: string }>("/api/sync", { method: "POST", body: JSON.stringify({ saves: collect() }) });
    rawSet(CODE_KEY, r.code); lastSync = Date.now();
    busy = false; emit();
    return r.code;
  } catch (e) { error = (e as Error).message; busy = false; emit(); return null; }
}

/** Use an existing code on this device. Returns how many saves were restored (or -1 if it failed). */
export async function join(raw: string): Promise<number> {
  const code = raw.toUpperCase().replace(/[^0-9A-Z]/g, "").replace(/O/g, "0").replace(/[IL]/g, "1");
  busy = true; error = null; emit();
  try {
    const r = await api<Remote>(`/api/sync/${code}`);
    const n = apply(r.saves);
    rawSet(CODE_KEY, code);
    await pushNow();
    lastSync = Date.now(); busy = false; emit();
    return n;
  } catch (e) {
    error = (e as { status?: number }).status === 404 ? "That code isn't known to this server." : (e as Error).message;
    busy = false; emit(); return -1;
  }
}

export async function disable(forget = false) {
  const code = getCode();
  try { localStorage.removeItem(CODE_KEY); } catch { /* ignore */ }
  if (forget && code && status === "online") { try { await api(`/api/sync/${code}`, { method: "DELETE" }); } catch { /* ignore */ } }
  lastSync = null; emit();
}

/** Call once at startup. Tracks save times, pulls newer remote saves, and counts visits. */
export function startSync() {
  if (installed || typeof window === "undefined") return;
  installed = true;
  loadMeta();
  origSet = Storage.prototype.setItem;
  const oSet = origSet, oRem = Storage.prototype.removeItem;
  Storage.prototype.setItem = function (this: Storage, k: string, v: string) {
    oSet.call(this, k, v);
    if (this === localStorage && isSaveKey(k)) { meta[k] = Date.now(); saveMeta(); schedulePush(); }
  };
  Storage.prototype.removeItem = function (this: Storage, k: string) {
    oRem.call(this, k);
    if (this === localStorage && isSaveKey(k)) { delete meta[k]; saveMeta(); }
  };
  // saves that existed before tracking began count as "old", so a fresh device never overwrites a newer remote
  for (const k of saveKeys()) if (meta[k] === undefined) meta[k] = 1;
  void detect().then(async (s) => {
    if (s !== "online") return;
    const code = getCode();
    if (!code) return;
    try {
      const r = await api<Remote>(`/api/sync/${code}`);
      const n = apply(r.saves); lastSync = Date.now();
      if (n) window.dispatchEvent(new CustomEvent("mirari:restored", { detail: n }));
      emit();
    } catch { /* ignore */ }
  });
  window.addEventListener("pagehide", () => {
    const code = getCode();
    if (code && status === "online") navigator.sendBeacon?.(`/api/sync/${code}`, new Blob([JSON.stringify({ saves: collect() })], { type: "application/json" }));
  });
}

/** Count a visit to an experience (silently does nothing without a server). */
export async function reportVisit(id: string) {
  if (status === "unknown") await detect();
  if (status !== "online") return;
  void fetch("/api/visit", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id }), keepalive: true }).catch(() => {});
}
