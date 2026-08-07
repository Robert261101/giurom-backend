-- GIU-10: status assignment șofer „arrived” (Ajuns în locație)
-- Reutilizează coloana status existentă; nu creează status nou pe supplier_orders.

ALTER TABLE `supplier_order_driver_assignments`
  MODIFY COLUMN `status` ENUM('assigned', 'arrived', 'done')
  NOT NULL
  DEFAULT 'assigned';
