-- Migration: add assignment_name to Task_Execution and last_recurrence_generated_date to Task_Assignment
-- Run this in your MySQL database connected to the veziv-tasks service

ALTER TABLE `Task_Execution`
  ADD COLUMN `assignment_name` VARCHAR(255) NULL AFTER `location_id`;

ALTER TABLE `Task_Assignment`
  ADD COLUMN `last_recurrence_generated_date` DATE NULL AFTER `updated_at`;

-- Note:
-- If you use a migrations system, convert these statements into a proper migration file.
-- Backup your DB before running schema changes.

