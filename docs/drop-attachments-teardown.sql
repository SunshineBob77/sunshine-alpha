-- Tears down the superseded drop_attachments table (see the note atop
-- docs/drop-attachments-schema.sql). Run in Supabase SQL editor. Saved
-- here for reference/history, not applied automatically.
--
-- DROP TABLE cascades to its own policies/indexes/grants automatically -
-- nothing else to clean up separately.
drop table if exists drop_attachments;
