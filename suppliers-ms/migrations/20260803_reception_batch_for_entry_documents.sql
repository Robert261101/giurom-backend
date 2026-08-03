-- supplier_order_item_receptions: marcaj de lot pentru documentul de intrare.
--
-- Recepțiile create într-un singur apel `markOrderAsPartiallyReceived` primesc același
-- `reception_batch_id`, iar cele aprobate într-un singur apel `approveReceptions` primesc
-- același `approved_at`. Fără ele nu există nicio cheie stabilă pe care să grupăm rândurile
-- într-un document de intrare: `occurred_at` se calculează per rând (new Date() în buclă),
-- deci diferă în milisecunde între liniile aceleiași recepții.
--
-- Ambele coloane sunt NULL pentru rândurile istorice; exportul le tratează ca loturi
-- de un singur rând, deci datele vechi rămân exportabile fără backfill.

ALTER TABLE `supplier_order_item_receptions`
  ADD COLUMN IF NOT EXISTS `reception_batch_id` VARCHAR(36) NULL
    COMMENT 'uuid comun rândurilor create în același apel de recepție'
    AFTER `status`,
  ADD COLUMN IF NOT EXISTS `approved_at` DATETIME NULL
    COMMENT 'momentul aprobării — comun rândurilor aprobate în același apel'
    AFTER `reception_batch_id`,
  ADD COLUMN IF NOT EXISTS `net_quantity` DECIMAL(10,2) NULL
    COMMENT 'cantitatea intrată efectiv în stoc, după conversia gross→net de la aprobare'
    AFTER `approved_at`;

CREATE INDEX IF NOT EXISTS `IDX_soir_reception_batch_id`
  ON `supplier_order_item_receptions` (`reception_batch_id`);

-- Exportul documentelor de intrare filtrează pe (status, approved_at) ca să ia doar
-- loturile aprobate recent.
CREATE INDEX IF NOT EXISTS `IDX_soir_status_approved_at`
  ON `supplier_order_item_receptions` (`status`, `approved_at`);
