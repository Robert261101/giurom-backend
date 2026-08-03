-- Fix puncte bonus pe server2 (giurombitap_tasks) – rulează manual din terminal
-- Exemplu: mysql giurombitap_tasks < fix-duplicate-daily-points-server2.sql

USE giurombitap_tasks;

-- Verificare duplicate (opțional)
-- SELECT employee_id, location_id, DATE(work_date) AS wd, COUNT(*) AS cnt
-- FROM Employee_Daily_Points GROUP BY employee_id, location_id, DATE(work_date) HAVING cnt > 1;

-- 1) Șterge orphan-uri fără task-uri când există alt rând cu task-uri în aceeași zi
DELETE edp_orphan
FROM Employee_Daily_Points edp_orphan
INNER JOIN Employee_Daily_Points edp_main
  ON edp_main.employee_id = edp_orphan.employee_id
 AND edp_main.location_id = edp_orphan.location_id
 AND DATE(edp_main.work_date) = DATE(edp_orphan.work_date)
 AND edp_main.id <> edp_orphan.id
WHERE NOT EXISTS (
  SELECT 1 FROM Employee_Daily_Task_Points edtp
  WHERE edtp.employee_daily_points_id = edp_orphan.id
)
AND EXISTS (
  SELECT 1 FROM Employee_Daily_Task_Points edtp2
  WHERE edtp2.employee_daily_points_id = edp_main.id
);

-- 2) Fix explicit Serban Ioan Robert – 02.08.2026 (employee_id=30, id duplicat 1257)
DELETE FROM Employee_Daily_Task_Points WHERE employee_daily_points_id = 1257;
DELETE FROM Employee_Daily_Points WHERE id = 1257;

-- 3) Verificare după fix
SELECT edp.id, edp.employee_id, edp.work_date, edp.location_id, edp.total_points,
       COUNT(edtp.id) AS nr_task_uri
FROM Employee_Daily_Points edp
LEFT JOIN Employee_Daily_Task_Points edtp ON edtp.employee_daily_points_id = edp.id
WHERE edp.employee_id = 30 AND DATE(edp.work_date) = '2026-08-02'
GROUP BY edp.id;
