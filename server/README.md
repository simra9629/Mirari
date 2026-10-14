# Mirari server (optional)

Mirari works as a plain static site. This tiny server adds two optional things:

- **Progress sync** — back up / restore every experience's save with a 12-character code. No accounts.
- **Visit counts** — how often each world has been opened.

It also serves `dist/` with SPA fallback, so `npm start` (build + serve) is a complete deployment.

```
npm run server        # API (+ dist/ if built), http://localhost:8787
npm start             # build, then serve everything
npm run dev           # Vite dev server; /api is proxied to :8787
PORT=3000 DATA_DIR=/var/lib/mirari npm run server
```

No dependencies. Storage is one JSON file (`server/data/store.json`, git-ignored).

## API

| | |
|---|---|
| `GET /api/health` | `{ ok: true }` — the site uses this to decide whether to show sync |
| `POST /api/sync` | `{ saves? }` → `201 { code, saves, updated }` |
| `GET /api/sync/:code` | `{ saves, updated }` |
| `PUT` (or `POST`) `/api/sync/:code` | `{ saves: { [key]: { v, t } } }` → merged, newest `t` wins per key |
| `DELETE /api/sync/:code` | forget a code |
| `POST /api/visit` | `{ id }` |
| `GET /api/stats` | `{ total, visits }` |

Limits: 1 MB per request, 800 KB and 200 keys per code, keys must look like `mirari:…`, per-IP rate limiting.
The sync code is the only credential — anyone with it can read and overwrite that save set. Treat it like a password.
