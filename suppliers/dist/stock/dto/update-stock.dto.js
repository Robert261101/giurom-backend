"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateStockDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const create_stock_dto_1 = require("./create-stock.dto");
class UpdateStockDto extends (0, swagger_1.PartialType)(create_stock_dto_1.CreateStockDto) {
}
exports.UpdateStockDto = UpdateStockDto;
//# sourceMappingURL=update-stock.dto.js.map