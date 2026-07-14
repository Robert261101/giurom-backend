-- Coloane adăugate în entități TypeORM dar niciodată migrate în producție (synchronize: false).
-- Cauzează 500 (ER_BAD_FIELD_ERROR) la GET /tasks/executions/employee-points/:id și GET /tasks/templates.

ALTER TABLE `Task_Execution`
  ADD COLUMN `is_reactivation_compensation` TINYINT(1) NOT NULL DEFAULT 0;

ALTER TABLE `Task_Elements`
  ADD COLUMN `permite_realocare` TINYINT(1) NULL DEFAULT NULL;

ALTER TABLE `Task_Assignment`
  ADD COLUMN `permite_realocare` TINYINT(1) NOT NULL DEFAULT 1;
