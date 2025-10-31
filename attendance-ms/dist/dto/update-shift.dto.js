"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateShiftDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const create_shift_dto_1 = require("./create-shift.dto");
class UpdateShiftDto extends (0, swagger_1.PartialType)(create_shift_dto_1.CreateShiftDto) {
}
exports.UpdateShiftDto = UpdateShiftDto;
//# sourceMappingURL=update-shift.dto.js.map