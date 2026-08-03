-- Curățare duplicate Employee_Daily_Points + index unic (employee_id, work_date, location_id)
-- Rulează pe server nou ÎNAINTE de deploy; pe server2 folosește fix-duplicate-daily-points-server2.sql

-- 1) Șterge orphan-uri fără task-uri când există un rând cu task-uri în aceeași zi/locație
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

-- 2) Pentru duplicate rămase fără task-uri pe niciun rând: păstrează rândul cu total_points maxim
DELETE edp_dup
FROM Employee_Daily_Points edp_dup
INNER JOIN (
  SELECT employee_id, location_id, DATE(work_date) AS wd, MAX(total_points) AS max_pts
  FROM Employee_Daily_Points
  GROUP BY employee_id, location_id, DATE(work_date)
  HAVING COUNT(*) > 1
) grp
  ON grp.employee_id = edp_dup.employee_id
 AND grp.location_id = edp_dup.location_id
 AND DATE(edp_dup.work_date) = grp.wd
WHERE edp_dup.total_points < grp.max_pts
AND NOT EXISTS (
  SELECT 1 FROM Employee_Daily_Task_Points edtp
  WHERE edtp.employee_daily_points_id = edp_dup.id
);

-- 3) Index unic – previne duplicate noi
-- (ignoră eroarea dacă indexul există deja)
CREATE UNIQUE INDEX uq_employee_daily_points_emp_date_loc
  ON Employee_Daily_Points (employee_id, work_date, location_id);
