#!/usr/bin/env node
/**
 * Mirari's optional backend.
 *
 * The archive is, and always was, a static site: every experience saves to the
 * browser. This server adds two small, entirely optional things:
 *
 *   1. Progress sync — back up and restore a visitor's saves across devices with a
 *      short sync code (no accounts, no email). Last write wins, per save.
 *   2. Visit counts — how many times each world has been opened.
 *
 * It also serves the built site (dist/) with SPA fallback, so a single
 * `npm start` is a complete deployment. No dependencies; storage is one JSON file.
 *
 *   PORT=8787  DATA_DIR=./server/data  node server/index.mjs
 */
import { createServer } from "node:http";
import { promises as fs, existsSync, mkdirSync } from "node:fs";
import { dirname, extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";

const HERE = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT ?? 8787);
const DATA_DIR = resolve(process.env.DATA_DIR ?? join(HERE, "data"));
const DIST = resolve(process.env.DIST_DIR ?? join(HERE, "..", "dist"));
const STORE = join(DATA_DIR, "store.json");

const MAX_BODY = 1_000_000;      // bytes per request
const MAX_CODE_BYTES = 800_000;  // total stored per sync code
const MAX_KEYS = 200;
const CODE_RE = /^[0-9A-HJKMNP-TV-Z]{12}$/;   // Crockford base32, 12 chars
const KEY_RE = /^mirari:[\w:.\-]{1,80}$/;
const ID_RE = /^[a-z0-9-]{1,48}$/;

mkdirSync(DATA_DIR, { recursive: true });

/** { codes: { [code]: { updated: number, saves: { [key]: { v: string, t: number } } } }, visits: { [id]: number } } */
let db = { codes: {}, visits: {} };
try { if (existsSync(STORE)) db = { codes: {}, visits: {}, ...JSON.parse(await fs.readFile(STORE, "utf8")) }; } catch { /* start fresh */ }

let writing = false, dirty = false;
async function flush() {
  if (writing) { dirty = true; return; }
  writing = true;
  try {
    const tmp = STORE + ".tmp";
    await fs.writeFile(tmp, JSON.stringify(db));
    await fs.rename(tmp, STORE);
  } finally {
    writing = false;
    if (dirty) { dirty = false; void flush(); }
  }
}
let flushTimer = null;
const scheduleFlush = () => { clearTimeout(flushTimer); flushTimer = setTimeout(() => void flush(), 400); };

/* ---- tiny per-IP rate limiter ---- */
const hits = new Map();
function limited(ip, max = 120, windowMs = 60_000) {
  const now = Date.now();
  const h = (hits.get(ip) ?? []).filter((t) => now - t < windowMs);
  h.push(now); hits.set(ip, h);
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.length || now - v[v.length - 1] > windowMs) hits.delete(k);
  return h.length > max;
}

const newCode = () => {
  const A = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
  const b = randomBytes(12);
  let s = "";
  for (let i = 0; i < 12; i++) s += A[b[i] % 32];
  return s;
};

const json = (res, status, body, extra = {}) => {
  const s = JSON.stringify(body);
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "content-length": Buffer.byteLength(s), ...extra });
  res.end(s);
};

async function readJson(req) {
  let size = 0; const chunks = [];
  for await (const c of req) { size += c.length; if (size > MAX_BODY) throw Object.assign(new Error("too large"), { status: 413 }); chunks.push(c); }
  if (!size) return {};
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch { throw Object.assign(new Error("bad json"), { status: 400 }); }
}

function sizeOf(saves) { let n = 0; for (const [k, e] of Object.entries(saves)) n += k.length + e.v.length; return n; }

/** Merge incoming saves into a code's record; the newest timestamp wins per key. */
function merge(rec, incoming) {
  for (const [k, e] of Object.entries(incoming ?? {})) {
    if (!KEY_RE.test(k) || !e || typeof e.v !== "string" || !Number.isFinite(e.t)) continue;
    const cur = rec.saves[k];
    if (!cur || e.t > cur.t) rec.saves[k] = { v: e.v, t: Math.floor(e.t) };
  }
  if (Object.keys(rec.saves).length > MAX_KEYS || sizeOf(rec.saves) > MAX_CODE_BYTES) throw Object.assign(new Error("too much data"), { status: 413 });
  rec.updated = Date.now();
}

async function api(req, res, url, ip) {
  const path = url.pathname;
  if (path === "/api/health") return json(res, 200, { ok: true, name: "mirari", version: 1 });

  if (limited(ip)) return json(res, 429, { error: "slow down" }, { "retry-after": "30" });

  if (path === "/api/stats" && req.method === "GET") {
    const total = Object.values(db.visits).reduce((a, b) => a + b, 0);
    return json(res, 200, { total, visits: db.visits });
  }
  if (path === "/api/visit" && req.method === "POST") {
    const { id } = await readJson(req);
    if (typeof id !== "string" || !ID_RE.test(id)) return json(res, 400, { error: "bad id" });
    if (!db.visits[id] && Object.keys(db.visits).length > 500) return json(res, 400, { error: "unknown" });
    db.visits[id] = (db.visits[id] ?? 0) + 1; scheduleFlush();
    return json(res, 200, { ok: true });
  }
  if (path === "/api/sync" && req.method === "POST") {
    // create a new sync code, optionally seeded with the caller's saves
    if (limited(ip, 10, 3_600_000)) return json(res, 429, { error: "too many new codes" });
    const body = await readJson(req);
    let code; do { code = newCode(); } while (db.codes[code]);
    const rec = { updated: Date.now(), saves: {} };
    merge(rec, body.saves);
    db.codes[code] = rec; scheduleFlush();
    return json(res, 201, { code, saves: rec.saves, updated: rec.updated });
  }
  const m = /^\/api\/sync\/([^/]+)$/.exec(path);
  if (m) {
    const code = m[1].toUpperCase();
    if (!CODE_RE.test(code)) return json(res, 400, { error: "bad code" });
    const rec = db.codes[code];
    if (!rec) return json(res, 404, { error: "unknown code" });
    if (req.method === "GET") return json(res, 200, { saves: rec.saves, updated: rec.updated });
    if (req.method === "PUT" || req.method === "POST") { const body = await readJson(req); merge(rec, body.saves); scheduleFlush(); return json(res, 200, { saves: rec.saves, updated: rec.updated }); }
    if (req.method === "DELETE") { delete db.codes[code]; scheduleFlush(); return json(res, 200, { ok: true }); }
  }
  return json(res, 404, { error: "not found" });
}

const TYPES = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json",
  ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".ico": "image/x-icon", ".woff2": "font/woff2",
  ".woff": "font/woff", ".txt": "text/plain; charset=utf-8", ".webmanifest": "application/manifest+json", ".map": "application/json",
};

async function serveStatic(req, res, url) {
  if (!existsSync(DIST)) { res.writeHead(404, { "content-type": "text/plain" }); return res.end("No build found. Run `npm run build` first."); }
  let rel = decodeURIComponent(url.pathname);
  const file = normalize(join(DIST, rel));
  if (!file.startsWith(DIST)) { res.writeHead(403); return res.end(); }
  let target = file;
  try { const st = await fs.stat(target); if (st.isDirectory()) target = join(target, "index.html"); } catch { target = ""; }
  const isAsset = target && extname(target) !== "" && target !== join(DIST, "index.html");
  if (!target || !existsSync(target)) { if (extname(rel)) { res.writeHead(404); return res.end("Not found"); } target = join(DIST, "index.html"); }
  const ext = extname(target);
  const data = await fs.readFile(target);
  res.writeHead(200, {
    "content-type": TYPES[ext] ?? "application/octet-stream",
    "cache-control": isAsset && /\/assets\//.test(target) ? "public, max-age=31536000, immutable" : "no-cache",
    "x-content-type-options": "nosniff",
  });
  res.end(req.method === "HEAD" ? undefined : data);
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  const ip = (req.headers["x-forwarded-for"] ?? req.socket.remoteAddress ?? "").toString().split(",")[0].trim();
  try {
    if (url.pathname.startsWith("/api/")) {
      if (req.method === "OPTIONS") { res.writeHead(204, { "access-control-allow-origin": "*", "access-control-allow-methods": "GET,POST,PUT,DELETE", "access-control-allow-headers": "content-type" }); return res.end(); }
      res.setHeader("access-control-allow-origin", "*");
      return await api(req, res, url, ip);
    }
    if (req.method !== "GET" && req.method !== "HEAD") { res.writeHead(405); return res.end(); }
    return await serveStatic(req, res, url);
  } catch (e) {
    const status = e?.status ?? 500;
    if (!res.headersSent) json(res, status, { error: status === 500 ? "server error" : e.message });
    if (status === 500) console.error(e);
  }
});

server.listen(PORT, () => console.log(`Mirari listening on http://localhost:${PORT}  (data: ${DATA_DIR})`));
const bye = async () => { clearTimeout(flushTimer); await flush(); process.exit(0); };
process.on("SIGINT", bye); process.on("SIGTERM", bye);
