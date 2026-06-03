/** Aggregate stock row status (not lot-level expired). */
export enum StockStatus {
  VALID = 'valid',
  BELOW_MINIMUM = 'below_minimum',
}

/** Used on stock_transactions for movement source. */
export enum StockSource {
  MANUAL = 'manual',
  COMANDA = 'comanda',
}

/** Lot-level status stored on stock_transactions rows. */
export enum StockLotStatus {
  VALID = 'valid',
  EXPIRED = 'expired',
  BELOW_MINIMUM = 'below_minimum',
}

export enum TransactionType {
  ENTRY = 'entry',
  EXIT = 'exit',
}
