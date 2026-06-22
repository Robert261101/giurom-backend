-- =============================================================================
-- Rollback migrare 002_calendar_v1_schema.sql
-- Ordine: participanți → evenimente → categorii
--
-- NU RULA decât dacă 002 a fost aplicată și se dorește revenirea completă.
-- =============================================================================

DROP TABLE IF EXISTS calendar_event_participant;
DROP TABLE IF EXISTS calendar_event;
DROP TABLE IF EXISTS event_category;
