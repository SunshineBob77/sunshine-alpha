-- Analyze-drop failure tracking v1
-- Run in Supabase SQL editor. Saved here for reference/history, not applied automatically.
--
-- Design notes:
-- - Distinguishes "analyze-drop legitimately decided there's nothing to
--   surface" (e.g. RESEARCH: null because the model judged the note isn't
--   a research request) from "analyze-drop never completed at all"
--   (Anthropic API error/timeout, or any other thrown exception before the
--   captures UPDATE landed). Previously both looked identical from the
--   client's perspective - a Drop with no title/research/formatting
--   either way, no record of which one happened.
-- - 'pending': the default, set at insert time. Flipped to 'complete' or
--   'failed' by the end of every real analyze-drop pass (the success path
--   and the outer catch in route.ts both set it explicitly). A row stuck
--   on 'pending' well past when analysis should have finished means the
--   client's fire-and-forget fetch() that should have triggered
--   analyze-drop never landed at all (app closed / network dropped before
--   saveCapture's analyzeDrop() call completed) - DashboardContext
--   retries these on next load (see retriedStuckAnalysisRef.current).
-- - analysis_attempts only increments on failure (see route.ts's catch
--   block) - used to cap automatic retries (DashboardContext's
--   MAX_AUTO_RETRY_ATTEMPTS) so a persistently broken call (e.g. a
--   revoked API key) doesn't retry forever on every app load. The manual
--   "Retry" affordance on a failed Drop bypasses this cap deliberately -
--   an explicit user tap should always be honored regardless of how many
--   automatic attempts already failed.
-- - Sunshine Drop cards (source='system') are marked 'complete'
--   immediately by their own skip branch in route.ts - they never run
--   real analysis, so 'pending'/'failed' never meaningfully apply to them.
-- - temporalPreviewOnly requests (the edit-time "update date from text?"
--   check) never touch this column at all - they're a different,
--   lightweight call, not the main analysis pass.
-- - Existing rows are backfilled to 'complete' immediately after adding
--   the column: they were written before this column existed, so
--   whatever they ended up with is already that Drop's finished state
--   (or a legitimate historical failure this migration has no way to
--   distinguish retroactively) - not something to blindly queue for
--   automatic retry the next time anyone opens the app.

alter table captures
  add column analysis_status text not null default 'pending'
    check (analysis_status in ('pending', 'complete', 'failed')),
  add column analysis_attempts integer not null default 0;

update captures set analysis_status = 'complete' where analysis_status = 'pending';
