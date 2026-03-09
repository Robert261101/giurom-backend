-- Șterge duplicatele din presence: păstrează o singură înregistrare per (shift_id, date), cea cu id minim.
-- Rulează acest script o singură dată pe baza de date (ex: mysql -u user -p database < 000_cleanup_presence_duplicates.sql).

DELETE p FROM presence p
INNER JOIN (
  SELECT shift_id, date, MIN(id) AS keep_id
  FROM presence
  GROUP BY shift_id, date
  HAVING COUNT(*) > 1
) dup ON p.shift_id = dup.shift_id AND p.date = dup.date AND p.id <> dup.keep_id;
