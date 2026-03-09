-- 1) Șterge înregistrările fără locație (înainte de a face coloana NOT NULL)
DELETE FROM Employee_Daily_Points WHERE location_id IS NULL;

-- 2) Face location_id obligatoriu
ALTER TABLE Employee_Daily_Points MODIFY COLUMN location_id INT NOT NULL;
