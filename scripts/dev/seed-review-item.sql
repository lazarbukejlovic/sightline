-- ============================================================================
-- DEV / TEST ONLY — seed one low-confidence change into the Review Queue.
--
-- NOT a migration. Never run automatically. Run by hand in the Supabase SQL
-- editor (or psql) to verify /app/review receives and clears an item.
--
-- Safety:
--   * Derives org_id / competitor_id / source_id from a REAL existing source,
--     so the FKs are always consistent. It does not modify any scan data.
--   * Uses a fixed sentinel id so it is trivial and unambiguous to delete.
--   * Idempotent: re-running inserts at most one row (ON CONFLICT DO NOTHING).
--   * confidence = 0.42 (< 0.6) and status = 'new' → shows ONLY in the Review
--     Queue, never in the main Intel Feed.
-- ============================================================================

-- ── INSERT ──────────────────────────────────────────────────────────────────
insert into public.changes (
  id,
  org_id, competitor_id, source_id,
  summary, why_it_matters,
  category, impact, confidence, status, detected_at
)
select
  'dddddddd-dddd-dddd-dddd-dddddddddddd'::uuid,   -- sentinel id (for cleanup)
  s.org_id, s.competitor_id, s.id,
  '[DEV TEST] Low-confidence seeded change for Review Queue verification',
  'Seeded to confirm the Review Queue receives and clears a low-confidence item. Safe to delete.',
  'pricing',     -- category  (ChangeCategory: pricing|product|positioning|hiring|funding|other)
  'medium',      -- impact    (ImpactLevel: low|medium|high)
  0.42,          -- confidence (< 0.6 → routes to Review Queue)
  'new',         -- status    (ChangeStatus: new|reviewed|dismissed|promoted)
  now()
from public.sources s
-- Picks the most recent source in any org. To target a specific competitor,
-- add e.g.:  where s.competitor_id = '<competitor-uuid>'
order by s.created_at desc
limit 1
on conflict (id) do nothing;

-- ── VERIFY (optional) ───────────────────────────────────────────────────────
-- Should return exactly one row after the insert above.
-- select id, org_id, competitor_id, source_id, confidence, status
-- from public.changes
-- where id = 'dddddddd-dddd-dddd-dddd-dddddddddddd'::uuid;

-- ── CLEANUP (run after testing) ─────────────────────────────────────────────
-- Removes ONLY the seeded row, regardless of whether you marked it
-- reviewed / dismissed during the test.
-- delete from public.changes
-- where id = 'dddddddd-dddd-dddd-dddd-dddddddddddd'::uuid;
-- ============================================================================
