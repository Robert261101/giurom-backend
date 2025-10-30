"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateStockTransactionDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const create_stock_transaction_dto_1 = require("./create-stock-transaction.dto");
class UpdateStockTransactionDto extends (0, swagger_1.PartialType)(create_stock_transaction_dto_1.CreateStockTransactionDto) {
}
exports.UpdateStockTransactionDto = UpdateStockTransactionDto;
//# sourceMappingURL=update-stock-transaction.dto.js.map