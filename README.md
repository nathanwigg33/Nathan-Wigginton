# Chapter & Verse

A daily Bible verse game. Every day: five verses (1–3 easy, 4 medium, 5 hard). Find each one on the bookshelf (testament, book, chapter, verse) and score up to 1000. Two optional hints per verse (−10 book clue, −20 context clue).

## Layout
- `public/`: the static site (`index.html`, `data.js` with verse pools, KJV fallback text, and hints)
- `worker.js`: Cloudflare Worker. Serves `public/` and `GET /api/day?d=N`, which returns that day's verses in NKJV from API.Bible (cached).
- `pools.json`: verse references per difficulty tier (used by the Worker; must match `public/data.js`)
- `wrangler.jsonc`: Worker config

## Secrets
Set `API_BIBLE_KEY` (Worker → Settings → Variables and secrets, type Secret). Without it the game falls back to KJV.

NKJV text via API.Bible (non-commercial Starter plan). Scripture taken from the New King James Version®. Copyright © 1982 by Thomas Nelson. Used by permission. All rights reserved.
