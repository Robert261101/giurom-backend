-- Previne prezențe duplicate pentru același shift în aceeași zi.
-- Rulează după ce ștergi duplicatele existente (vezi mai jos).

-- Pas 1 (OPȚIONAL): Șterge duplicatele, păstrând o singură înregistrare per (shift_id, date) - cea cu id minim.
-- Decomentează și rulează doar dacă ai deja înregistrări duplicate.

/*
DELETE p FROM presence p
INNER JOIN (
  SELECT shift_id, date, MIN(id) AS keep_id
  FROM presence
  GROUP BY shift_id, date
  HAVING COUNT(*) > 1
) dup ON p.shift_id = dup.shift_id AND p.date = dup.date AND p.id <> dup.keep_id;
*/

-- Pas 2: Adaugă constraint UNIQUE pe (shift_id, date).
-- Dacă tabelul are deja duplicate, această comandă va eșua până nu rulezi Pas 1.

ALTER TABLE presence
  ADD CONSTRAINT UQ_presence_shift_date UNIQUE (shift_id, date);
