-- Migrare: mărire precizie cantități ingrediente rețete (ex: 0.003 kg să nu devină 0.00)
-- Rulează manual dacă folosești DB fără TypeORM synchronize.
-- După migrare, re-salvează rețetele cu cantități mici (ex: Sare, Drojdie) ca să repui valorile corecte.

ALTER TABLE recipe_products MODIFY COLUMN quantity DECIMAL(10,4) NOT NULL;
ALTER TABLE recipe_recipes MODIFY COLUMN quantity DECIMAL(10,4) NOT NULL;
