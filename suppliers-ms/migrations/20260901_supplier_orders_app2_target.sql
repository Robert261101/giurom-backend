-- Idempotenta comenzilor venite din giurom 2.0.
--
-- App2 tine comenzile intr-un outbox si le dreneaza cu reincercari. Fara cheia asta, un
-- timeout de retea dupa ce comanda a fost deja creata aici ar produce un duplicat pe care
-- magazionerul il vede ca doua livrari. NULL pentru comenzile facute din interfata App1.

ALTER TABLE `supplier_orders`
  ADD COLUMN `app2_target` VARCHAR(150) NULL DEFAULT NULL AFTER `location_id`;

ALTER TABLE `supplier_orders`
  ADD UNIQUE KEY `UQ_supplier_orders_app2_target` (`app2_target`);
